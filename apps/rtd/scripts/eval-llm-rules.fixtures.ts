/**
 * LLM 룰 생성 평가 입력셋 (25개)
 *
 * few-shot 예시 3개(긴급 Lot 우선 / 동일 레시피+부하 / Idle+heartbeat fallback)와
 * 내용 중복 없이 설계. 난이도별 배분:
 *   단순 조건(6) / 복합 조건(9) / 정렬 포함(5) / Fallback(5)
 */

export interface MockRuleDef {
  ruleId: string;
  ruleName: string;
  ruleClassId: string;
  ruleType: string;
  ruleCondition?: string;
}

export interface FixtureInput {
  id: number;
  category: 'simple' | 'complex' | 'sort' | 'fallback';
  prompt: string;
  groupContext: { ruleGroupName: string; ruleGroupType: string };
  ruleDefs: MockRuleDef[];
}

/** 평가용 모의 룰 정의 목록 (16개) */
export const MOCK_RULE_DEFS: MockRuleDef[] = [
  { ruleId: 'DATA-CARRIER-001',      ruleName: '전체 캐리어 목록 조회',         ruleClassId: 'carrier',        ruleType: 'Data'   },
  { ruleId: 'DATA-EQUIP-001',        ruleName: '전체 설비 목록 조회',            ruleClassId: 'equipment',      ruleType: 'Data'   },
  { ruleId: 'DATA-EQUIP-UNIT-001',   ruleName: '설비 유닛 목록 조회',            ruleClassId: 'equipment_unit', ruleType: 'Data'   },
  { ruleId: 'FILTER-EQUIP-AVAIL',    ruleName: '가용 설비 필터',                 ruleClassId: 'equipment',      ruleType: 'Filter' },
  { ruleId: 'FILTER-EQUIP-STATE',    ruleName: '설비 상태 필터',                 ruleClassId: 'equipment',      ruleType: 'Filter' },
  { ruleId: 'FILTER-EQUIP-RECIPE',   ruleName: '레시피 유형 매칭 필터',          ruleClassId: 'equipment',      ruleType: 'Filter' },
  { ruleId: 'FILTER-EQUIP-LOAD',     ruleName: '설비 부하율 임계값 필터',        ruleClassId: 'equipment',      ruleType: 'Filter' },
  { ruleId: 'FILTER-EQUIP-HEARTBEAT',ruleName: '최근 Heartbeat 설비 필터',       ruleClassId: 'equipment',      ruleType: 'Filter' },
  { ruleId: 'FILTER-EQUIP-TYPE',     ruleName: '설비 유형 필터',                 ruleClassId: 'equipment',      ruleType: 'Filter' },
  { ruleId: 'FILTER-CARRIER-STATE',  ruleName: 'Lot 상태 필터',                  ruleClassId: 'carrier',        ruleType: 'Filter' },
  { ruleId: 'FILTER-CARRIER-PRIORITY',ruleName:'긴급 우선순위 Lot 필터',         ruleClassId: 'carrier',        ruleType: 'Filter' },
  { ruleId: 'FILTER-CARRIER-DUEDATE',ruleName: '납기 임박 Lot 필터',             ruleClassId: 'carrier',        ruleType: 'Filter' },
  { ruleId: 'SORT-EQUIP-LOAD',       ruleName: '설비 부하 오름차순 정렬',        ruleClassId: 'equipment',      ruleType: 'Sort'   },
  { ruleId: 'SORT-EQUIP-CAPACITY',   ruleName: '설비 여유 용량 내림차순 정렬',   ruleClassId: 'equipment',      ruleType: 'Sort'   },
  { ruleId: 'SORT-CARRIER-PRIORITY', ruleName: '캐리어 우선순위 오름차순 정렬',  ruleClassId: 'carrier',        ruleType: 'Sort'   },
  { ruleId: 'SORT-CARRIER-DUEDATE',  ruleName: '납기 기한 오름차순 정렬',        ruleClassId: 'carrier',        ruleType: 'Sort'   },
];

const GROUP_CONTEXT = { ruleGroupName: 'LOAD_COMPLETE 배차 기준 룰', ruleGroupType: 'STANDARD' };

export const FIXTURES: FixtureInput[] = [
  // ─── 단순 조건 (6) ───────────────────────────────────────────────
  {
    id: 1, category: 'simple',
    prompt: '설비 가용(availability=true) 여부만 기준으로 후보 설비 목록을 생성하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 2, category: 'simple',
    prompt: '현재 부하(current_load)가 낮은 설비 순으로 정렬하여 반환하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 3, category: 'simple',
    prompt: '설비 상태(state)가 Online인 설비만 후보로 포함하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 4, category: 'simple',
    prompt: 'HOLD 상태가 아닌 Lot만 후보로 포함하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 5, category: 'simple',
    prompt: '납기(due_time)가 가장 빠른 Lot을 최우선으로 처리하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 6, category: 'simple',
    prompt: '여유 용량(capacity - current_load)이 가장 큰 설비 순으로 정렬하여 반환하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  // ─── 복합 조건 (9) ───────────────────────────────────────────────
  {
    id: 7, category: 'complex',
    prompt: '레시피 유형이 현재 요청 설비(:equipmentId)와 동일하고 가용(availability=true)인 설비를 부하 낮은 순으로 반환하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 8, category: 'complex',
    prompt: 'Lot 상태가 WAIT이고 우선순위(priority)가 1인 Lot을 납기 기한 오름차순으로 정렬하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 9, category: 'complex',
    prompt: '설비 유형(equipment_type)이 Process이고 availability가 true이며 current_load가 3 이하인 설비만 포함하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 10, category: 'complex',
    prompt: '가용하고 현재 부하가 capacity의 50% 이하인 설비만 후보로 포함하고 부하 낮은 순으로 정렬하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 11, category: 'complex',
    prompt: '레시피 유형이 요청 설비와 일치하고 납기 기한이 가장 임박한 Lot을 최우선으로 반환하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 12, category: 'complex',
    prompt: '공정 단계(process_step)가 :eventType과 일치하는 Lot만 대상으로 우선순위 순 처리하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 13, category: 'complex',
    prompt: '현재 레이아웃(:layoutId)에 속한 설비 중 가용하고 부하가 낮은 설비를 선택하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 14, category: 'complex',
    prompt: '우선순위 1~2인 Lot만 필터하고 납기 기한 오름차순으로 정렬하여 반환하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 15, category: 'complex',
    prompt: '자재 유형(material_type)이 요청 캐리어(:carrierId)와 동일한 Lot을 우선순위 오름차순으로 정렬하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  // ─── 정렬 포함 복합 (5) ──────────────────────────────────────────
  {
    id: 16, category: 'sort',
    prompt: '설비 상태가 Online이고 가용 가능한 설비를 여유 용량 내림차순으로 정렬하여 반환하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 17, category: 'sort',
    prompt: '최근 10분 이내(last_heartbeat_at)에 갱신된 설비 중 가용하고 부하가 낮은 순으로 정렬하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 18, category: 'sort',
    prompt: '설비 유형이 Process이고 인라인 스토커(inline_stocker=true)인 설비를 부하 낮은 순으로 반환하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 19, category: 'sort',
    prompt: 'HOLD 상태가 아닌 Lot을 우선순위 오름차순, 같은 우선순위면 납기 기한 빠른 순으로 정렬하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 20, category: 'sort',
    prompt: '가용하고 레시피가 일치하는 설비를 여유 용량 내림차순 후 부하 오름차순으로 정렬하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  // ─── Fallback (jumpNextSequence 포함, 5) ─────────────────────────
  {
    id: 21, category: 'fallback',
    prompt: 'Online 설비 중 부하 낮은 순으로 우선 선택하고, Online 후보가 없으면 Standby 상태까지 포함하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 22, category: 'fallback',
    prompt: '우선순위(priority) 1인 Lot이 있으면 먼저 처리하고, 없으면 우선순위 2인 Lot을 납기 기한 순으로 처리하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 23, category: 'fallback',
    prompt: '가용(availability=true) 설비가 있으면 바로 선택하고, 없으면 현재 부하가 낮은 설비라도 포함하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 24, category: 'fallback',
    prompt: '부하가 0인 완전 유휴 설비가 있으면 우선 배정하고, 없으면 부하 50% 이하 설비로 범위를 확장하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
  {
    id: 25, category: 'fallback',
    prompt: 'Lot 상태가 WAIT이고 납기가 2시간 이내인 긴급 Lot이 있으면 먼저 디스패칭하고, 없으면 전체 WAIT Lot을 납기 기한 순으로 처리하세요.',
    groupContext: GROUP_CONTEXT, ruleDefs: MOCK_RULE_DEFS,
  },
];
