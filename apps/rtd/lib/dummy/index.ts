import type {
  RuleGroup,
  RuleObject,
  RuleRelation,
  RuleDef,
  RuleRunningResult,
  RuleClass,
} from '@workspace/types/rtd';

/** 더미 룰 그룹 목록 */
export const DUMMY_RULE_GROUPS: RuleGroup[] = [
  { ruleGroupId: 'RG001', ruleGroupName: 'EQP_FULL_STK01', ruleGroupType: 'DISPATCHING', isUsable: 'Y', description: '스토커 01 풀 상태 디스패칭 룰' },
  { ruleGroupId: 'RG002', ruleGroupName: 'EQP_EMPTY_STK01', ruleGroupType: 'DISPATCHING', isUsable: 'Y', description: '스토커 01 공 상태 디스패칭 룰' },
  { ruleGroupId: 'RG003', ruleGroupName: 'EQP_COMMON_DEFAULT', ruleGroupType: 'DISPATCHING', isUsable: 'Y', description: '공통 Fallback 룰' },
  { ruleGroupId: 'RG004', ruleGroupName: 'EQP_FULL_STK02', ruleGroupType: 'DISPATCHING', isUsable: 'N', description: '스토커 02 풀 상태 (비활성)' },
];

/** 더미 룰 클래스 목록 */
export const DUMMY_RULE_CLASSES: RuleClass[] = [
  { ruleClassId: 'RC001', ruleClassName: 'URGENT', ruleClassType: 'PRIORITY' },
  { ruleClassId: 'RC002', ruleClassName: 'NORMAL', ruleClassType: 'PRIORITY' },
  { ruleClassId: 'RC003', ruleClassName: 'LOT_FILTER', ruleClassType: 'FILTER' },
];

/** 더미 룰 정의 목록 */
export const DUMMY_RULE_DEFS: RuleDef[] = [
  { ruleId: 'R001', ruleName: '긴급 Lot 조회', ruleClassId: 'RC001', ruleType: 'Data', ruleCondition: 'URGENT_FLAG = Y' },
  { ruleId: 'R002', ruleName: '일반 Lot 조회', ruleClassId: 'RC002', ruleType: 'Data', ruleCondition: '' },
  { ruleId: 'R003', ruleName: '장비 필터', ruleClassId: 'RC003', ruleType: 'Filter', ruleCondition: 'EQP_STATE = IDLE' },
  { ruleId: 'R004', ruleName: '우선순위 정렬', ruleClassId: 'RC002', ruleType: 'Sort', ruleCondition: '' },
  { ruleId: 'R005', ruleName: 'Lot 서브데이터', ruleClassId: 'RC002', ruleType: 'SubData', ruleCondition: '' },
];

/** 더미 룰 오브젝트(매핑) 목록 */
export const DUMMY_RULE_OBJECTS: RuleObject[] = [
  { ruleObjectId: 'STK01', ruleEventId: 'EVT_FULL', siteId: 'SITE01', ruleGroupId: 'RG001', isUsable: 'Y' },
  { ruleObjectId: 'STK01', ruleEventId: 'EVT_EMPTY', siteId: 'SITE01', ruleGroupId: 'RG002', isUsable: 'Y' },
  { ruleObjectId: 'STK02', ruleEventId: 'EVT_FULL', siteId: 'SITE01', ruleGroupId: 'RG004', isUsable: 'N' },
];

/** 더미 룰 릴레이션(시퀀스) — RG001 기준 */
export const DUMMY_RULE_RELATIONS: RuleRelation[] = [
  { ruleGroupId: 'RG001', ruleId: 'R001', sequence: 1, isMandatory: 'Y', filterSequence: null, jumpNextSequence: 3, jumpNextSequenceCondition: 'COUNT>0' },
  { ruleGroupId: 'RG001', ruleId: 'R002', sequence: 2, isMandatory: 'N', filterSequence: 1, jumpNextSequence: null, jumpNextSequenceCondition: null },
  { ruleGroupId: 'RG001', ruleId: 'R003', sequence: 3, isMandatory: 'O', filterSequence: 2, jumpNextSequence: null, jumpNextSequenceCondition: null },
  { ruleGroupId: 'RG001', ruleId: 'R004', sequence: 4, isMandatory: 'N', filterSequence: 3, jumpNextSequence: null, jumpNextSequenceCondition: null },
];

/** 더미 룰 실행 결과 목록 */
export const DUMMY_RUNNING_RESULTS: RuleRunningResult[] = [
  { uuid: 'UUID001', lotId: 'LOT-2024-001', ruleId: 'R001', sequence: 1, count: 5, startTime: '2024-03-30T09:00:00', endTime: '2024-03-30T09:00:01', isDispatching: 'Y' },
  { uuid: 'UUID002', lotId: 'LOT-2024-001', ruleId: 'R003', sequence: 3, count: 3, startTime: '2024-03-30T09:00:01', endTime: '2024-03-30T09:00:02', isDispatching: 'Y' },
  { uuid: 'UUID003', lotId: 'LOT-2024-002', ruleId: 'R001', sequence: 1, count: 0, startTime: '2024-03-30T09:05:00', endTime: '2024-03-30T09:05:00', isDispatching: 'N' },
  { uuid: 'UUID004', lotId: 'LOT-2024-002', ruleId: 'R002', sequence: 2, count: 8, startTime: '2024-03-30T09:05:00', endTime: '2024-03-30T09:05:01', isDispatching: 'Y' },
  { uuid: 'UUID005', lotId: 'LOT-2024-003', ruleId: 'R001', sequence: 1, count: 2, startTime: '2024-03-30T09:10:00', endTime: '2024-03-30T09:10:01', isDispatching: 'Y' },
  { uuid: 'UUID006', lotId: 'LOT-2024-004', ruleId: 'R003', sequence: 3, count: 1, startTime: '2024-03-30T09:15:00', endTime: '2024-03-30T09:15:00', isDispatching: 'Y' },
  { uuid: 'UUID007', lotId: 'LOT-2024-005', ruleId: 'R002', sequence: 2, count: 4, startTime: '2024-03-30T09:20:00', endTime: '2024-03-30T09:20:01', isDispatching: 'N' },
];

/** 더미 통계 — 일별 실행 건수 */
export const DUMMY_DAILY_STATS = [
  { date: '03/24', count: 142 },
  { date: '03/25', count: 198 },
  { date: '03/26', count: 165 },
  { date: '03/27', count: 210 },
  { date: '03/28', count: 88 },
  { date: '03/29', count: 95 },
  { date: '03/30', count: 173 },
];

/** 더미 통계 — 룰 클래스별 평균 소요시간(ms) */
export const DUMMY_CLASS_STATS = [
  { className: 'URGENT', avgDuration: 45 },
  { className: 'NORMAL', avgDuration: 120 },
  { className: 'LOT_FILTER', avgDuration: 30 },
];

/** 더미 통계 — 룰 히트율 순위 */
export const DUMMY_HIT_RATE_STATS = [
  { ruleName: '긴급 Lot 조회', hitRate: 78, count: 134 },
  { ruleName: '일반 Lot 조회', hitRate: 92, count: 158 },
  { ruleName: '장비 필터', hitRate: 65, count: 112 },
  { ruleName: '우선순위 정렬', hitRate: 88, count: 151 },
];

// ─────────────────────────────────────────────
// 노드 설정 사이드 패널용 메타데이터
// ─────────────────────────────────────────────

export interface ColumnMeta {
  name: string;
  label: string;
  type: 'string' | 'number' | 'select';
  options?: string[];
}

export interface TableMeta {
  id: string;
  label: string;
  joinKey: string;
  columns: ColumnMeta[];
}

/** 기준 테이블 메타데이터 — Phase 3에서 API로 대체 */
export const TABLE_METADATA: TableMeta[] = [
  {
    id: 'LOT',
    label: 'LOT (Lot 정보)',
    joinKey: 'LOT_ID',
    columns: [
      { name: 'LOT_ID', label: 'Lot ID', type: 'string' },
      { name: 'LOT_STATE', label: 'Lot 상태', type: 'select', options: ['WAIT', 'RUN', 'HOLD', 'COMPLETE'] },
      { name: 'PRIORITY', label: '우선순위', type: 'number' },
      { name: 'EQP_ID', label: '설비 ID', type: 'string' },
      { name: 'CARRIER_ID', label: 'Carrier ID', type: 'string' },
      { name: 'ROUTE_ID', label: '공정 경로 ID', type: 'string' },
      { name: 'URGENT_FLAG', label: '긴급 여부', type: 'select', options: ['Y', 'N'] },
    ],
  },
  {
    id: 'EQUIPMENT',
    label: 'EQUIPMENT (설비)',
    joinKey: 'EQP_ID',
    columns: [
      { name: 'EQP_ID', label: '설비 ID', type: 'string' },
      { name: 'EQP_STATE', label: '설비 상태', type: 'select', options: ['IDLE', 'RUN', 'DOWN', 'PM'] },
      { name: 'EQP_TYPE', label: '설비 유형', type: 'string' },
      { name: 'SITE_ID', label: '사이트 ID', type: 'string' },
    ],
  },
  {
    id: 'CARRIER',
    label: 'CARRIER (반송 용기)',
    joinKey: 'CARRIER_ID',
    columns: [
      { name: 'CARRIER_ID', label: 'Carrier ID', type: 'string' },
      { name: 'CARRIER_STATE', label: 'Carrier 상태', type: 'select', options: ['EMPTY', 'FULL', 'IN_TRANSIT'] },
      { name: 'LOT_ID', label: 'Lot ID', type: 'string' },
      { name: 'LOCATION', label: '현재 위치', type: 'string' },
    ],
  },
  {
    id: 'ROUTE',
    label: 'ROUTE (공정 경로)',
    joinKey: 'ROUTE_ID',
    columns: [
      { name: 'ROUTE_ID', label: '경로 ID', type: 'string' },
      { name: 'STEP_SEQ', label: '공정 순서', type: 'number' },
      { name: 'PROCESS_ID', label: '공정 ID', type: 'string' },
    ],
  },
];

// ─────────────────────────────────────────────
// 이벤트 파라미터 메타데이터 (기준정보)
// MES → RTD 로 loadRequest/unloadRequest 시 전달되는 파라미터 정의
// ─────────────────────────────────────────────

export interface EventParamMeta {
  key: string;    // 내부 키 (equipId)
  label: string;  // 비개발자용 한글 ("요청한 설비")
}

export interface EventMeta {
  eventId: string;
  eventName: string;
  params: EventParamMeta[];
}

/** 이벤트별 전달 파라미터 메타데이터 — Phase 3에서 API로 대체 */
export const EVENT_METADATA: EventMeta[] = [
  {
    eventId: 'EVT_FULL',
    eventName: '설비 Full 이벤트',
    params: [
      { key: 'equipId', label: '요청한 설비' },
      { key: 'eventType', label: '이벤트 유형' },
      { key: 'siteId', label: '요청 사이트' },
    ],
  },
  {
    eventId: 'EVT_EMPTY',
    eventName: '설비 Empty 이벤트',
    params: [
      { key: 'equipId', label: '요청한 설비' },
      { key: 'eventType', label: '이벤트 유형' },
      { key: 'siteId', label: '요청 사이트' },
    ],
  },
  {
    eventId: 'EVT_MOVE',
    eventName: '반송 이동 이벤트',
    params: [
      { key: 'equipId', label: '요청한 설비' },
      { key: 'carrierId', label: '요청 Carrier' },
      { key: 'fromPort', label: '출발 포트' },
      { key: 'eventType', label: '이벤트 유형' },
      { key: 'siteId', label: '요청 사이트' },
    ],
  },
];

/** 블록별 결과 미리보기 더미 데이터 */
export const DUMMY_QUERY_PREVIEWS: Record<string, { columns: string[]; rows: string[][] }> = {
  R001: {
    columns: ['LOT_ID', 'PRIORITY', 'EQP_ID', 'LOT_STATE'],
    rows: [
      ['LOT-2024-001', '1', 'STK01', 'WAIT'],
      ['LOT-2024-003', '1', 'STK01', 'WAIT'],
      ['LOT-2024-007', '2', 'STK01', 'WAIT'],
    ],
  },
  R002: {
    columns: ['LOT_ID', 'PRIORITY', 'CARRIER_ID'],
    rows: [
      ['LOT-2024-002', '3', 'CR001'],
      ['LOT-2024-004', '5', 'CR002'],
      ['LOT-2024-009', '4', 'CR003'],
    ],
  },
  R003: {
    columns: ['LOT_ID', 'EQP_ID', 'EQP_STATE', 'LOT_STATE'],
    rows: [
      ['LOT-2024-001', 'STK01', 'IDLE', 'WAIT'],
      ['LOT-2024-003', 'STK01', 'IDLE', 'WAIT'],
    ],
  },
  R004: {
    columns: ['LOT_ID', 'PRIORITY', 'URGENT_FLAG'],
    rows: [
      ['LOT-2024-001', '1', 'Y'],
      ['LOT-2024-003', '1', 'Y'],
      ['LOT-2024-002', '3', 'N'],
    ],
  },
};
