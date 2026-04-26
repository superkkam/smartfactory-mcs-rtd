import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runRuleEngine } from '@/lib/rule-engine/engine';
import type {
  SimulationRequest,
  SimulationResponse,
  SimulationSequenceResult,
  ValidationIssue,
} from '@workspace/types/rtd';

/** filterSequence 그래프에서 순환 참조 탐지 (DFS) */
function detectCycles(
  sequenceNums: number[],
  filterMap: Map<number, number>
): number[][] {
  const visited = new Set<number>();
  const cycles: number[][] = [];

  function dfs(node: number, path: number[], inPath: Set<number>) {
    if (inPath.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inPath.add(node);
    path.push(node);
    const next = filterMap.get(node);
    if (next !== undefined) {
      dfs(next, path, inPath);
    }
    path.pop();
    inPath.delete(node);
  }

  for (const seq of sequenceNums) {
    dfs(seq, [], new Set());
  }
  return cycles;
}

export async function POST(request: NextRequest) {
  const totalStart = performance.now();

  let body: SimulationRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식' }, { status: 400 });
  }

  const { ruleGroupId, equipId, eventType } = body;
  if (!ruleGroupId || !equipId || !eventType) {
    return NextResponse.json({ error: 'ruleGroupId, equipId, eventType는 필수입니다' }, { status: 400 });
  }

  const supabase = await createClient();

  // ── 1. rule_group 존재 확인 ──────────────────────────────────
  const { data: groupRow, error: groupError } = await supabase
    .from('rule_group')
    .select('*')
    .eq('rule_group_id', ruleGroupId)
    .maybeSingle();

  if (groupError) {
    return NextResponse.json({ error: groupError.message }, { status: 500 });
  }
  if (!groupRow) {
    return NextResponse.json({ error: `룰 그룹 ${ruleGroupId}를 찾을 수 없습니다` }, { status: 404 });
  }

  // ── 2. 사전 유효성 검증 (rule_relation 구조 검사) ────────────
  const { data: relRows, error: relError } = await supabase
    .from('rule_relation')
    .select('*')
    .eq('rule_group_id', ruleGroupId)
    .order('sequence');

  if (relError) {
    return NextResponse.json({ error: relError.message }, { status: 500 });
  }

  const relations = (relRows ?? []) as Array<Record<string, unknown>>;

  if (relations.length === 0) {
    const response: SimulationResponse = {
      valid: false,
      validationIssues: [{ severity: 'warning', sequence: null, message: '룰 그룹에 시퀀스가 없습니다' }],
      results: [],
      totalDuration: Math.round(performance.now() - totalStart),
    };
    return NextResponse.json(response);
  }

  const sequenceNums = relations.map((r) => r.sequence as number);
  const sequenceSet = new Set(sequenceNums);
  const ruleIds = relations.map((r) => r.rule_id as string);

  // 쿼리 정의 여부 확인 (mandatory 경고용)
  const { data: queryRows } = await supabase
    .from('rule_query')
    .select('rule_query_id')
    .in('rule_query_id', ruleIds);
  const definedQueryIds = new Set((queryRows ?? []).map((r) => r.rule_query_id as string));

  const validationIssues: ValidationIssue[] = [];

  // filterSequence 순환 참조 탐지
  const filterMap = new Map<number, number>();
  for (const rel of relations) {
    if (rel.filter_sequence != null) {
      filterMap.set(rel.sequence as number, rel.filter_sequence as number);
    }
  }
  const cycles = detectCycles(sequenceNums, filterMap);
  for (const cycle of cycles) {
    validationIssues.push({
      severity: 'error',
      sequence: cycle[0] ?? null,
      message: `filterSequence 순환 참조 감지: 시퀀스 ${cycle.join(' → ')} → ${cycle[0]}`,
    });
  }

  // 잘못된 filterSequence / jumpNextSequence 참조
  for (const rel of relations) {
    const seq = rel.sequence as number;
    if (rel.filter_sequence != null && !sequenceSet.has(rel.filter_sequence as number)) {
      validationIssues.push({
        severity: 'error',
        sequence: seq,
        message: `#${seq}: filterSequence ${rel.filter_sequence}가 존재하지 않습니다`,
      });
    }
    if (rel.jump_next_sequence != null) {
      const jumpTarget = rel.jump_next_sequence as number;
      if (!sequenceSet.has(jumpTarget)) {
        validationIssues.push({
          severity: 'error',
          sequence: seq,
          message: `#${seq}: jumpNextSequence ${jumpTarget}가 존재하지 않습니다`,
        });
      } else if (jumpTarget <= seq) {
        validationIssues.push({
          severity: 'error',
          sequence: seq,
          message: `#${seq}: jumpNextSequence(${jumpTarget})는 자신(${seq})보다 큰 시퀀스를 가리켜야 합니다 — 후방 점프는 무한 루프를 유발합니다`,
        });
      }
    }
    if (rel.is_mandatory === 'Y' && !definedQueryIds.has(rel.rule_id as string)) {
      validationIssues.push({
        severity: 'warning',
        sequence: seq,
        message: `#${seq} (${rel.rule_id}): 필수 룰인데 쿼리가 정의되지 않았습니다`,
      });
    }
  }

  const hasErrors = validationIssues.some((i) => i.severity === 'error');

  // ── 3. 실 엔진 dry-run 실행 ──────────────────────────────────
  // 구조적 오류가 없는 경우에만 실행 (오류 있으면 구조 검증 결과만 반환)
  let results: SimulationSequenceResult[] = [];

  if (!hasErrors) {
    const engineResult = await runRuleEngine(supabase, {
      ruleGroupId,
      equipmentId: equipId,
      eventType,
      dryRun: true,  // rule_running_result 에 기록하지 않음
    });

    results = engineResult.sequenceResults.map((sr) => ({
      sequence:     sr.sequence,
      ruleId:       sr.ruleId,
      ruleName:     sr.ruleName,
      ruleType:     sr.ruleType,
      count:        sr.count,
      duration:     sr.duration,
      hasQuery:     sr.queryPreview !== undefined,
      queryPreview: sr.queryPreview,
      rows:         sr.rows,
      executed:     sr.executed,
    }));

    // 엔진이 REJECTED 를 반환한 경우 해당 시퀀스에 경고 추가
    if (!engineResult.success && engineResult.reason) {
      validationIssues.push({
        severity: 'warning',
        sequence: null,
        message: engineResult.reason,
      });
    }
  } else {
    // 구조 오류 있을 때는 기존 방식으로 메타만 반환
    const { data: defRows } = await supabase
      .from('rule_def')
      .select('rule_id, rule_name, rule_type')
      .in('rule_id', ruleIds);
    const defMap = new Map(
      (defRows ?? []).map((r) => [r.rule_id as string, { ruleName: r.rule_name as string, ruleType: r.rule_type as string }])
    );

    results = relations.map((rel) => {
      const ruleId = rel.rule_id as string;
      const def = defMap.get(ruleId);
      return {
        sequence:  rel.sequence as number,
        ruleId,
        ruleName:  def?.ruleName ?? ruleId,
        ruleType:  def?.ruleType ?? 'Data',
        count:     null,
        duration:  0,
        hasQuery:  definedQueryIds.has(ruleId),
      };
    });
  }

  const response: SimulationResponse = {
    valid: !hasErrors,
    validationIssues,
    results,
    totalDuration: Math.round(performance.now() - totalStart),
  };

  return NextResponse.json(response);
}
