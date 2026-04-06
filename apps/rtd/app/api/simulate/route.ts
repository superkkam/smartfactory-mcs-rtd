import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type {
  SimulationRequest,
  SimulationResponse,
  SimulationSequenceResult,
  ValidationIssue,
} from '@workspace/types/rtd';

const DEFAULT_VERSION = '1';

/** DB row → 릴레이션 변환 */
function toRelation(row: Record<string, unknown>) {
  return {
    ruleGroupId:               row.rule_group_id as string,
    ruleId:                    row.rule_id as string,
    sequence:                  row.sequence as number,
    isMandatory:               row.is_mandatory as string,
    filterSequence:            row.filter_sequence as number | null,
    jumpNextSequence:          row.jump_next_sequence as number | null,
    jumpNextSequenceCondition: row.jump_next_sequence_condition as string | null,
    ruleSortId:                row.rule_sort_id as string | null,
  };
}

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

  // ── 1. rule_group 조회 ──────────────────────────────────────
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

  // ── 2. rule_relation 조회 ───────────────────────────────────
  const { data: relRows, error: relError } = await supabase
    .from('rule_relation')
    .select('*')
    .eq('rule_group_id', ruleGroupId)
    .order('sequence');

  if (relError) {
    return NextResponse.json({ error: relError.message }, { status: 500 });
  }

  const relations = (relRows ?? []).map(toRelation);

  // 릴레이션 없을 때 → 빈 결과 + 경고
  if (relations.length === 0) {
    const response: SimulationResponse = {
      valid: false,
      validationIssues: [{ severity: 'warning', sequence: null, message: '룰 그룹에 시퀀스가 없습니다' }],
      results: [],
      totalDuration: Math.round(performance.now() - totalStart),
    };
    return NextResponse.json(response);
  }

  const ruleIds = relations.map((r) => r.ruleId);
  const sequenceNums = relations.map((r) => r.sequence);
  const sequenceSet = new Set(sequenceNums);

  // ── 3. rule_def / rule_query / rule_running_result 병렬 조회 ─
  const [defResult, queryResult, runningResult] = await Promise.all([
    supabase
      .from('rule_def')
      .select('rule_id, rule_name, rule_type')
      .in('rule_id', ruleIds),
    supabase
      .from('rule_query')
      .select('rule_query_id, rule_query_string')
      .in('rule_query_id', ruleIds)
      .eq('rule_query_version', DEFAULT_VERSION),
    supabase
      .from('rule_running_result')
      .select('rule_id, count')
      .in('rule_id', ruleIds)
      .order('start_time', { ascending: false }),
  ]);

  const defMap = new Map<string, { ruleName: string; ruleType: string }>();
  for (const row of defResult.data ?? []) {
    defMap.set(row.rule_id as string, {
      ruleName: row.rule_name as string,
      ruleType: row.rule_type as string,
    });
  }

  const queryMap = new Map<string, string>();
  for (const row of queryResult.data ?? []) {
    queryMap.set(row.rule_query_id as string, row.rule_query_string as string);
  }

  // 룰별 최신 count (첫 번째 항목 = 가장 최근)
  const countMap = new Map<string, number>();
  for (const row of runningResult.data ?? []) {
    const ruleId = row.rule_id as string;
    if (!countMap.has(ruleId)) {
      countMap.set(ruleId, row.count as number);
    }
  }

  // ── 4. 유효성 검증 ──────────────────────────────────────────
  const validationIssues: ValidationIssue[] = [];

  // filterSequence 순환 참조 탐지
  const filterMap = new Map<number, number>();
  for (const rel of relations) {
    if (rel.filterSequence != null) {
      filterMap.set(rel.sequence, rel.filterSequence);
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
    if (rel.filterSequence != null && !sequenceSet.has(rel.filterSequence)) {
      validationIssues.push({
        severity: 'error',
        sequence: rel.sequence,
        message: `#${rel.sequence}: filterSequence ${rel.filterSequence}가 존재하지 않습니다`,
      });
    }
    if (rel.jumpNextSequence != null && !sequenceSet.has(rel.jumpNextSequence)) {
      validationIssues.push({
        severity: 'error',
        sequence: rel.sequence,
        message: `#${rel.sequence}: jumpNextSequence ${rel.jumpNextSequence}가 존재하지 않습니다`,
      });
    }
    // 필수 룰에 쿼리 미정의 경고
    if (rel.isMandatory === 'Y' && !queryMap.has(rel.ruleId)) {
      validationIssues.push({
        severity: 'warning',
        sequence: rel.sequence,
        message: `#${rel.sequence} (${rel.ruleId}): 필수 룰인데 쿼리가 정의되지 않았습니다`,
      });
    }
  }

  const hasErrors = validationIssues.some((i) => i.severity === 'error');

  // ── 5. 시퀀스별 결과 빌드 ───────────────────────────────────
  const results: SimulationSequenceResult[] = relations.map((rel) => {
    const seqStart = performance.now();
    const def = defMap.get(rel.ruleId);
    const sql = queryMap.get(rel.ruleId);
    const hasQuery = sql !== undefined;

    let count: number | null = null;
    if (hasQuery) {
      count = countMap.get(rel.ruleId) ?? 0;
    }

    return {
      sequence:    rel.sequence,
      ruleId:      rel.ruleId,
      ruleName:    def?.ruleName ?? rel.ruleId,
      ruleType:    def?.ruleType ?? 'Data',
      count,
      duration:    Math.round(performance.now() - seqStart),
      hasQuery,
      queryPreview: sql ? sql.slice(0, 100) : undefined,
    };
  });

  const response: SimulationResponse = {
    valid: !hasErrors,
    validationIssues,
    results,
    totalDuration: Math.round(performance.now() - totalStart),
  };

  return NextResponse.json(response);
}
