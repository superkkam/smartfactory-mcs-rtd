/**
 * RTD 룰 실행 엔진
 *
 * MES 이벤트 파라미터(equipmentId, eventType 등)를 받아
 * 룰 그룹의 시퀀스를 순서대로 실행하고 최종 디스패칭 결과를 반환.
 *
 * 핵심 흐름:
 *  1. rule_relation (시퀀스 목록) 조회
 *  2. 각 시퀀스: rule_query SQL 파라미터 바인딩 → rtd_exec_readonly RPC 실행
 *  3. filterSequence 체인, jumpNextSequence 분기 처리
 *  4. isMandatory='Y' 인데 결과=0 → REJECTED
 *  5. 최종 결과 row → selectedCarrierId/Lot, destEquipmentId 산출
 *  6. dryRun=false 시 rule_running_result 에 기록
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ─── 입력/출력 타입 ───────────────────────────────────────────────

export interface EngineInput {
  /** 실행할 룰 그룹 ID */
  ruleGroupId: string;
  /** 이벤트 발생 설비 ID (text, mcs_equipment.equipment_id) */
  equipmentId: string;
  /** 이벤트 유형 (LOAD_REQUEST / UNLOAD_REQUEST / TRANSFER_REQUEST) */
  eventType: string;
  /** 특정 Lot 지정 반송 시 */
  lotId?: string;
  /** 캐리어 ID 직접 지정 시 */
  carrierId?: string;
  /** 현재 활성 레이아웃 ID (쿼리 범위 한정) */
  layoutId?: string;
  /**
   * true 이면 실제 디스패칭을 수행하지 않고 결과만 반환 (simulate dry-run).
   * rule_running_result 에 기록하지 않음.
   */
  dryRun?: boolean;
}

export interface SequenceResult {
  sequence: number;
  ruleId: string;
  ruleName: string;
  ruleType: string;
  count: number | null;
  /** 실행 소요시간 (ms) */
  duration: number;
  /** SQL 쿼리 앞 100자 미리보기 */
  queryPreview?: string;
  /** 이 시퀀스가 실제로 실행됐는지 (jumpNextSequence 로 건너뛴 경우 false) */
  executed: boolean;
  /** 조회된 실제 rows (최대 10건, dry-run 결과 확인용) */
  rows?: Record<string, unknown>[];
}

export interface EngineResult {
  /** 디스패칭 성공 여부 */
  success: boolean;
  /** 실패 이유 */
  reason?: string;
  /** 선택된 캐리어의 Lot ID */
  selectedLotId: string | null;
  /** 목적지 설비 ID (mcs_equipment.equipment_id) */
  destEquipmentId: string | null;
  /** 적용된 룰 그룹 ID */
  ruleGroupId: string;
  /** 시퀀스별 실행 결과 */
  sequenceResults: SequenceResult[];
  /** 전체 실행 소요시간 (ms) */
  totalDuration: number;
}

// ─── 파라미터 바인딩 ─────────────────────────────────────────────

/**
 * rule_query_string 의 :파라미터 를 실제 값으로 치환.
 * 예: WHERE equipment_id = :equipmentId → WHERE equipment_id = 'B1STK101'
 * SQL 인젝션 방지: 바인딩 값은 single-quote 이스케이프 처리.
 */
function bindParams(sql: string, params: Record<string, string | null>): string {
  let result = sql;
  for (const [key, value] of Object.entries(params)) {
    const placeholder = new RegExp(`:${key}\\b`, 'g');
    if (value === null) {
      result = result.replace(placeholder, 'NULL');
    } else {
      // single-quote 이스케이프 후 문자열 리터럴로 치환
      const escaped = value.replace(/'/g, "''");
      result = result.replace(placeholder, `'${escaped}'`);
    }
  }
  return result;
}

// ─── 순환 참조 탐지 ──────────────────────────────────────────────

function detectCycles(seqNums: number[], filterMap: Map<number, number>): boolean {
  const visited = new Set<number>();
  for (const start of seqNums) {
    const inPath = new Set<number>();
    let cur: number | undefined = start;
    while (cur !== undefined && !visited.has(cur)) {
      if (inPath.has(cur)) return true;
      inPath.add(cur);
      visited.add(cur);
      cur = filterMap.get(cur);
    }
  }
  return false;
}

// ─── 메인 엔진 ───────────────────────────────────────────────────

/**
 * 룰 그룹을 실제 MCS 데이터 기반으로 실행.
 * Route Handler 에서 await runRuleEngine(supabase, input) 으로 호출.
 */
export async function runRuleEngine(
  supabase: SupabaseClient,
  input: EngineInput
): Promise<EngineResult> {
  const totalStart = performance.now();
  const { ruleGroupId, equipmentId, eventType, lotId, carrierId, layoutId, dryRun = false } = input;

  // MES 이벤트 파라미터 바인딩 맵
  const bindMap: Record<string, string | null> = {
    equipmentId: equipmentId ?? null,
    eventType:   eventType ?? null,
    lotId:       lotId ?? null,
    carrierId:   carrierId ?? null,
    layoutId:    layoutId ?? null,
  };

  // ── 1. rule_relation 조회 ────────────────────────────────────
  const { data: relRows, error: relErr } = await supabase
    .from('rule_relation')
    .select('*')
    .eq('rule_group_id', ruleGroupId)
    .order('sequence');

  if (relErr) {
    return makeError(ruleGroupId, `rule_relation 조회 실패: ${relErr.message}`, performance.now() - totalStart);
  }
  if (!relRows || relRows.length === 0) {
    return makeError(ruleGroupId, '룰 그룹에 시퀀스가 없습니다', performance.now() - totalStart);
  }

  const relations = relRows as Array<Record<string, unknown>>;
  const ruleIds = relations.map((r) => r.rule_id as string);
  const seqNums = relations.map((r) => r.sequence as number);

  // 순환 참조 사전 검사
  const filterMap = new Map<number, number>();
  for (const r of relations) {
    if (r.filter_sequence != null) filterMap.set(r.sequence as number, r.filter_sequence as number);
  }
  if (detectCycles(seqNums, filterMap)) {
    return makeError(ruleGroupId, 'filterSequence 순환 참조 감지됨', performance.now() - totalStart);
  }

  // ── 2. rule_def / rule_query 병렬 조회 ──────────────────────
  const [defResult, queryResult] = await Promise.all([
    supabase.from('rule_def').select('rule_id, rule_name, rule_type').in('rule_id', ruleIds),
    supabase.from('rule_query').select('rule_query_id, rule_query_string').in('rule_query_id', ruleIds),
  ]);

  const defMap = new Map<string, { ruleName: string; ruleType: string }>();
  for (const row of defResult.data ?? []) {
    defMap.set(row.rule_id as string, { ruleName: row.rule_name as string, ruleType: row.rule_type as string });
  }

  const queryMap = new Map<string, string>();
  for (const row of queryResult.data ?? []) {
    queryMap.set(row.rule_query_id as string, row.rule_query_string as string);
  }

  // ── 3. 시퀀스별 실행 ─────────────────────────────────────────
  const seqResults: SequenceResult[] = [];
  // 이전 시퀀스 결과 저장: sequence → jsonb 배열 (filterSequence 체인용)
  const prevResults = new Map<number, Array<Record<string, unknown>>>();

  // 실행 포인터 (jumpNextSequence 분기 처리)
  const seqIndex = new Map(seqNums.map((n, i) => [n, i]));
  let currentIdx = 0;

  // 최종 디스패칭에 사용할 결과 row
  let finalRows: Array<Record<string, unknown>> = [];

  while (currentIdx < relations.length) {
    const rel = relations[currentIdx];
    const seq       = rel.sequence as number;
    const ruleId    = rel.rule_id as string;
    const mandatory = (rel.is_mandatory as string) === 'Y';
    const filterSeq = rel.filter_sequence as number | null;
    const jumpSeq   = rel.jump_next_sequence as number | null;
    const jumpCond  = rel.jump_next_sequence_condition as string | null;

    const def = defMap.get(ruleId);
    const sql = queryMap.get(ruleId);
    const seqStart = performance.now();

    const seqResult: SequenceResult = {
      sequence:     seq,
      ruleId,
      ruleName:     def?.ruleName ?? ruleId,
      ruleType:     def?.ruleType ?? 'Data',
      count:        null,
      duration:     0,
      executed:     true,
    };

    if (sql) {
      seqResult.queryPreview = sql.slice(0, 100);

      // filterSequence 체인: 이전 시퀀스 결과를 WITH CTE 로 주입
      let finalSql = bindParams(sql, bindMap);
      if (filterSeq != null) {
        const prevRows = prevResults.get(filterSeq);
        if (prevRows && prevRows.length > 0) {
          // 이전 결과의 첫 번째 row 컬럼명을 추출해 CTE 로 래핑
          // 실제 환경에서 filterSequence 는 이전 결과 집합을 IN 또는 EXISTS 로 참조하는 패턴.
          // 여기서는 이전 결과의 carrier_id / lot_id 목록으로 IN 필터 자동 주입.
          const prevCarrierIds = prevRows
            .filter((r) => r.carrier_id)
            .map((r) => `'${String(r.carrier_id).replace(/'/g, "''")}'`)
            .join(', ');
          if (prevCarrierIds) {
            finalSql = `SELECT * FROM (${finalSql}) _filtered WHERE carrier_id IN (${prevCarrierIds})`;
          }
        }
      }

      // Supabase RPC 로 실행
      const { data: rpcData, error: rpcErr } = await supabase.rpc('rtd_exec_readonly', { sql: finalSql });
      if (rpcErr) {
        // 실행 오류는 경고로 처리하고 계속 진행 (mandatory 는 아래에서 처리)
        seqResult.count = 0;
      } else {
        const rows = (rpcData as Array<Record<string, unknown>>) ?? [];
        seqResult.count = rows.length;
        seqResult.rows = rows.slice(0, 100); // 최대 100건 프론트로 전송 (UI 페이징)
        prevResults.set(seq, rows);

        // 마지막 실행 결과를 최종 디스패칭 후보로 유지
        if (rows.length > 0) finalRows = rows;
      }
    } else {
      seqResult.count = null; // 쿼리 미정의
    }

    seqResult.duration = Math.round(performance.now() - seqStart);

    // mandatory 검사: isMandatory='Y' 이고 결과가 0 이면 REJECTED
    if (mandatory && seqResult.count === 0) {
      seqResults.push(seqResult);
      return {
        success:          false,
        reason:           `시퀀스 #${seq} (${seqResult.ruleName}): 필수 룰 결과 0건 → REJECTED`,
        selectedLotId:    null,
        destEquipmentId:  null,
        ruleGroupId,
        sequenceResults:  seqResults,
        totalDuration:    Math.round(performance.now() - totalStart),
      };
    }

    seqResults.push(seqResult);

    // jumpNextSequence 분기
    let nextIdx = currentIdx + 1;
    if (jumpSeq != null && jumpCond != null) {
      const condMet =
        (jumpCond === 'COUNT>0' && (seqResult.count ?? 0) > 0) ||
        (jumpCond === 'COUNT=0' && (seqResult.count ?? 0) === 0);
      if (condMet) {
        const jumpIdx = seqIndex.get(jumpSeq);
        // 후방 점프는 무한 루프 방지를 위해 무시
        if (jumpIdx !== undefined && jumpIdx > currentIdx) nextIdx = jumpIdx;
      }
    }

    // 점프로 건너뛴 시퀀스를 executed=false 로 기록 (UI 가시성)
    for (let skipIdx = currentIdx + 1; skipIdx < nextIdx; skipIdx++) {
      const skipped = relations[skipIdx];
      const skippedDef = defMap.get(skipped.rule_id as string);
      seqResults.push({
        sequence: skipped.sequence as number,
        ruleId:   skipped.rule_id as string,
        ruleName: skippedDef?.ruleName ?? (skipped.rule_id as string),
        ruleType: skippedDef?.ruleType ?? 'Data',
        count:    null,
        duration: 0,
        executed: false,
      });
    }

    currentIdx = nextIdx;
  }

  // ── 4. 최종 디스패칭 결과 산출 ──────────────────────────────
  // finalRows 의 첫 번째 row 에서 lot_id / equipment_id 추출
  const topRow = finalRows[0] ?? {};
  const selectedLotId: string | null =
    (topRow.lot_id as string) || (topRow.carrier_id as string) || null;
  const destEquipmentId: string | null =
    (topRow.equipment_id as string) || (topRow.dest_equipment_id as string) || null;

  // ── 5. rule_running_result 기록 (dryRun=false 시) ───────────
  if (!dryRun && seqResults.length > 0) {
    const now = new Date().toISOString();
    const inserts = seqResults
      .filter((r) => r.executed && r.count !== null)
      .map((r) => ({
        lot_id:         selectedLotId ?? '',
        rule_id:        r.ruleId,
        sequence:       r.sequence,
        count:          r.count ?? 0,
        start_time:     now,
        end_time:       new Date(Date.now() + r.duration).toISOString(),
        is_dispatching: r.sequence === seqResults[seqResults.length - 1]?.sequence ? 'Y' : 'N',
      }));

    if (inserts.length > 0) {
      await supabase.from('rule_running_result').insert(inserts);
    }
  }

  return {
    success:         true,
    selectedLotId,
    destEquipmentId,
    ruleGroupId,
    sequenceResults: seqResults,
    totalDuration:   Math.round(performance.now() - totalStart),
  };
}

// ─── 헬퍼 ────────────────────────────────────────────────────────

function makeError(ruleGroupId: string, reason: string, elapsed: number): EngineResult {
  return {
    success:         false,
    reason,
    selectedLotId:   null,
    destEquipmentId: null,
    ruleGroupId,
    sequenceResults: [],
    totalDuration:   Math.round(elapsed),
  };
}

