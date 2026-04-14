/**
 * ACS (AMHS Control System) 층 — 타입 정의
 * SEMI E82 IBSEM Vehicle State Model 축소판
 *
 * 실제 팹의 ACS 가 담당하는 AMR/AGV 제어를 MCS 내부 모듈로 구현.
 * 추후 별도 앱(`apps/acs/`)으로 분리 가능하도록 이 폴더에 격리.
 */

/** SEMI E82 축소판 차량 상태 */
export type AcsVehicleState =
  | 'Idle'          // 대기 — 명령 없음
  | 'Assigned'      // 명령 할당됨 — 아직 이동 전
  | 'MovingEmpty'   // 빈 차로 출발지로 이동 중
  | 'Acquiring'     // 출발지 도착 — 캐리어 Pick
  | 'Loaded'        // 캐리어 얹음 — 이동 전 정지 상태
  | 'MovingLoaded'  // 캐리어 싣고 목적지로 이동 중
  | 'Depositing';   // 목적지 도착 — 캐리어 Place

/** micro_command 진행 추적용 항목 */
export interface MicroCommandEntry {
  id: string;
  departureUnitId: string;
  arrivalUnitId: string;
}

/** ACS 가 관리하는 차량(AMR/AGV) 런타임 상태 */
export interface AcsVehicle {
  /** mcs_equipment.id (uuid) */
  equipmentId: string;
  /** 표시용 ID (mcs_equipment.equipment_id) */
  equipmentLabel: string;
  /** 현재 차량 상태 */
  vehicleState: AcsVehicleState;
  /** 현재 수행 중인 mcs_micro_command.id (null = 없음) */
  currentCommandId: string | null;
  /** 현재 수행 중인 mcs_macro_command.id (null = 없음) */
  currentMacroCommandId: string | null;
  /** 반송 대상 캐리어의 DB id (mcs_carrier.id) — carrier_id 기반 매칭에 사용 */
  carrierId: string | null;
  /** 실제 캐리어 픽업 위치 (macro_command.source_unit_id) */
  pickupUnitId: string | null;
  /** 실제 캐리어 드롭 위치 (macro_command.dest_unit_id) */
  dropoffUnitId: string | null;
  /** 현재 macro 에 속한 모든 micro_command (sequence 순) */
  microCommandIds: MicroCommandEntry[];
  /**
   * 현재 이동 중인 path (EquipmentUnit.id 배열, BFS 결과)
   * [출발, 경유..., 목적지] 순서
   */
  currentPath: string[];
  /** currentPath 에서 현재 몇 번째 노드에 있는지 */
  pathIndex: number;
  /** 마지막 hop(경로 전진) 또는 액션 시작 timestamp (ms) — 시간 기반 타이밍에 사용 */
  lastHopAt: number;
  /** 마지막 상태 변경 timestamp (ms) */
  updatedAt: number;
}

/** ACS 전체 런타임 상태 */
export interface AcsState {
  /** layoutId → 인접 리스트(unitId → 인접 unitId[]) */
  isRunning: boolean;
  vehicles: Map<string, AcsVehicle>; // key = equipmentId
  /** 마지막 tick timestamp */
  lastTickAt: number | null;
  /** tick 수 (디버깅용) */
  tickCount: number;
  /** 에러 메시지 (있으면 UI 에 표시) */
  error: string | null;
}

/** Leader lock localStorage 키 / 스키마 */
export const ACS_LEADER_KEY = 'acs-leader';

export interface AcsLeaderLock {
  tabId: string;
  heartbeat: number; // Date.now()
}
