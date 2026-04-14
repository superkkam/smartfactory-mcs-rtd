/**
 * MCS(물류 제어 시스템) 관련 타입 정의
 * 참조: .taskmaster/docs/prd-mcs.md 데이터 모델
 */

// ─── 공통 기반 ────────────────────────────────────────────────────

/** 모든 MCS 엔티티 공통 필드 */
interface McsBaseEntity {
  id: string;
  createdAt?: string;
}

// ─── 레이아웃 기준정보 ────────────────────────────────────────────

/** 레이아웃 저장 — React Flow JSON 직렬화 데이터 포함 */
export interface Layout extends McsBaseEntity {
  /** 레이아웃 식별 ID */
  designId: string;
  /** 레이아웃 이름 */
  designName: string;
  /** 버전 번호 (1부터 증가) */
  version: number;
  /** React Flow 직렬화 JSON (노드/엣지 전체) */
  jsonData: Record<string, unknown>;
  /** 공장 사이트 식별자 */
  siteId: string;
}

/** 장비 — 레이아웃 모델러에서 생성·관리 */
export interface Equipment extends McsBaseEntity {
  /** 장비 ID (예: B1STK101) */
  equipmentId: string;
  /** 상위 레이아웃 → Layout.id */
  layoutId: string;
  /** 장비 유형 (Stocker / Conveyor / Process / OHT / AGV) */
  equipmentType: string;
  /** 제어 서버 ID (CCS / ACS / OCS) */
  ecServerName: string;
  /** 인라인 스토커 여부 */
  inlineStocker: boolean;
  /** 현재 상태 — 실시간 갱신 */
  state: string;
  /**
   * 이동형 장비(AGV/AMR)의 현재 path 노드 위치 → EquipmentUnit.id
   * · 고정 장비(Stocker/Process)는 null
   * · ACS tick loop 이 이동 시마다 갱신
   */
  locationId: string | null;
  // ─── migration 004: 디스패칭 동적 컬럼 ───────────────────────
  /** 디스패칭 가용 여부 (state=Online 이어도 false 로 Hold 가능) */
  availability: boolean;
  /** 현재 점유 Lot 수 — ACS 갱신 */
  currentLoad: number;
  /** 수용 가능 최대 Lot 수 */
  capacity: number;
  /** 처리 가능 레시피/자재 유형 — carrier.processStep 과 매칭 */
  recipeType: string;
  /** 최근 상태 갱신 시각 — stale 판단 */
  lastHeartbeatAt: string;
}

/** 장비 단위 — 레이아웃 모델러에서 생성·관리 */
export interface EquipmentUnit extends McsBaseEntity {
  /** 유닛 ID (예: B1STK101_AI01) */
  equipmentUnitId: string;
  /** 상위 장비 참조 → Equipment.id */
  equipmentId: string;
  /** 유닛 유형 (Port / Crane / AGV) */
  unitType: string;
  /** 입출 모드 (In / Out / Both) */
  inOutMode: string;
  /** 반송 상태 */
  transferState: string;
  // ─── migration 004: 디스패칭 동적 컬럼 ───────────────────────
  /**
   * 이 포트/유닛에 현재 점유 중인 캐리어 → Carrier.id
   * · null = 포트 비어있음 (디스패칭 Filter 룰에서 IS NULL 조건)
   * · mcs_carrier.location_id 와 쌍대 관계 — ACS 트랜잭션으로 동기화
   */
  currentCarrierId: string | null;
  /** 이 유닛을 예약한 매크로 명령 → MacroCommand.id (null=미예약) */
  reservedByCommandId: string | null;
  /** 이 포트/유닛 앞 대기 캐리어 수 (FIFO/LRU 룰 보조) */
  queueLength: number;
  /** transfer_state 마지막 변경 시각 (LRU 기반 룰) */
  lastStateChangedAt: string;
}

/** 구간 연결 — 레이아웃 모델러에서 생성·관리 */
export interface TransferRelation extends McsBaseEntity {
  /** 상위 레이아웃 → Layout.id */
  layoutId: string;
  /** 구간 출발 유닛 → EquipmentUnit.id */
  departureUnitId: string;
  /** 구간 도착 유닛 → EquipmentUnit.id */
  arrivalUnitId: string;
  /** 반송을 담당하는 제어 서버 → Equipment.id */
  transportEquipmentId: string;
  /** 정적 가중치 (경로 비용 기준) */
  weight: number;
}

// ─── 캐리어 ──────────────────────────────────────────────────────

/** 캐리어/자재 */
export interface Carrier extends McsBaseEntity {
  /** 캐리어 ID */
  carrierId: string;
  /** 캐리어 유형 */
  carrierType: string;
  /** 자재 유형 */
  materialType: string;
  /** 현재 위치 장비 → Equipment.id (소속 장비, 내부 포함) */
  currentEquipmentId: string;
  /**
   * 정밀 위치 — equipment_unit(포트/AMR body port) 참조 → EquipmentUnit.id
   * · null = 설비 내부(Stocker/Process 내부) → 대시보드에서 숨김
   * · non-null = 해당 unit 위 → 대시보드에서 표시
   */
  locationId: string | null;
  /** 상태 (Installed / Transferring / Stored) */
  state: string;
  // ─── migration 004: 디스패칭 동적 컬럼 ───────────────────────
  /** 적재된 Lot 식별자 (논문 프로토타입: Lot=Carrier 1:1) */
  lotId: string;
  /** Lot 진행 상태 (WAIT / PROCESSING / DONE / HOLD) */
  lotState: string;
  /** 디스패칭 우선순위 (1=최고, 5=기본) */
  priority: number;
  /** 납기 기한 — null=기한 없음 (EDD 기반 룰) */
  dueTime: string | null;
  /** 현재 공정 단계 ID — equipment.recipeType 과 매칭 */
  processStep: string;
}

// ─── 반송 명령 ────────────────────────────────────────────────────

/** 매크로 반송 명령 (출발 → 목적지) */
export interface MacroCommand extends McsBaseEntity {
  /** 명령 ID */
  commandId: string;
  /** 반송 대상 캐리어 → Carrier.id */
  carrierId: string;
  /** 출발지 장비 단위 → EquipmentUnit.id */
  sourceUnitId: string;
  /** 목적지 장비 단위 → EquipmentUnit.id */
  destUnitId: string;
  /** 상태 (Pending / InProgress / Completed / Failed) */
  state: string;
  /** 우선순위 */
  priority: number;
}

/** 마이크로 반송 명령 (구간 단위) */
export interface MicroCommand extends McsBaseEntity {
  /** 상위 매크로 명령 → MacroCommand.id */
  macroCommandId: string;
  /** 실행 순서 */
  sequence: number;
  /** 구간 출발 → EquipmentUnit.id */
  departureUnitId: string;
  /** 구간 도착 → EquipmentUnit.id */
  arrivalUnitId: string;
  /** 상태 */
  state: string;
  /**
   * 이 명령을 실행하는 AMR 장비 → Equipment.id
   * · null = 아직 미할당 (Pending)
   * · ACS tick loop 이 pick up 시 채움
   */
  executorEquipmentId: string | null;
}

// ─── 경로 탐색 ────────────────────────────────────────────────────

/** 경로 탐색 결과 기록 */
export interface RouteFindingResult extends McsBaseEntity {
  /** 연관 반송 명령 → MacroCommand.id */
  macroCommandId: string;
  /** 알고리즘 유형 (astar / ai_ppo) */
  algorithm: string;
  /** 경로 경유지 문자열 (Unit ID 목록) */
  route: string;
  /** 총 경로 비용 */
  totalCost: number;
}

// ─── 시뮬레이션 ──────────────────────────────────────────────────

/** 시뮬레이션 실행 요청 파라미터 */
export interface SimulationScenarioParams {
  /** 시뮬레이션 대상 레이아웃 ID */
  layoutId: string;
  /** 가상 캐리어 수 */
  carrierCount: number;
  /** 반송 요청 총 건수 */
  transferRequestCount: number;
  /** 시뮬레이션 시간 (초) */
  simulationDuration: number;
}

/** 시뮬레이션 실행 */
export interface SimulationRun extends McsBaseEntity {
  /** 시나리오 파라미터 */
  scenarioParams: SimulationScenarioParams;
  /** 실행 알고리즘 목록 (쉼표 구분) */
  algorithms: string;
  /** 상태 (Running / Completed / Failed) */
  status: string;
}

/** 시뮬레이션 성과 지표 */
export interface SimulationResult extends McsBaseEntity {
  /** 연관 시뮬레이션 → SimulationRun.id */
  simulationRunId: string;
  /** 알고리즘 유형 */
  algorithm: string;
  /** 평균 반송 시간 (초) */
  avgTransferTime: number;
  /** 단위 시간당 처리 건수 */
  throughput: number;
  /** 충돌/대기 횟수 */
  collisionCount: number;
  /** 부하 균형 표준편차 */
  loadBalanceStd: number;
  /** 장비 가동률 (%) */
  equipmentUtilization: number;
  /** 교착 발생 횟수 */
  deadlockCount: number;
  /** 경로 효율 점수 (0~100) */
  routeEfficiencyScore: number;
}

// ─── React Flow 커스텀 노드/엣지 타입 ────────────────────────────

/** React Flow 장비 노드 데이터 */
export interface EquipmentNodeData {
  equipment: Omit<Equipment, 'id' | 'createdAt'>;
  /** 노드 라벨 표시용 */
  label: string;
  /** 심볼 유형 (레이아웃 팔레트 분류) */
  symbolType: string;
}

/** React Flow 장비 단위 노드 데이터 */
export interface UnitNodeData {
  unit: Omit<EquipmentUnit, 'id' | 'createdAt'>;
  label: string;
}

/** React Flow AGV 경로 엣지 데이터 */
export interface TransferEdgeData {
  relation: Omit<TransferRelation, 'id' | 'createdAt'>;
  /** 경로 가중치 표시용 */
  weight: number;
}

// ─── AI 엔진 API 타입 ─────────────────────────────────────────────

/** Python FastAPI AI 추론 요청 */
export interface InferenceRequest {
  /** 현재 레이아웃 그래프 JSON */
  layoutId: string;
  /** 출발 유닛 ID */
  sourceUnitId: string;
  /** 목적지 유닛 ID */
  destUnitId: string;
  /** 동적 가중치 오버라이드 (장비 상태, 트래픽 반영) */
  dynamicWeights?: Record<string, number>;
}

/** AI 경로 탐색 단계 (ai-route-view.tsx AiRouteStep과 1:1) */
export interface AiRouteStep {
  /** 경유 유닛 ID */
  unitId: string;
  /** 경유 유닛 라벨 */
  unitLabel: string;
  /** 동적 가중치 (0~1) */
  weight: number;
  /** 혼잡도 팩터 (0~1) */
  congestionFactor: number;
  /** 예측 소요 시간 (ms) */
  predictedTimeMs: number;
}

/** Python FastAPI AI 추론 응답 */
export interface InferenceResponse {
  /** 추론된 경로 (AiRouteStep 배열) */
  route: AiRouteStep[];
  /** 경로 총 비용 */
  totalCost: number;
  /** 모델 신뢰도 (0~1) */
  confidence: number;
  /** 추론 소요시간 (ms) */
  inferenceTimeMs: number;
  /** A* 폴백 여부 (PPO 모델 미존재 시 true) */
  fallback: boolean;
}

/** 시뮬레이션 실행 API 요청 */
export interface SimulationRunRequest {
  scenarioParams: SimulationScenarioParams;
  /** 실행할 알고리즘 목록 */
  algorithms: Array<'astar' | 'ai_ppo'>;
}

/** 시뮬레이션 실행 API 응답 */
export interface SimulationRunResponse {
  runId: string;
  status: string;
}

/** 시뮬레이션 진행 상태 응답 */
export interface SimulationStatusResponse {
  runId: string;
  status: string;
  progress: number;
}

/** A* vs AI 비교 요약 지표 */
export interface SimulationComparison {
  transferTimeReduction: number;
  utilizationIncrease: number;
  deadlockElimination: number;
  efficiencyIncrease: number;
  throughputIncrease: number;
}

/** 반송 시간 분포 히스토그램 항목 */
export interface TransferTimeDistributionItem {
  range: string;
  astar: number;
  ai_ppo: number;
}

/** 장비별 가동률 분포 항목 */
export interface EquipmentUtilizationItem {
  equipment: string;
  astar: number;
  ai_ppo: number;
}

/** 시뮬레이션 결과 전체 응답 */
export interface SimulationResultResponse {
  runId: string;
  status: string;
  results: SimulationResult[];
  comparison?: SimulationComparison;
  distributions?: {
    transferTime: TransferTimeDistributionItem[];
    equipmentUtilization: EquipmentUtilizationItem[];
  };
}
