/**
 * MES-RTD-MCS 시스템 간 JSON 메시지 프로토콜 타입 정의
 * 참조: docs/MESSAGE_PROTOCOL.md
 *
 * 모든 메시지는 동일한 봉투(MessageEnvelope)를 사용합니다.
 * RTD, MCS, 가상 MES 어디서든 공통으로 import해서 사용합니다.
 */

// ─── 발신/수신 시스템 식별자 ─────────────────────────────────────

export type SystemId = 'MES' | 'RTD' | 'MCS';

// ─── 메시지 유형 ─────────────────────────────────────────────────

export type MessageType =
  // MES → RTD
  | 'LOAD_REQUEST'
  | 'UNLOAD_REQUEST'
  | 'TRANSFER_REQUEST'
  // RTD → MES
  | 'DISPATCH_ACKNOWLEDGE'
  // RTD → MCS
  | 'DISPATCH_RESULT'
  // MCS → RTD
  | 'TRANSPORT_COMPLETE'
  | 'TRANSPORT_FAILED'
  // 공통
  | 'ERROR';

// ─── 공통 메시지 봉투 ────────────────────────────────────────────

export interface MessageHeader {
  /** 메시지 고유 ID (발신 시스템 생성) */
  messageId: string;
  /** 메시지 유형 */
  messageType: MessageType;
  /** 발신 시스템 */
  source: SystemId;
  /** 수신 시스템 */
  target: SystemId;
  /** ISO 8601 발신 시각 */
  timestamp: string;
  /** 요청-응답 추적 ID (동일 트랜잭션은 같은 값 유지) */
  correlationId: string;
  /** 공장 사이트 식별자 */
  siteId: string;
  /** 프로토콜 버전 */
  version: '1.0';
}

export interface MessageEnvelope<T = unknown> {
  header: MessageHeader;
  body: T;
}

// ─── 이벤트 유형 ─────────────────────────────────────────────────

export type EventType =
  | 'EVT_FULL'              // Stocker Full — Lot 반출 요청
  | 'EVT_EMPTY'             // 장비 Empty — Lot 투입 요청
  | 'EVT_MOVE'              // 특정 Lot 강제 이동
  | 'EVT_PROCESS_COMPLETE'; // 공정 완료

// ─── MES → RTD ───────────────────────────────────────────────────

/** LOAD_REQUEST body — Stocker Full 등 Lot 반출 요청 */
export interface LoadRequestBody {
  eventType: 'EVT_FULL' | 'EVT_PROCESS_COMPLETE';
  /** 요청 발생 장비 ID */
  equipmentId: string;
  /** 요청 발생 포트/유닛 ID */
  equipmentUnitId?: string;
  /** 대상 Lot (null이면 RTD가 룰로 선정) */
  lotId?: string | null;
  /** 캐리어(FOUP) ID */
  carrierId?: string;
  /** 우선순위 0–100 (높을수록 먼저) */
  priority?: number;
  /** RTD 룰 쿼리 바인딩용 추가 파라미터 */
  parameters?: Record<string, string | number | boolean>;
}

/** UNLOAD_REQUEST body — 장비 Empty, Lot 투입 요청 */
export interface UnloadRequestBody {
  eventType: 'EVT_EMPTY';
  equipmentId: string;
  equipmentUnitId?: string;
  /** 필요한 Lot 수 (기본값 1) */
  requestedLotCount?: number;
  /** 다음 공정 단계 */
  processStep?: string;
  parameters?: Record<string, string | number | boolean>;
}

/** TRANSFER_REQUEST body — 특정 Lot 강제 이동 */
export interface TransferRequestBody {
  eventType: 'EVT_MOVE';
  lotId: string;
  carrierId?: string;
  sourceEquipmentId: string;
  sourceUnitId?: string;
  destEquipmentId: string;
  destUnitId?: string;
  /** 우선순위 0–100 */
  priority?: number;
  /** 이동 사유 (예: URGENT_MOVE, MAINTENANCE) */
  reason?: string;
  parameters?: Record<string, string | number | boolean>;
}

// ─── RTD → MES ───────────────────────────────────────────────────

export type DispatchAckStatus = 'ACCEPTED' | 'NO_LOT' | 'RULE_ERROR' | 'REJECTED';

/** DISPATCH_ACKNOWLEDGE body — RTD → MES 디스패칭 처리 응답 */
export interface DispatchAcknowledgeBody {
  /** 처리 결과 */
  status: DispatchAckStatus;
  /** 실행된 룰 그룹 ID */
  ruleGroupId: string;
  /** 선정된 Lot ID (status=ACCEPTED 시) */
  selectedLotId?: string | null;
  /** 목적지 장비 ID */
  destEquipmentId?: string | null;
  /** 거부/실패 사유 */
  reason?: string | null;
}

// ─── RTD → MCS ───────────────────────────────────────────────────

export interface DispatchedLot {
  lotId: string;
  carrierId?: string;
  /** 디스패칭 우선순위 */
  priority: number;
  sourceEquipmentId: string;
  sourceUnitId?: string;
  destEquipmentId: string;
  destUnitId?: string;
}

export interface SequenceExecutionResult {
  sequence: number;
  ruleId: string;
  ruleType: string;
  count: number;
}

export interface DispatchExecutionSummary {
  totalSequences: number;
  /** 전체 룰 실행 소요시간(ms) */
  totalDuration: number;
  sequences: SequenceExecutionResult[];
}

/** DISPATCH_RESULT body — RTD → MCS 디스패칭 결과 */
export interface DispatchResultBody {
  ruleGroupId: string;
  /** 디스패칭 유형 */
  dispatchType: 'DISPATCHING' | 'ROUTING';
  /** 선정된 Lot 목록 (Sort 룰로 다건 가능) */
  lots: DispatchedLot[];
  /** 룰 실행 요약 (모니터링/디버깅용) */
  executionSummary: DispatchExecutionSummary;
}

// ─── MCS → RTD ───────────────────────────────────────────────────

export type TransportStatus = 'COMPLETED' | 'FAILED' | 'CANCELLED';

/** TRANSPORT_COMPLETE body — MCS → RTD 반송 완료 알림 */
export interface TransportCompleteBody {
  /** MCS MacroCommand ID */
  commandId: string;
  status: 'COMPLETED';
  lotId: string;
  carrierId?: string;
  sourceEquipmentId: string;
  sourceUnitId?: string;
  destEquipmentId: string;
  destUnitId?: string;
  startTime: string;
  endTime: string;
  /** 반송 소요시간(ms) */
  transportDuration: number;
  /** 실제 경유한 Unit ID 경로 */
  route: string[];
  /** 사용된 경로 알고리즘 */
  algorithm: 'ASTAR' | 'AI_PPO';
  /** 완료 후 RTD가 다음 디스패칭을 자동 트리거할지 여부 */
  triggerNextDispatch: boolean;
}

/** TRANSPORT_FAILED body — MCS → RTD 반송 실패 알림 */
export interface TransportFailedBody {
  commandId: string;
  status: 'FAILED' | 'CANCELLED';
  lotId: string;
  carrierId?: string;
  /** 실패 사유 코드 */
  failureReason: string;
  /** 실패 발생 지점 Unit ID */
  failedAtUnitId?: string;
  /** 재시도 가능 여부 */
  retryable: boolean;
  /** 에러 코드 */
  errorCode?: string;
}

// ─── 공통 에러 ───────────────────────────────────────────────────

/** ERROR body — 공통 에러 응답 */
export interface ErrorBody {
  errorCode: string;
  errorMessage: string;
  severity: 'ERROR' | 'WARNING';
  details?: Record<string, unknown>;
}

// ─── 타입별 봉투 단축 타입 ──────────────────────────────────────

export type LoadRequestMessage      = MessageEnvelope<LoadRequestBody>;
export type UnloadRequestMessage    = MessageEnvelope<UnloadRequestBody>;
export type TransferRequestMessage  = MessageEnvelope<TransferRequestBody>;
export type DispatchAckMessage      = MessageEnvelope<DispatchAcknowledgeBody>;
export type DispatchResultMessage   = MessageEnvelope<DispatchResultBody>;
export type TransportCompleteMessage = MessageEnvelope<TransportCompleteBody>;
export type TransportFailedMessage  = MessageEnvelope<TransportFailedBody>;
export type ErrorMessage            = MessageEnvelope<ErrorBody>;

/** 수신 가능한 모든 메시지 유니온 */
export type AnyMessage =
  | LoadRequestMessage
  | UnloadRequestMessage
  | TransferRequestMessage
  | DispatchAckMessage
  | DispatchResultMessage
  | TransportCompleteMessage
  | TransportFailedMessage
  | ErrorMessage;
