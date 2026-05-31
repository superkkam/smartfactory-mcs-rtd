import type { GraphNode, AstarResult, RouteStep } from './types';

/**
 * A* 경로 탐색 알고리즘
 *
 * Heuristic: 좌표 정보가 없으므로 h=0 (Dijkstra와 동일, admissible 보장)
 * 실제 논문에서 "A* Baseline" = uniform-cost search로 표기
 *
 * @param graph         unitId(DB uuid) → GraphNode 맵
 * @param startId       출발 유닛 DB uuid
 * @param goalId        도착 유닛 DB uuid
 * @param blockedNodes  런타임 장애물 유닛 ID 집합 (시뮬레이션 중 랜덤 생성)
 */
export function runAstar(
  graph: Map<string, GraphNode>,
  startId: string,
  goalId: string,
  blockedNodes: Set<string> = new Set(),
): AstarResult {
  if (!graph.has(startId)) throw new Error(`출발 노드 없음: ${startId}`);
  if (!graph.has(goalId))  throw new Error(`목적 노드 없음: ${goalId}`);
  if (startId === goalId) {
    const step: RouteStep = { unitId: startId, gCost: 0, hCost: 0, fCost: 0 };
    return { path: [step], totalCost: 0, exploredCount: 1 };
  }

  /** gScore: 시작 노드부터의 실제 최소 비용 */
  const gScore = new Map<string, number>();
  gScore.set(startId, 0);

  /** 부모 노드 추적 */
  const cameFrom = new Map<string, string>();

  /** openSet: [fCost, unitId] 배열을 단순 정렬로 관리 (노드 수 소규모) */
  const openSet: Array<{ id: string; fCost: number }> = [
    { id: startId, fCost: 0 },
  ];
  const inOpen = new Set<string>([startId]);
  const closedSet = new Set<string>();
  let exploredCount = 0;

  while (openSet.length > 0) {
    // fCost 최소 노드 추출
    openSet.sort((a, b) => a.fCost - b.fCost);
    const current = openSet.shift()!;
    inOpen.delete(current.id);

    if (current.id === goalId) {
      const path = reconstructPath(cameFrom, gScore, goalId);
      return { path, totalCost: gScore.get(goalId) ?? 0, exploredCount };
    }

    closedSet.add(current.id);
    exploredCount++;

    const node = graph.get(current.id);
    if (!node) continue;

    for (const edge of node.neighbors) {
      // 장애물 셀은 건너뜀 (출발/도착은 장애물이어도 허용)
      if (
        blockedNodes.has(edge.toUnitId) &&
        edge.toUnitId !== goalId
      ) continue;
      if (closedSet.has(edge.toUnitId)) continue;

      const tentativeG = (gScore.get(current.id) ?? Infinity) + edge.weight;
      const existingG  = gScore.get(edge.toUnitId) ?? Infinity;

      if (tentativeG < existingG) {
        cameFrom.set(edge.toUnitId, current.id);
        gScore.set(edge.toUnitId, tentativeG);
        const fCost = tentativeG;

        if (!inOpen.has(edge.toUnitId)) {
          openSet.push({ id: edge.toUnitId, fCost });
          inOpen.add(edge.toUnitId);
        }
      }
    }
  }

  throw new Error(`경로 없음: ${startId} → ${goalId} (장애물 우회 불가)`);
}

/** 부모 노드 맵에서 전체 경로 역추적 */
function reconstructPath(
  cameFrom: Map<string, string>,
  gScore:   Map<string, number>,
  goalId:   string,
): RouteStep[] {
  const path: string[] = [];
  let current = goalId;
  while (cameFrom.has(current)) {
    path.unshift(current);
    current = cameFrom.get(current)!;
  }
  path.unshift(current); // 출발 노드

  return path.map((id, idx) => {
    const g = gScore.get(id) ?? 0;
    // 이전 노드의 g 비용 차이 = 해당 구간 비용
    const prevG = idx > 0 ? (gScore.get(path[idx - 1]) ?? 0) : 0;
    return {
      unitId: id,
      gCost:  g,
      hCost:  0,
      fCost:  g,
      stepCost: idx === 0 ? 0 : g - prevG,
    };
  });
}
