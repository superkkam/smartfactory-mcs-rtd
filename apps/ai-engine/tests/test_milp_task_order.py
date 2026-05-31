"""
MILP 작업 순서 최적화 단위 테스트

검증 항목:
1. 4 task / 2 AMR (TYPE_A) 기본 할당
2. 호환성 제약 (TYPE_B 전용 AMR에 TYPE_A 작업 할당 불가)
3. 빈 입력 → 빈 결과
4. greedy fallback 동작 (MILP 의존성 없는 케이스)
"""
import pytest
from engine.cbs_ts.milp_task_order import (
    Task,
    TaskAssignment,
    solve_task_assignment,
    _greedy_fallback,
)

pytestmark = pytest.mark.skipif(
    pytest.importorskip("pulp", reason="pulp 미설치") is None,
    reason="pulp 미설치",
)


def _basic_tasks() -> list[Task]:
    return [
        Task("T1", "STK_A_PORT_1", "PROC_1_PORT_1"),
        Task("T2", "STK_A_PORT_2", "PROC_2_PORT_1"),
        Task("T3", "PROC_1_PORT_2", "STK_B_PORT_1"),
        Task("T4", "PROC_2_PORT_2", "STK_B_PORT_2"),
    ]


def _travel_matrix() -> dict[tuple[str, str], float]:
    """단순 일정 이동시간 행렬"""
    nodes = [
        "STK_A_PORT_1", "STK_A_PORT_2", "PROC_1_PORT_1", "PROC_1_PORT_2",
        "PROC_2_PORT_1", "PROC_2_PORT_2", "STK_B_PORT_1", "STK_B_PORT_2",
    ]
    return {(s, d): 5.0 for s in nodes for d in nodes if s != d}


def test_basic_assignment():
    """4 task / 2 AMR (TYPE_A): 모든 작업에 유효한 AMR 할당"""
    tasks = _basic_tasks()
    amrs = {"AMR_1": "TYPE_A", "AMR_2": "TYPE_A"}
    matrix = _travel_matrix()

    results = solve_task_assignment(tasks, amrs, matrix)

    assert len(results) == 4
    task_ids_assigned = {r.task_id for r in results}
    assert task_ids_assigned == {"T1", "T2", "T3", "T4"}
    for r in results:
        assert r.amr_id in amrs
        assert r.start_time >= 0
        assert r.estimated_makespan > 0


def test_makespan_within_bound():
    """makespan은 최대 총 이동시간 합 이하"""
    tasks = _basic_tasks()
    amrs = {"AMR_1": "TYPE_A", "AMR_2": "TYPE_A"}
    matrix = _travel_matrix()

    results = solve_task_assignment(tasks, amrs, matrix)

    if results:
        makespan = max(r.estimated_makespan for r in results)
        # 4 task × 5.0 = 20.0 이 상한
        assert makespan <= 21.0


def test_incompatible_amr_type_skipped():
    """TYPE_B AMR에 TYPE_A 전용 작업은 할당 불가 → TYPE_A AMR에만 할당"""
    tasks = [
        Task("T1", "A", "B", allowed_amr_types=["TYPE_A"]),
        Task("T2", "C", "D", allowed_amr_types=["TYPE_A"]),
    ]
    amrs = {"AMR_B": "TYPE_B", "AMR_A": "TYPE_A"}
    matrix = {("A", "B"): 3.0, ("C", "D"): 3.0, ("B", "A"): 3.0, ("D", "C"): 3.0}

    results = solve_task_assignment(tasks, amrs, matrix)

    assert len(results) == 2
    for r in results:
        assert r.amr_id == "AMR_A"


def test_empty_tasks_returns_empty():
    """빈 작업 목록 → 빈 결과"""
    results = solve_task_assignment([], {"AMR_1": "TYPE_A"}, {})
    assert results == []


def test_greedy_fallback_basic():
    """greedy fallback: 직접 호출 시 모든 작업 할당"""
    tasks = [
        Task("T1", "A", "B"),
        Task("T2", "C", "D"),
    ]
    amrs = {"AMR_1": "TYPE_A"}
    matrix = {("A", "B"): 2.0, ("C", "D"): 2.0}

    results = _greedy_fallback(tasks, amrs, matrix)

    assert len(results) == 2
    for r in results:
        assert r.amr_id == "AMR_1"
        assert r.start_time >= 0
