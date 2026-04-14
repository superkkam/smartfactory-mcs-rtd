/** A* 엔진 내부 타입 정의 */

/** 그래프 내 이웃 노드 연결 정보 */
export interface GraphEdge {
  /** 도착 유닛 DB uuid */
  toUnitId: string;
  /** 구간 가중치 (거리 m) */
  weight: number;
}

/** 그래프 노드 (mcs_equipment_unit 1행) */
export interface GraphNode {
  /** DB uuid */
  id: string;
  /** 레이아웃 표시용 ID (PORT-A1 등) */
  unitId: string;
  /** 이웃 노드 목록 (방향 엣지) */
  neighbors: GraphEdge[];
}

/** A* 경로 탐색 결과 단계 */
export interface RouteStep {
  unitId: string;
  gCost: number;
  hCost: number;
  fCost: number;
}

/** A* 경로 탐색 전체 결과 */
export interface AstarResult {
  /** 경로 순서 (출발 포함) */
  path: RouteStep[];
  /** 총 이동 비용 */
  totalCost: number;
  /** 탐색된 노드 수 */
  exploredCount: number;
}
