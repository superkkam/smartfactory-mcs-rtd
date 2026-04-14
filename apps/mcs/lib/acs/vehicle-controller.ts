/**
 * ACS — 차량 컨트롤러 (SEMI E82 축소판 state machine)
 *
 * 각 AMR 에 대한 상태 전이 로직을 순수 함수로 관리한다.
 * Supabase 직접 write 는 tick-loop.ts 에서 담당 (관심사 분리).
 *
 * 상태 전이도:
 *   Idle → Assigned (명령 할당)
 *   Assigned → MovingEmpty (출발지로 이동 시작)
 *   MovingEmpty → Acquiring (출발지 도착)
 *   Acquiring → Loaded (캐리어 Pick 완료, 즉시 전이)
 *   Loaded → MovingLoaded (목적지로 이동 시작)
 *   MovingLoaded → Depositing (목적지 도착)
 *   Depositing → Idle (캐리어 Place 완료, 명령 Completed)
 *
 * 타이밍: 백그라운드 탭 setInterval throttling 에 강건하도록
 *         tick 카운팅이 아닌 절대 시간(Date.now()) 기반으로 동작
 */

import type { AcsVehicle, AcsVehicleState } from './types';

/** 경로 한 칸(hop) 이동에 소요되는 최소 시간 (ms) — QuickDemo 1000ms 와 동일 */
export const HOP_INTERVAL_MS = 1000;

/** Acquiring / Depositing 액션 유지 시간 (ms) */
export const ACTION_INTERVAL_MS = 500;

/**
 * 이동형 장비인지 확인 (ACS 가 제어하는 대상)
 */
export function isMobileEquipment(equipmentType: string): boolean {
  return equipmentType === 'AGV';
}

/**
 * 차량이 path 에서 한 칸 전진해야 하는지 판단 (시간 기반)
 */
export function shouldAdvancePath(lastHopAt: number): boolean {
  return Date.now() - lastHopAt >= HOP_INTERVAL_MS;
}

/**
 * 액션 상태(Acquiring / Depositing)가 완료됐는지 판단 (시간 기반)
 */
export function shouldCompleteAction(lastHopAt: number): boolean {
  return Date.now() - lastHopAt >= ACTION_INTERVAL_MS;
}

/**
 * path 에서 다음 unitId 를 반환 (경계 초과 시 null)
 */
export function nextUnitId(vehicle: AcsVehicle): string | null {
  const nextIdx = vehicle.pathIndex + 1;
  if (nextIdx >= vehicle.currentPath.length) return null;
  return vehicle.currentPath[nextIdx];
}

/**
 * 이동 목표 unitId (path 마지막)
 */
export function destinationUnitId(vehicle: AcsVehicle): string | null {
  if (vehicle.currentPath.length === 0) return null;
  return vehicle.currentPath[vehicle.currentPath.length - 1];
}

/**
 * 현재 unitId
 */
export function currentUnitId(vehicle: AcsVehicle): string | null {
  if (vehicle.currentPath.length === 0) return null;
  return vehicle.currentPath[vehicle.pathIndex] ?? null;
}

/**
 * state 전이 로직 (tick-loop 에서 호출)
 * 반환: 다음 state (변경 없으면 현재 state 그대로)
 */
export function nextVehicleState(
  vehicle: AcsVehicle,
  hasReachedDeparture: boolean,
  hasReachedDestination: boolean,
): AcsVehicleState {
  switch (vehicle.vehicleState) {
    case 'Assigned':
      // 즉시 이동 시작
      return 'MovingEmpty';

    case 'MovingEmpty':
      if (hasReachedDeparture) return 'Acquiring';
      return 'MovingEmpty';

    case 'Acquiring':
      if (shouldCompleteAction(vehicle.lastHopAt)) return 'Loaded';
      return 'Acquiring';

    case 'Loaded':
      // 즉시 이동 시작
      return 'MovingLoaded';

    case 'MovingLoaded':
      if (hasReachedDestination) return 'Depositing';
      return 'MovingLoaded';

    case 'Depositing':
      if (shouldCompleteAction(vehicle.lastHopAt)) return 'Idle';
      return 'Depositing';

    default:
      return vehicle.vehicleState;
  }
}
