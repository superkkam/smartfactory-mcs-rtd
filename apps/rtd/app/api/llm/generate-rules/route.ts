import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { GENERATE_RULES_TOOL, GeneratedRulesSchema, validateGeneratedRules } from '@/lib/llm/rule-schema';
import { SYSTEM_PROMPT, buildUserMessage } from '@/lib/llm/prompt-builder';
import type { RuleDef } from '@workspace/types/rtd';

function toRuleDef(row: Record<string, unknown>): RuleDef {
  return {
    ruleId:        row.rule_id as string,
    ruleName:      row.rule_name as string,
    ruleClassId:   row.rule_class_id as string,
    ruleType:      row.rule_type as string,
    ruleCondition: row.rule_condition as string | undefined,
  };
}

/** Anthropic Tool Use 호출 후 sequences 추출 */
async function callLlm(
  client: Anthropic,
  userMessage: string,
  feedbackMessage?: string
) {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ];
  if (feedbackMessage) {
    // 1회 재시도: 이전 응답 + 피드백 메시지를 대화에 추가
    messages.push({ role: 'assistant', content: feedbackMessage });
    messages.push({ role: 'user', content: '위 오류를 수정하여 다시 generate_rule_relations 도구를 호출해주세요.' });
  }

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [GENERATE_RULES_TOOL],
    tool_choice: { type: 'tool', name: 'generate_rule_relations' },
    messages,
  });

  const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new Error('LLM이 tool_use 응답을 반환하지 않았습니다.');
  }
  return toolUseBlock.input;
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다. .env.local을 확인하세요.' },
      { status: 503 }
    );
  }

  let body: { ruleGroupId: string; prompt: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const { ruleGroupId, prompt } = body;
  if (!ruleGroupId || !prompt?.trim()) {
    return NextResponse.json(
      { error: 'ruleGroupId와 prompt는 필수입니다.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  // 룰 그룹 + 룰 정의 조회
  const [groupResult, defsResult] = await Promise.all([
    supabase.from('rule_group').select('*').eq('rule_group_id', ruleGroupId).single(),
    supabase.from('rule_def').select('*').order('rule_id'),
  ]);

  if (groupResult.error || !groupResult.data) {
    return NextResponse.json({ error: '룰 그룹을 찾을 수 없습니다.' }, { status: 404 });
  }

  const ruleDefs: RuleDef[] = (defsResult.data ?? []).map(toRuleDef);
  const validRuleIds = new Set(ruleDefs.map((d) => d.ruleId));
  const groupContext = {
    ruleGroupName: groupResult.data.rule_group_name as string,
    ruleGroupType: groupResult.data.rule_group_type as string,
  };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userMessage = buildUserMessage(prompt, ruleDefs, groupContext);

  try {
    // 1차 호출
    const rawOutput = await callLlm(client, userMessage);
    const parsed = GeneratedRulesSchema.safeParse(rawOutput);

    if (!parsed.success) {
      // Zod 파싱 실패 → 1회 재시도
      const zodErrors = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      const retryOutput = await callLlm(client, userMessage, `출력 형식 오류: ${zodErrors}`);
      const retryParsed = GeneratedRulesSchema.safeParse(retryOutput);
      if (!retryParsed.success) {
        return NextResponse.json({ error: 'LLM 응답 형식이 올바르지 않습니다. 다시 시도해주세요.' }, { status: 422 });
      }

      const validationErrors = validateGeneratedRules(retryParsed.data, validRuleIds);
      if (validationErrors.length > 0) {
        return NextResponse.json({ error: validationErrors.join('\n') }, { status: 422 });
      }
      return NextResponse.json({ sequences: retryParsed.data.sequences });
    }

    // 불변성 검증 실패 → 1회 재시도
    const validationErrors = validateGeneratedRules(parsed.data, validRuleIds);
    if (validationErrors.length > 0) {
      const retryOutput = await callLlm(client, userMessage, `유효성 오류: ${validationErrors.join('; ')}`);
      const retryParsed = GeneratedRulesSchema.safeParse(retryOutput);
      if (!retryParsed.success) {
        return NextResponse.json({ error: 'LLM 응답 형식이 올바르지 않습니다. 다시 시도해주세요.' }, { status: 422 });
      }
      const retryErrors = validateGeneratedRules(retryParsed.data, validRuleIds);
      if (retryErrors.length > 0) {
        return NextResponse.json({ error: retryErrors.join('\n'), sequences: retryParsed.data.sequences }, { status: 422 });
      }
      return NextResponse.json({ sequences: retryParsed.data.sequences });
    }

    return NextResponse.json({ sequences: parsed.data.sequences });
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json({ error: `LLM 호출 실패: ${message}` }, { status: 500 });
  }
}
