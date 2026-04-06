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
