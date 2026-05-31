"""
Prioritized Planning (PP) — MAPF 저널 표준 베이스라인

각 에이전트를 우선순위 순으로 단독 A*(MLA*) 경로 계산 후,
이전 에이전트의 (node, time_step) 점유를 constraint로 추가.

참조: Silver (2005), Cooperative Pathfinding, AIIDE 2005
"""
import logging
import time
from typing import Dict, List, Tuple

import networkx as nx

logger = logging.getLogger(__name__)


def prioritized_planning(
    graph: nx.DiGraph,
    tasks: Dict[str, Tuple[str, str]],
    time_limit: float = 30.0,
) -> Dict[str, List[str]]:
    """
    Args:
        graph: NetworkX DiGraph
        tasks: {agent_id: (source, dest)} — 삽입 순서 = 우선순위
        time_limit: 전체 계산 시간 한도 (초)

    Returns:
        {agent_id: path_unit_ids}
    """
    from engine.cbs_ts.mla_star import mla_star_with_time, MlaConstraint
    from engine.astar import run_astar

    solutions: Dict[str, List[str]] = {}
    occupied: List[Tuple[str, int]] = []  # (node_id, time_step) 점유 목록
    start_wall = time.time()

    for agent_id, (source, dest) in tasks.items():
        if time.time() - start_wall > time_limit:
            logger.warning(
                f"Prioritized Planning 시간 초과, {agent_id}부터 A* 단독"
            )
            try:
                path, _ = run_astar(graph, source, dest)
            except Exception:
                path = [source, dest]
            solutions[agent_id] = path
            continue

        # 이전 에이전트 점유를 vertex constraint로 변환
        constraints = [
            MlaConstraint(node_id=n, time_step=t)
            for (n, t) in occupied
        ]

        try:
            timed_path = mla_star_with_time(
                graph=graph,
                source_id=source,
                dest_id=dest,
                constraints=constraints,
            )
            path = [node for node, _ in timed_path]
            solutions[agent_id] = path

            # 이 에이전트 점유를 다음 에이전트 constraint에 추가
            for node, t in timed_path:
                occupied.append((node, t))

        except Exception as exc:
            logger.debug(f"PP {agent_id} 경로 오류: {exc}")
            try:
                path, _ = run_astar(graph, source, dest)
            except Exception:
                path = [source, dest]
            solutions[agent_id] = path

    return solutions
