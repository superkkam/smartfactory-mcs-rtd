/**
 * RTD DMS 엔티티 인터페이스 정의
 * 기존 Java/Spring 백엔드 DMS 엔티티를 DB 스키마 변경 없이 재사용
 */

/** 룰 그룹 (DMS_RULE_GROUP_DEF) */
export interface RuleGroup {
  ruleGroupId: string;
  ruleGroupName: string;
  /** 그룹 유형: DISPATCHING | ROUTING */
  ruleGroupType: string;
  /** 사용 여부: Y | N */
  isUsable: string;
  description?: string;
}

/** 장비-이벤트-룰그룹 매핑 (DMS_RULE_OBJECT) */
export interface RuleObject {
  /** 장비 단위 ID (복합 PK) */
  ruleObjectId: string;
  /** 이벤트 유형 ID (복합 PK) */
  ruleEventId: string;
  /** 사이트 식별자 (복합 PK) */
  siteId: string;
  /** 연결된 룰 그룹 ID → RuleGroup */
  ruleGroupId: string;
  /** 사용 여부: Y | N */
  isUsable: string;
}

/** 룰 실행 시퀀스 (DMS_RULE_RELATION) */
export interface RuleRelation {
  /** 속한 룰 그룹 ID (복합 PK) → RuleGroup */
  ruleGroupId: string;
  /** 실행할 룰 ID (복합 PK) → RuleDef */
  ruleId: string;
  /** 실행 순서 번호 (복합 PK) */
  sequence: number;
  /** 필수 여부: Y | N | O */
  isMandatory: string;
  /** 이전 시퀀스 참조 번호 (filterSequence 화살표) */
  filterSequence?: number | null;
  /** 조건부 점프 목적 시퀀스 번호 */
  jumpNextSequence?: number | null;
  /** 점프 조건: COUNT>0 | COUNT=0 */
  jumpNextSequenceCondition?: string | null;
  /** 연결된 정렬 ID → RuleSort */
  ruleSortId?: string | null;
}

/** 룰 정의 (DMS_RULE_DEF) */
export interface RuleDef {
  ruleId: string;
  ruleName: string;
  /** 룰 클래스 분류 ID → RuleClass */
  ruleClassId: string;
  /** 룰 유형: Data | SubData | Filter | Join | Groupby | Sort | Method */
  ruleType: string;
  /** 룰 적용 조건 */
  ruleCondition?: string;
}

/** SQL 쿼리 정의 (DMS_RULE_QUERY) */
export interface RuleQuery {
  /** 쿼리 ID (복합 PK) */
  ruleQueryId: string;
  /** 버전 (복합 PK) */
  ruleQueryVersion: string;
  /** 쿼리 빌더가 자동 생성한 SQL 문자열 (최대 4000자) */
  ruleQueryString: string;
  /** 쿼리 유형 */
  ruleQueryType?: string;
}

/** 정렬 조건 (DMS_RULE_SORT) */
export interface RuleSort {
  ruleSortId: string;
  /** 정렬 컬럼명 */
  sortColumn: string;
  /** 가중치 */
  weightValue?: number;
  /** 적용 범위 시작 백분율 */
  fromPercent?: number;
  /** 적용 범위 끝 백분율 */
  toPercent?: number;
  /** ASC | DESC */
  orderBy: string;
}

/** 쿼리 파라미터 바인딩 (DMS_RULE_QUERY_PARAM) */
export interface RuleQueryParam {
  /** 쿼리 ID (복합 PK) → RuleQuery */
  ruleQueryId: string;
  /** 버전 (복합 PK) → RuleQuery */
  ruleQueryVersion: string;
  /** 바인딩 파라미터 키 (복합 PK) */
  paramKey: string;
  /** 바인딩 파라미터 값 */
  paramValue: string;
  /** 대상 컬럼명 */
  targetColumn: string;
}

/** 룰 클래스 분류 (DMS_RULE_CLASS) */
export interface RuleClass {
  ruleClassId: string;
  ruleClassName: string;
  /** 룰 클래스 유형 (F009 통계 집계 기준) */
  ruleClassType: string;
}

/** 룰 실행 결과 (DMS_RULE_RUNNING_RESULT) */
export interface RuleRunningResult {
  /** 자동 생성 고유 키 */
  uuid: string;
  /** 처리 대상 Lot ID */
  lotId: string;
  /** 실행된 룰 ID → RuleDef */
  ruleId: string;
  /** 실행 시퀀스 번호 */
  sequence: number;
  /** 결과 건수 */
  count: number;
  /** 실행 시작 시간 */
  startTime: string;
  /** 실행 종료 시간 */
  endTime: string;
  /** 디스패칭 적용 여부: Y | N */
  isDispatching: string;
}

// ─── 시뮬레이터 타입 ────────────────────────────────────────────

/** 시뮬레이션 요청 */
export interface SimulationRequest {
  ruleGroupId: string;
  equipId: string;
  eventType: string;
}

/** 시퀀스별 시뮬레이션 결과 */
export interface SimulationSequenceResult {
  sequence: number;
  ruleId: string;
  ruleName: string;
  ruleType: string;
  /** null = 쿼리 미존재 */
  count: number | null;
  /** 서버 처리 소요시간(ms) */
  duration: number;
  /** 쿼리 존재 여부 */
  hasQuery: boolean;
  /** SQL 앞 100자 미리보기 (쿼리 존재 시) */
  queryPreview?: string;
}

/** 유효성 검증 결과 단건 */
export interface ValidationIssue {
  severity: 'error' | 'warning';
  /** 관련 시퀀스 번호 (전체 이슈면 null) */
  sequence: number | null;
  message: string;
}

/** 시뮬레이션 응답 */
export interface SimulationResponse {
  valid: boolean;
  validationIssues: ValidationIssue[];
  results: SimulationSequenceResult[];
  /** 전체 서버 처리 소요시간(ms) */
  totalDuration: number;
}
