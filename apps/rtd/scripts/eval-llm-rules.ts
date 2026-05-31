/**
 * LLM 룰 자동 생성 품질 평가 하네스
 *
 * 측정 지표:
 *   1. Zod 파싱 성공률 (%) — GeneratedRulesSchema.safeParse
 *   2. 구조 불변성 통과율 (%) — validateGeneratedRules 위반 0건
 *   3. 평균 생성 시간 (초)
 *   4. 평균 재시도 횟수
 *
 * 실행: cd apps/rtd && npx tsx scripts/eval-llm-rules.ts
 * (ANTHROPIC_API_KEY는 .env.local 또는 환경변수에서 로드)
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

import { buildUserMessage, SYSTEM_PROMPT } from '../lib/llm/prompt-builder';
import { GENERATE_RULES_TOOL, GeneratedRulesSchema, validateGeneratedRules } from '../lib/llm/rule-schema';
import { FIXTURES, type FixtureInput } from './eval-llm-rules.fixtures';

// .env.local 자동 로드 (서버 불필요 — 독립 실행)
const __dirname_script = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname_script, '..', '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
} catch {
  // .env.local 없으면 process.env에서 직접 읽음
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[eval] ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const OUTPUT_CSV = resolve(__dirname_script, 'eval-llm-rules-results.csv');
const CSV_HEADER = 'id,category,zod_success,valid_success,time_ms,retry_count,error\n';

interface EvalResult {
  id: number;
  category: string;
  zodSuccess: boolean;
  validSuccess: boolean;
  timeMs: number;
  retryCount: number;
  error: string;
}

/** route.ts의 callLlm과 동일한 로직 (standalone 재현) */
async function callLlm(
  client: Anthropic,
  userMessage: string,
  feedbackMessage?: string
): Promise<unknown> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ];
  if (feedbackMessage) {
    messages.push({ role: 'assistant', content: feedbackMessage });
    messages.push({ role: 'user', content: '위 오류를 수정하여 다시 generate_rule_relations 도구를 호출해주세요.' });
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [GENERATE_RULES_TOOL],
    tool_choice: { type: 'tool', name: 'generate_rule_relations' },
    messages,
  });

  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('LLM이 tool_use 응답을 반환하지 않았습니다.');
  }
  return toolBlock.input;
}

async function runSingle(fixture: FixtureInput, client: Anthropic): Promise<EvalResult> {
  const { id, category, prompt, groupContext, ruleDefs } = fixture;
  const validRuleIds = new Set(ruleDefs.map((d) => d.ruleId));
  const userMsg = buildUserMessage(prompt, ruleDefs as Parameters<typeof buildUserMessage>[1], groupContext);

  const t0 = performance.now();
  let retryCount = 0;
  let zodSuccess = false;
  let validSuccess = false;
  let errorDetail = '';

  try {
    // 1차 호출
    const raw1 = await callLlm(client, userMsg);
    const parsed1 = GeneratedRulesSchema.safeParse(raw1);

    if (!parsed1.success) {
      // Zod 실패 → 1회 재시도
      retryCount++;
      const zodErrors = parsed1.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      const raw2 = await callLlm(client, userMsg, `출력 형식 오류: ${zodErrors}`);
      const parsed2 = GeneratedRulesSchema.safeParse(raw2);
      if (!parsed2.success) {
        errorDetail = `zod_fail_after_retry: ${parsed2.error.issues[0]?.message ?? ''}`;
      } else {
        zodSuccess = true;
        const errs = validateGeneratedRules(parsed2.data, validRuleIds);
        validSuccess = errs.length === 0;
        if (!validSuccess) errorDetail = errs.slice(0, 2).join(' | ');
      }
    } else {
      zodSuccess = true;
      const errs1 = validateGeneratedRules(parsed1.data, validRuleIds);
      if (errs1.length > 0) {
        // 불변성 실패 → 1회 재시도
        retryCount++;
        const raw2 = await callLlm(client, userMsg, `유효성 오류: ${errs1.join('; ')}`);
        const parsed2 = GeneratedRulesSchema.safeParse(raw2);
        if (!parsed2.success) {
          errorDetail = `zod_fail_after_validation_retry`;
        } else {
          const errs2 = validateGeneratedRules(parsed2.data, validRuleIds);
          validSuccess = errs2.length === 0;
          if (!validSuccess) errorDetail = errs2.slice(0, 2).join(' | ');
        }
      } else {
        validSuccess = true;
      }
    }
  } catch (e) {
    errorDetail = `api_error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return {
    id,
    category,
    zodSuccess,
    validSuccess,
    timeMs: performance.now() - t0,
    retryCount,
    error: errorDetail,
  };
}

function csvRow(r: EvalResult): string {
  const safeErr = r.error.replace(/"/g, "'").replace(/\n/g, ' ');
  return `${r.id},${r.category},${r.zodSuccess ? 1 : 0},${r.validSuccess ? 1 : 0},${r.timeMs.toFixed(0)},${r.retryCount},"${safeErr}"\n`;
}

async function main() {
  console.log(`\n📊 LLM 룰 생성 평가 시작 — ${FIXTURES.length}개 입력셋\n`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // CSV 헤더 초기화
  writeFileSync(OUTPUT_CSV, CSV_HEADER, 'utf-8');

  const results: EvalResult[] = [];

  for (const fixture of FIXTURES) {
    process.stdout.write(`  [${fixture.id.toString().padStart(2, '0')}/${FIXTURES.length}] (${fixture.category}) ${fixture.prompt.slice(0, 48)}...`);
    const result = await runSingle(fixture, client);
    results.push(result);
    appendFileSync(OUTPUT_CSV, csvRow(result), 'utf-8');

    const status = result.validSuccess ? '✅' : result.zodSuccess ? '⚠️ zod ok/valid fail' : '❌';
    console.log(` ${status} ${(result.timeMs / 1000).toFixed(1)}s retry=${result.retryCount}`);

    // 연속 호출 사이 100ms 대기 (rate limit 여유)
    await new Promise((r) => setTimeout(r, 100));
  }

  // 요약
  const total = results.length;
  const zodOk   = results.filter((r) => r.zodSuccess).length;
  const validOk = results.filter((r) => r.validSuccess).length;
  const avgTime = results.reduce((s, r) => s + r.timeMs, 0) / total / 1000;
  const avgRetry = results.reduce((s, r) => s + r.retryCount, 0) / total;

  console.log('\n' + '─'.repeat(60));
  console.log('📈 평가 결과 요약');
  console.log('─'.repeat(60));
  console.log(`  총 입력셋:              ${total}개`);
  console.log(`  Zod 파싱 성공률:        ${zodOk}/${total} = ${(zodOk/total*100).toFixed(1)}%`);
  console.log(`  구조 불변성 통과율:     ${validOk}/${total} = ${(validOk/total*100).toFixed(1)}%`);
  console.log(`  평균 생성 시간:         ${avgTime.toFixed(2)}초`);
  console.log(`  평균 재시도 횟수:       ${avgRetry.toFixed(2)}회`);
  console.log('─'.repeat(60));

  // 카테고리별 요약
  const categories = ['simple', 'complex', 'sort', 'fallback'] as const;
  for (const cat of categories) {
    const sub = results.filter((r) => r.category === cat);
    if (!sub.length) continue;
    const subValid = sub.filter((r) => r.validSuccess).length;
    console.log(`  ${cat.padEnd(10)}: ${subValid}/${sub.length} valid  (${(subValid/sub.length*100).toFixed(0)}%)`);
  }

  console.log(`\n💾 결과 CSV: ${OUTPUT_CSV}\n`);

  // 실패 항목 상세 출력
  const failures = results.filter((r) => !r.validSuccess);
  if (failures.length > 0) {
    console.log(`⚠️  실패 항목 (${failures.length}개):`);
    for (const f of failures) {
      console.log(`  #${f.id} [${f.category}]: ${f.error.slice(0, 80)}`);
    }
    console.log();
  }
}

main().catch((e) => {
  console.error('[eval] 치명적 오류:', e);
  process.exit(1);
});
