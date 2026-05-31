"""
Conflict-Based Search (CBS) High-Level 탐색

충돌 종류 (본 구현):
  - Vertex conflict: 두 AMR이 같은 시각 t에 같은 노드 점유
  - Edge conflict:   두 AMR이 같은 시각 t에 같은 엣지를 반대 방향으로 통과
  - Following: 후행 AMR이 선행 AMR 바로 뒤에 진입 (향후 확장 예정 — 현재 미구현)

탐색 구조: CT (Constraint Tree)
  - 루트: 제약 없이 각 AMR 독립 MLA* → 초기 솔루션
  - Best-first 확장 (총 비용 기준)
  - 충돌 발견 시 두 자식 노드 생성 (각 에이전트에 제약 추가)
"""
from __future__ import annotations

import heapq
import logging
import time
from dataclasses import dataclass, field
from typing import Optional
import networkx as nx

from engine.cbs_ts.mla_star import MlaConstraint, mla_star_with_time

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Constraint:
    """CBS 충돌 제약 (외부 인터페이스용)"""
    agent_id: str
    node_id: Optional[str] = None           # Vertex conflict
    from_node: Optional[str] = None         # Edge conflict 출발
    to_node: Optional[str] = None           # Edge conflict 도착
    time_step: int = 0


@dataclass
class CTNode:
    """Constraint Tree 노드"""
    constraints: list[Constraint] = field(default_factory=list)
    solution: dict[str, list[tuple[str, int]]] = field(default_factory=dict)  # agent → [(unit_id, t)]
    cost: float = field(default=float("inf"))

    def __lt__(self, other: "CTNode") -> bool:
        return self.cost < other.cost


# ── 충돌 탐지 ──────────────────────────────────────────────────────────


def detect_conflicts(
    solution: dict[str, list[tuple[str, int]]],
) -> Optional[tuple[str, str, int, str, str]]:
    """
    현재 솔루션에서 첫 번째 충돌 탐지.

    Args:
        solution: agent_id → [(unit_id, time_step)] 경로

    Returns:
        (agent1, agent2, timestep, conflict_type, node_or_edge_info)
        또는 None (충돌 없음)
        - conflict_type: "vertex" or "edge"
        - node_or_edge_info: vertex → node_id, edge → "from_node→to_node"
    """
    agents = list(solution.keys())
    max_t = max((t for path in solution.values() for _, t in path), default=0)

    # 시각별 각 에이전트 위치 맵 구성
    pos_at: dict[int, dict[str, str]] = {}
    for agent, path in solution.items():
        for uid, t in path:
            pos_at.setdefault(t, {})[agent] = uid

    for t in range(max_t + 1):
        positions = pos_at.get(t, {})

        # Vertex conflict 탐지
        for i, a1 in enumerate(agents):
            for a2 in agents[i + 1:]:
                n1 = positions.get(a1)
                n2 = positions.get(a2)
                if n1 and n2 and n1 == n2:
                    return (a1, a2, t, "vertex", n1)

        # Edge conflict 탐지 (t → t+1 구간)
        if t < max_t:
            next_positions = pos_at.get(t + 1, {})
            for i, a1 in enumerate(agents):
                for a2 in agents[i + 1:]:
                    u1 = positions.get(a1)
                    v1 = next_positions.get(a1)
                    u2 = positions.get(a2)
                    v2 = next_positions.get(a2)
                    # 반대 방향 엣지 교차
                    if u1 and v1 and u2 and v2:
                        if u1 == v2 and v1 == u2:
                            return (a1, a2, t, "edge", f"{u1}→{v1}")

    return None


# ── CT 노드 비용 계산 ──────────────────────────────────────────────────


def _solution_cost(solution: dict[str, list[tuple[str, int]]]) -> float:
    """SOC (Sum of Costs) — 모든 에이전트 경로 비용 합산"""
    total = 0.0
    for path in solution.values():
        if len(path) >= 2:
            # 마지막 timestep = 경로 길이 기준
            total += path[-1][1]
    return total


# ── MLA* 호출 유틸 ─────────────────────────────────────────────────────


def _build_mla_constraints(
    all_constraints: list[Constraint],
    agent_id: str,
) -> list[MlaConstraint]:
    """CBS 전체 제약 목록에서 특정 에이전트의 MlaConstraint 리스트 추출"""
    result: list[MlaConstraint] = []
    for c in all_constraints:
        if c.agent_id != agent_id:
            continue
        result.append(MlaConstraint(
            node_id=c.node_id,
            from_node=c.from_node,
            to_node=c.to_node,
            time_step=c.time_step,
        ))
    return result


# ── CBS 메인 탐색 ──────────────────────────────────────────────────────


def cbs_search(
    graph: nx.DiGraph,
    tasks: dict[str, tuple[str, str]],  # agent_id → (source_id, dest_id)
    amr_types: Optional[dict[str, str]] = None,       # agent_id → amr_type
    compatibility_map: Optional[dict[str, list[str]]] = None,
    time_limit: float = 30.0,
) -> dict[str, list[str]]:
    """
    CBS High-Level 탐색.

    Args:
        graph:             NetworkX DiGraph
        tasks:             agent_id → (source_unit_id, dest_unit_id)
        amr_types:         agent_id → amr_type (기본 TYPE_A)
        compatibility_map: node_id → allowed amr_types
        time_limit:        최대 탐색 시간(초)

    Returns:
        agent_id → collision-free path (unit_id 리스트, 시간 인덱스 제거됨)
    """
    if not tasks:
        return {}

    amr_types = amr_types or {}
    start_wall = time.time()

    # ── 루트 CT 노드 생성 ─────────────────────────────────────────
    root = CTNode()
    root.constraints = []

    for agent_id, (src, dst) in tasks.items():
        amr_type = amr_types.get(agent_id, "TYPE_A")
        try:
            timed = mla_star_with_time(
                graph, src, dst,
                amr_type=amr_type,
                compatibility_map=compatibility_map,
                constraints=[],
            )
            root.solution[agent_id] = timed
        except ValueError as e:
            logger.warning(f"[CBS] 루트 MLA* 실패 {agent_id}: {e}")
            # 경로 없음 → 단일 대기 경로(출발 = 도착 취급)
            root.solution[agent_id] = [(src, 0)]

    root.cost = _solution_cost(root.solution)

    # ── CT Best-First 탐색 ──────────────────────────────────────────
    open_heap: list[tuple[float, int, CTNode]] = [(root.cost, 0, root)]
    counter = 0

    while open_heap:
        if time.time() - start_wall > time_limit:
            logger.warning("[CBS] 시간 초과 — 현재 최선 솔루션 반환")
            break

        _, _, node = heapq.heappop(open_heap)

        conflict = detect_conflicts(node.solution)
        if conflict is None:
            # 충돌 없음 → 솔루션 반환
            return {
                agent: [uid for uid, _ in path]
                for agent, path in node.solution.items()
            }

        a1, a2, t, ctype, info = conflict

        for agent_to_constrain in (a1, a2):
            child = CTNode()
            child.constraints = list(node.constraints)

            if ctype == "vertex":
                child.constraints.append(Constraint(
                    agent_id=agent_to_constrain,
                    node_id=info,
                    time_step=t,
                ))
            elif ctype == "edge":
                # info = "from_node→to_node" 파싱
                parts = info.split("→")
                if len(parts) == 2:
                    fn, tn = parts[0], parts[1]
                    # 해당 에이전트가 이 엣지를 t+1에 통과하지 못하도록
                    child.constraints.append(Constraint(
                        agent_id=agent_to_constrain,
                        from_node=fn if agent_to_constrain == a1 else tn,
                        to_node=tn if agent_to_constrain == a1 else fn,
                        time_step=t + 1,
                    ))

            # 제약 추가된 에이전트만 MLA* 재계산
            child.solution = dict(node.solution)
            src_c, dst_c = tasks[agent_to_constrain]
            amr_type_c = amr_types.get(agent_to_constrain, "TYPE_A")
            mla_cons = _build_mla_constraints(child.constraints, agent_to_constrain)

            try:
                timed = mla_star_with_time(
                    graph, src_c, dst_c,
                    amr_type=amr_type_c,
                    compatibility_map=compatibility_map,
                    constraints=mla_cons,
                )
                child.solution[agent_to_constrain] = timed
            except ValueError:
                # 이 제약으로 경로가 없으면 가지 제거
                continue

            child.cost = _solution_cost(child.solution)
            counter += 1
            heapq.heappush(open_heap, (child.cost, counter, child))

    # 시간 초과 또는 실패 — 현재 가장 좋은 노드의 솔루션 반환 (partial)
    if open_heap:
        _, _, best = open_heap[0]
        logger.warning("[CBS] partial 솔루션 반환 (충돌 잔존 가능)")
        return {
            agent: [uid for uid, _ in path]
            for agent, path in best.solution.items()
        }

    return {}
