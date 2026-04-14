/**
 * 더미 경로 탐색 데이터
 * Task 009(반송 제어) 에서 사용
 * A* 경로 탐색 결과 및 AI 경로 추론 결과 포함
 */

/** A* 경로 탐색 결과 노드 */
export interface RouteNode {
  step: number;
  unitId: string;
  unitName: string;
  gCost: number;   // 시작점~현재 노드 실제 비용
  hCost: number;   // 현재 노드~목적지 추정 비용
  fCost: number;   // gCost + hCost
}

/** AI 경로 추론 결과 노드 */
export interface AiRouteNode {
  step: number;
  unitId: string;
  unitName: string;
  weight: number;           // 동적 가중치 (0-1)
  congestionFactor: number; // 혼잡도 팩터 (0-1)
  predictedTimeMs: number;  // 예측 소요시간 (ms)
}

/** 더미 A* 경로 탐색 결과 (UNIT-003 → UNIT-008) */
export const DUMMY_ASTAR_ROUTE: RouteNode[] = [
  { step: 1, unitId: 'UNIT-003', unitName: 'STK-A PORT-10',       gCost: 0,  hCost: 45, fCost: 45 },
  { step: 2, unitId: 'UNIT-006', unitName: 'CONV-01 IN',          gCost: 12, hCost: 33, fCost: 45 },
  { step: 3, unitId: 'UNIT-007', unitName: 'CONV-01 OUT',         gCost: 20, hCost: 25, fCost: 45 },
  { step: 4, unitId: 'UNIT-008', unitName: 'PROC-01 LOAD PORT-1', gCost: 38, hCost: 0,  fCost: 38 },
];

/** 더미 AI 경로 추론 결과 (UNIT-003 → UNIT-008, 혼잡 우회 경로) */
export const DUMMY_AI_ROUTE: AiRouteNode[] = [
  { step: 1, unitId: 'UNIT-003', unitName: 'STK-A PORT-10',       weight: 1.00, congestionFactor: 0.10, predictedTimeMs: 0    },
  { step: 2, unitId: 'UNIT-002', unitName: 'STK-A PORT-02',       weight: 0.85, congestionFactor: 0.00, predictedTimeMs: 3200 },
  { step: 3, unitId: 'UNIT-007', unitName: 'CONV-01 OUT',         weight: 0.72, congestionFactor: 0.15, predictedTimeMs: 5800 },
  { step: 4, unitId: 'UNIT-008', unitName: 'PROC-01 LOAD PORT-1', weight: 0.95, congestionFactor: 0.05, predictedTimeMs: 8100 },
];
