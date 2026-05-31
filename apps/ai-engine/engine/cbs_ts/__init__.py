"""
CBS-TS 모듈 공개 인터페이스

단일 에이전트: mla_star (RouteStrategy 호환)
다중 에이전트: solve_multi_agent (Task 027 평가용)
"""
from __future__ import annotations

import logging
from typing import Optional
import networkx as nx

from engine.cbs_ts.mla_star import mla_star, MlaConstraint
from engine.cbs_ts.milp_task_order import Task, TaskAssignment, solve_task_assignment
from engine.cbs_ts.cbs_high_level import Constraint, cbs_search
from engine.cbs_ts.search_forest import SearchForest

logger = logging.getLogger(__name__)

__all__ = [
    "mla_star",
    "MlaConstraint",
    "Task",
    "TaskAssignment",
    "solve_task_assignment",
    "Constraint",
    "cbs_search",
    "SearchForest",
    "solve_multi_agent",
]


def solve_multi_agent(
    graph: nx.DiGraph,
    tasks: list[Task],
    available_amrs: dict[str, str],                    # amr_id → amr_type
    travel_time_matrix: Optional[dict[tuple[str, str], float]] = None,
    compatibility_map: Optional[dict[str, list[str]]] = None,
    cbs_time_limit: float = 30.0,
) -> tuple[SearchForest, list[TaskAssignment]]:
    """
    CBS-TS 다중 에이전트 경로 계획.

    1단계: MILP로 작업-AMR 할당 최적화 (makespan 최소화)
    2단계: CBS로 충돌 없는 경로 집합 계산

    Args:
        graph:                NetworkX DiGraph
        tasks:                반송 작업 목록
        available_amrs:       사용 가능 AMR {amr_id: amr_type}
        travel_time_matrix:   {(src_unit_id, dst_unit_id): travel_time}
        compatibility_map:    node_id → allowed amr_types
        cbs_time_limit:       CBS 탐색 시간 제한(초)

    Returns:
        (SearchForest, list[TaskAssignment])
        - SearchForest.merge_solutions() → {amr_id: path_unit_ids}
        - TaskAssignment 목록 (MILP 할당 결과)
    """
    travel_matrix = travel_time_matrix or {}

    # 1단계: MILP 작업 할당
    assignments: list[TaskAssignment] = solve_task_assignment(
        tasks, available_amrs, travel_matrix
    )
    logger.info(f"[CBS-TS] MILP 할당 완료: {len(assignments)}개 작업")

    # 2단계: CBS 경로 계획
    # assignment를 agent(AMR) 기준 작업 목록으로 변환
    cbs_tasks: dict[str, tuple[str, str]] = {}
    amr_type_map: dict[str, str] = {}

    task_map = {t.task_id: t for t in tasks}
    for asgn in assignments:
        task = task_map.get(asgn.task_id)
        if task is None:
            continue
        # 동일 AMR에 복수 작업이 있으면 직렬 처리 (첫 작업만 CBS에 등록, 나머지는 순차 연결)
        agent_key = f"{asgn.amr_id}_task{asgn.task_id}"
        cbs_tasks[agent_key] = (task.source_unit_id, task.dest_unit_id)
        amr_type_map[agent_key] = available_amrs.get(asgn.amr_id, "TYPE_A")

    cbs_solution = cbs_search(
        graph,
        cbs_tasks,
        amr_types=amr_type_map,
        compatibility_map=compatibility_map,
        time_limit=cbs_time_limit,
    )
    logger.info(f"[CBS-TS] CBS 완료: {len(cbs_solution)}개 에이전트 경로")

    # SearchForest 구성
    forest = SearchForest()
    for agent_id in cbs_tasks:
        forest.add_agent(agent_id)
    forest.update_from_cbs_solution(cbs_solution)

    return forest, assignments
