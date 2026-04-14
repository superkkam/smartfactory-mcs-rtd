/**
 * RTD 공통 상수 정의
 */

/** 룰 유형 */
export const RULE_TYPES = {
  DATA: 'Data',
  SUB_DATA: 'SubData',
  FILTER: 'Filter',
  JOIN: 'Join',
  GROUPBY: 'Groupby',
  SORT: 'Sort',
  METHOD: 'Method',
} as const;
export type RuleType = (typeof RULE_TYPES)[keyof typeof RULE_TYPES];

/** 룰 그룹 유형 */
export const RULE_GROUP_TYPES = {
  DISPATCHING: 'DISPATCHING',
  ROUTING: 'ROUTING',
} as const;
export type RuleGroupType = (typeof RULE_GROUP_TYPES)[keyof typeof RULE_GROUP_TYPES];

/** 시퀀스 필수 여부 */
export const MANDATORY_VALUES = {
  YES: 'Y',
  NO: 'N',
  OPTIONAL: 'O',
} as const;
export type MandatoryValue = (typeof MANDATORY_VALUES)[keyof typeof MANDATORY_VALUES];

/** 정렬 방향 */
export const ORDER_DIRECTIONS = {
  ASC: 'ASC',
  DESC: 'DESC',
} as const;
export type OrderDirection = (typeof ORDER_DIRECTIONS)[keyof typeof ORDER_DIRECTIONS];

/** 조건부 점프 조건 */
export const JUMP_CONDITIONS = {
  COUNT_GT_ZERO: 'COUNT>0',
  COUNT_EQ_ZERO: 'COUNT=0',
} as const;
export type JumpCondition = (typeof JUMP_CONDITIONS)[keyof typeof JUMP_CONDITIONS];

/** 사용 여부 */
export const USABLE_VALUES = {
  YES: 'Y',
  NO: 'N',
} as const;
export type UsableValue = (typeof USABLE_VALUES)[keyof typeof USABLE_VALUES];

// ─────────────────────────────────────────────────────────────────
// MCS 공통 상수 정의
// ─────────────────────────────────────────────────────────────────

/** 장비 유형 */
export const EQUIPMENT_TYPES = {
  STOCKER: 'Stocker',
  CONVEYOR: 'Conveyor',
  PROCESS: 'Process',
  OHT: 'OHT',
  AGV: 'AGV',
} as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[keyof typeof EQUIPMENT_TYPES];

/** 장비 단위 유형 */
export const UNIT_TYPES = {
  PORT:  'Port',
  NODE:  'Node',   // AMR 경로망 경유 노드 (구 Waypoint)
  CRANE: 'Crane',
  AGV:   'AGV',
} as const;
export type UnitType = (typeof UNIT_TYPES)[keyof typeof UNIT_TYPES];

/** 유닛 입출 모드 */
export const IN_OUT_MODES = {
  IN: 'In',
  OUT: 'Out',
  BOTH: 'Both',
} as const;
export type InOutMode = (typeof IN_OUT_MODES)[keyof typeof IN_OUT_MODES];

/** 장비 상태 */
export const EQUIPMENT_STATES = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  ERROR: 'Error',
} as const;
export type EquipmentState = (typeof EQUIPMENT_STATES)[keyof typeof EQUIPMENT_STATES];

/** 반송 명령 상태 */
export const COMMAND_STATES = {
  PENDING: 'Pending',
  IN_PROGRESS: 'InProgress',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
} as const;
export type CommandState = (typeof COMMAND_STATES)[keyof typeof COMMAND_STATES];

/** 캐리어 상태 */
export const CARRIER_STATES = {
  INSTALLED: 'Installed',
  TRANSFERRING: 'Transferring',
  STORED: 'Stored',
} as const;
export type CarrierState = (typeof CARRIER_STATES)[keyof typeof CARRIER_STATES];

/** Lot 진행 상태 (mcs_carrier.lot_state) */
export const LOT_STATES = {
  WAIT: 'WAIT',           // 디스패칭 대기 중 (가장 흔한 필터 조건)
  PROCESSING: 'PROCESSING', // 설비에서 처리 중
  DONE: 'DONE',           // 처리 완료
  HOLD: 'HOLD',           // 일시 보류 (디스패칭 제외)
} as const;
export type LotState = (typeof LOT_STATES)[keyof typeof LOT_STATES];

/** 경로 탐색 알고리즘 유형 */
export const ALGORITHM_TYPES = {
  ASTAR: 'astar',
  AI_PPO: 'ai_ppo',
} as const;
export type AlgorithmType = (typeof ALGORITHM_TYPES)[keyof typeof ALGORITHM_TYPES];

/** 시뮬레이션 실행 상태 */
export const SIMULATION_STATUSES = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
} as const;
export type SimulationStatus = (typeof SIMULATION_STATUSES)[keyof typeof SIMULATION_STATUSES];
