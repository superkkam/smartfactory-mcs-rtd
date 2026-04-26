"""
Python A* 경로 탐색 알고리즘
TypeScript astar.ts 미러 구현

h=0 (Dijkstra 동등, admissible 보장)
역할: SimPy 시뮬레이션 내 경로 계산 + PPO 모델 미존재 시 폴백

두 가지 모드:
  run_astar           — 정적 weight 기반 최단 경로 (A* 기준)
  run_astar_congestion — weight * (1 + congestion) 기반 혼잡 회피 경로 (AI 폴백 대체)
"""
import heapq
from typing import Dict, List, Optional, Tuple
import networkx as nx


def run_astar(
    graph: nx.DiGraph,
    start_id: str,
    goal_id: str,
) -> Tuple[List[str], float]:
    """
    A* 경로 탐색 (h=0, Dijkstra 동등)

    Args:
        graph: NetworkX DiGraph (노드 ID = DB uuid, 엣지 속성 weight)
        start_id: 출발 유닛 uuid
        goal_id: 목적 유닛 uuid

    Returns:
        (path, total_cost)
        - path: 유닛 uuid 리스트 (출발~목적 포함)
        - total_cost: 총 경로 비용

    Raises:
        ValueError: 노드 없음 또는 경로 없음
    """
    if start_id not in graph:
        raise ValueError(f"출발 노드 없음: {start_id}")
    if goal_id not in graph:
        raise ValueError(f"목적 노드 없음: {goal_id}")
    if start_id == goal_id:
        return [start_id], 0.0

    # g_score: 시작 노드부터 각 노드까지의 최소 비용
    g_score: Dict[str, float] = {start_id: 0.0}
    came_from: Dict[str, str] = {}

    # openSet: (fCost, node_id) 힙 — h=0이므로 fCost=gCost
    open_heap: List[Tuple[float, str]] = [(0.0, start_id)]
    closed_set: set = set()

    while open_heap:
        current_f, current_id = heapq.heappop(open_heap)

        if current_id == goal_id:
            return _reconstruct_path(came_from, current_id), g_score[goal_id]

        if current_id in closed_set:
            continue
        closed_set.add(current_id)

        for neighbor_id in graph.successors(current_id):
            if neighbor_id in closed_set:
                continue

            edge_weight = graph[current_id][neighbor_id].get("weight", 1.0)
            tentative_g = g_score.get(current_id, float("inf")) + edge_weight

            if tentative_g < g_score.get(neighbor_id, float("inf")):
                came_from[neighbor_id] = current_id
                g_score[neighbor_id] = tentative_g
                f_cost = tentative_g  # h = 0
                heapq.heappush(open_heap, (f_cost, neighbor_id))

    raise ValueError(f"경로 없음: {start_id} → {goal_id}")


def run_astar_congestion(
    graph: nx.DiGraph,
    start_id: str,
    goal_id: str,
    dynamic_weights: Optional[Dict[str, float]] = None,
) -> Tuple[List[str], float]:
    """
    혼잡도 반영 A* 경로 탐색 — PPO 폴백 대체 (AI 경로 차별화 데모용)

    실제 비용 = edge_weight * (1.0 + congestion_factor)
    혼잡 노드를 우회하는 경로를 선택하므로 정적 A*와 다른 결과 도출 가능

    Args:
        graph: NetworkX DiGraph
        start_id: 출발 유닛 uuid
        goal_id: 목적 유닛 uuid
        dynamic_weights: {uuid: congestion_factor(0~1)} — 혼잡도 맵

    Returns:
        (path, total_cost): total_cost는 혼잡 반영 실효 비용
    """
    if start_id not in graph:
        raise ValueError(f"출발 노드 없음: {start_id}")
    if goal_id not in graph:
        raise ValueError(f"목적 노드 없음: {goal_id}")
    if start_id == goal_id:
        return [start_id], 0.0

    weights = dynamic_weights or {}

    g_score: Dict[str, float] = {start_id: 0.0}
    came_from: Dict[str, str] = {}
    open_heap: List[Tuple[float, str]] = [(0.0, start_id)]
    closed_set: set = set()

    while open_heap:
        current_f, current_id = heapq.heappop(open_heap)

        if current_id == goal_id:
            return _reconstruct_path(came_from, current_id), g_score[goal_id]

        if current_id in closed_set:
            continue
        closed_set.add(current_id)

        for neighbor_id in graph.successors(current_id):
            if neighbor_id in closed_set:
                continue

            edge_weight = graph[current_id][neighbor_id].get("weight", 1.0)
            # 도착 노드의 혼잡도를 비용에 반영
            congestion = weights.get(neighbor_id, 0.0)
            effective_weight = edge_weight * (1.0 + congestion)

            tentative_g = g_score.get(current_id, float("inf")) + effective_weight

            if tentative_g < g_score.get(neighbor_id, float("inf")):
                came_from[neighbor_id] = current_id
                g_score[neighbor_id] = tentative_g
                heapq.heappush(open_heap, (tentative_g, neighbor_id))

    raise ValueError(f"경로 없음: {start_id} → {goal_id}")


def _reconstruct_path(came_from: Dict[str, str], goal_id: str) -> List[str]:
    """부모 노드 맵에서 전체 경로 역추적"""
    path = []
    current = goal_id
    while current in came_from:
        path.append(current)
        current = came_from[current]
    path.append(current)  # 출발 노드
    path.reverse()
    return path
