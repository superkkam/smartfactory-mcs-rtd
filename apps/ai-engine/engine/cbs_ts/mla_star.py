"""
Multi-Label A* (MLA*) — 이종 AMR 호환 경로 탐색

이종 AMR 유형:
  - TYPE_A: 표준 경로 모두 통과 가능 (기본값)
  - TYPE_B: 고하중 경로(edge weight > HIGH_LOAD_THRESHOLD) 통과 불가
  - TYPE_C: 멀티-goal 시퀀스 지원 (goal_sequence로 전달)

CBS 충돌 제약 반영:
  - vertex constraint: (node_id, time_step) — 해당 시각에 노드 진입 불가 (비용 ∞)
  - edge constraint: (from_node, to_node, time_step) — 해당 시각 엣지 통과 불가
"""
from __future__ import annotations

import heapq
from dataclasses import dataclass, field
from typing import Optional
import networkx as nx

# TYPE_B AMR 통과 불가 엣지 가중치 임계값
HIGH_LOAD_THRESHOLD = 5.0

# 대기(wait) 행동 비용 — CBS 충돌 해소 시 제자리 대기
WAIT_COST = 1.0


@dataclass(frozen=True)
class MlaConstraint:
    """MLA* 내부 충돌 제약 (CBS High-Level에서 전달)"""
    node_id: Optional[str] = None       # vertex constraint
    from_node: Optional[str] = None     # edge constraint 출발
    to_node: Optional[str] = None       # edge constraint 도착
    time_step: int = 0


def _is_compatible(
    graph: nx.DiGraph,
    node_id: str,
    amr_type: str,
    compatibility_map: Optional[dict[str, list[str]]],
) -> bool:
    """node_id 가 해당 amr_type에 접근 가능한지 확인"""
    if compatibility_map is None:
        return True
    allowed = compatibility_map.get(node_id)
    if allowed is None:
        return True  # 제약 없으면 통과 가능
    return amr_type in allowed


def _edge_passable(
    graph: nx.DiGraph,
    u: str,
    v: str,
    amr_type: str,
) -> bool:
    """TYPE_B AMR은 고하중 엣지 통과 불가"""
    if amr_type != "TYPE_B":
        return True
    weight = graph[u][v].get("weight", 1.0)
    return weight <= HIGH_LOAD_THRESHOLD


def _has_vertex_constraint(
    constraints: list[MlaConstraint],
    node_id: str,
    t: int,
) -> bool:
    for c in constraints:
        if c.node_id == node_id and c.time_step == t:
            return True
    return False


def _has_edge_constraint(
    constraints: list[MlaConstraint],
    from_node: str,
    to_node: str,
    t: int,
) -> bool:
    for c in constraints:
        if c.from_node == from_node and c.to_node == to_node and c.time_step == t:
            return True
    return False


def mla_star_with_time(
    graph: nx.DiGraph,
    source_id: str,
    dest_id: str,
    amr_type: str = "TYPE_A",
    compatibility_map: Optional[dict[str, list[str]]] = None,
    constraints: Optional[list[MlaConstraint]] = None,
    max_time: int = 200,
) -> list[tuple[str, int]]:
    """
    시간 차원 포함 MLA* — CBS High-Level 충돌 탐지용.

    Returns:
        list of (unit_id, time_step) — 출발(t=0) 부터 도착까지
    """
    if source_id not in graph:
        raise ValueError(f"출발 노드 없음: {source_id}")
    if dest_id not in graph:
        raise ValueError(f"목적 노드 없음: {dest_id}")

    cons = constraints or []

    # 상태: (unit_id, time_step)
    # 우선순위 큐: (g_cost, time_step, unit_id, path)
    start_state = (source_id, 0)
    g_score: dict[tuple[str, int], float] = {start_state: 0.0}
    came_from: dict[tuple[str, int], tuple[str, int]] = {}

    heap: list[tuple[float, int, str]] = [(0.0, 0, source_id)]
    closed: set[tuple[str, int]] = set()

    while heap:
        g, t, uid = heapq.heappop(heap)
        state = (uid, t)

        if uid == dest_id:
            # 경로 역추적
            path: list[tuple[str, int]] = []
            cur = state
            while cur in came_from:
                path.append(cur)
                cur = came_from[cur]
            path.append(cur)
            path.reverse()
            return path

        if state in closed:
            continue
        closed.add(state)

        if t >= max_time:
            continue

        next_t = t + 1

        # ── 이동 행동 ─────────────────────────────────────────────
        for nid in graph.successors(uid):
            if not _is_compatible(graph, nid, amr_type, compatibility_map):
                continue
            if not _edge_passable(graph, uid, nid, amr_type):
                continue
            if _has_edge_constraint(cons, uid, nid, next_t):
                continue
            if _has_vertex_constraint(cons, nid, next_t):
                continue

            edge_w = graph[uid][nid].get("weight", 1.0)
            new_g = g + edge_w
            next_state = (nid, next_t)

            if new_g < g_score.get(next_state, float("inf")):
                g_score[next_state] = new_g
                came_from[next_state] = state
                heapq.heappush(heap, (new_g, next_t, nid))

        # ── 대기 행동 (vertex constraint 해소를 위해 제자리 대기) ──
        wait_state = (uid, next_t)
        if not _has_vertex_constraint(cons, uid, next_t):
            new_g = g + WAIT_COST
            if new_g < g_score.get(wait_state, float("inf")):
                g_score[wait_state] = new_g
                came_from[wait_state] = state
                heapq.heappush(heap, (new_g, next_t, uid))

    raise ValueError(f"MLA* 경로 없음: {source_id} → {dest_id} (amr_type={amr_type})")


def _segment(
    graph: nx.DiGraph,
    source_id: str,
    dest_id: str,
    amr_type: str,
    compatibility_map: Optional[dict[str, list[str]]],
    constraints: list[MlaConstraint],
    time_offset: int = 0,
) -> tuple[list[str], float]:
    """단일 구간 경로 탐색 (시간 오프셋 적용)"""
    # constraints를 time_offset 기준으로 시프트
    shifted = [
        MlaConstraint(
            node_id=c.node_id,
            from_node=c.from_node,
            to_node=c.to_node,
            time_step=c.time_step - time_offset,
        )
        for c in constraints
        if c.time_step >= time_offset
    ]

    timed_path = mla_star_with_time(
        graph, source_id, dest_id,
        amr_type=amr_type,
        compatibility_map=compatibility_map,
        constraints=shifted,
    )

    # (unit_id, t) → unit_id 변환, 비용 계산
    path_ids = [uid for uid, _ in timed_path]
    cost = 0.0
    for i in range(len(path_ids) - 1):
        u, v = path_ids[i], path_ids[i + 1]
        if u == v:
            cost += WAIT_COST  # 대기
        elif graph.has_edge(u, v):
            cost += graph[u][v].get("weight", 1.0)
        else:
            cost += 1.0

    return path_ids, cost


def mla_star(
    graph: nx.DiGraph,
    source_id: str,
    dest_id: str,
    amr_type: str = "TYPE_A",
    compatibility_map: Optional[dict[str, list[str]]] = None,
    goal_sequence: Optional[list[str]] = None,
    constraints: Optional[list[MlaConstraint]] = None,
) -> tuple[list[str], float]:
    """
    Multi-Label A* 탐색.

    goal_sequence 가 주어지면 [source, *waypoints, dest] 순으로 분할 탐색 후 연결.
    constraints(CBS vertex/edge)를 반영해 충돌 없는 경로를 반환.

    Args:
        graph:             NetworkX DiGraph
        source_id:         출발 unit ID
        dest_id:           최종 목적지 unit ID
        amr_type:          AMR 유형 (TYPE_A / TYPE_B / TYPE_C)
        compatibility_map: node_id → allowed amr_types
        goal_sequence:     멀티-goal 경유 순서 (예: [src, p1, p2, dst])
                           None 이면 [source_id, dest_id] 로 처리
        constraints:       CBS 충돌 제약 목록

    Returns:
        (path_unit_ids, total_cost)
    """
    cons = constraints or []

    if goal_sequence:
        waypoints = goal_sequence
    else:
        waypoints = [source_id, dest_id]

    full_path: list[str] = []
    total_cost = 0.0
    time_offset = 0

    for i in range(len(waypoints) - 1):
        seg_src = waypoints[i]
        seg_dst = waypoints[i + 1]

        seg_path, seg_cost = _segment(
            graph, seg_src, seg_dst,
            amr_type, compatibility_map, cons, time_offset,
        )

        if full_path:
            # 앞 구간의 마지막 노드와 중복 제거
            full_path.extend(seg_path[1:])
        else:
            full_path.extend(seg_path)

        total_cost += seg_cost
        time_offset += len(seg_path) - 1  # 다음 구간 시작 시각

    return full_path, total_cost
