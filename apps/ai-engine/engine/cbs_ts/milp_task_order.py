"""
MILP 기반 작업 순서 최적화 (pulp)

목적: makespan(최대 완료 시간) 최소화
제약:
  - AMR 유형 호환성 (amrType ∈ allowed_types)
  - 작업 마감 시간 (deadline)
  - 동일 AMR 순차 직렬화

의존성: pulp>=2.8 (오픈소스 CBC 솔버 내장)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# MILP Big-M 상수
BIG_M = 1e6
# 허용 최대 풀이 시간 (초)
SOLVER_TIME_LIMIT = 30
# makespan 대비 시작 시간 합 정규화 계수
EPS = 1e-4


@dataclass
class Task:
    """반송 작업 정의"""
    task_id: str
    source_unit_id: str
    dest_unit_id: str
    allowed_amr_types: list[str] = field(default_factory=lambda: ["TYPE_A", "TYPE_B", "TYPE_C"])
    deadline: Optional[float] = None
    priority: int = 0


@dataclass
class TaskAssignment:
    """MILP 최적화 결과: 작업 → AMR 할당 + 시작 시간"""
    task_id: str
    amr_id: str
    start_time: float
    estimated_makespan: float


def _greedy_fallback(
    tasks: list[Task],
    available_amrs: dict[str, str],
    travel_time_matrix: dict[tuple[str, str], float],
) -> list[TaskAssignment]:
    """MILP 미수렴 시 greedy 폴백 — 각 작업을 가장 먼저 가용한 AMR에 순서대로 할당"""
    amr_free_at: dict[str, float] = {a: 0.0 for a in available_amrs}
    results: list[TaskAssignment] = []

    for task in sorted(tasks, key=lambda t: -t.priority):
        best_amr: Optional[str] = None
        best_start = float("inf")

        for amr_id, amr_type in available_amrs.items():
            if amr_type not in task.allowed_amr_types:
                continue
            start = amr_free_at[amr_id]
            if start < best_start:
                best_start = start
                best_amr = amr_id

        if best_amr is None:
            logger.warning(f"[MILP fallback] 작업 {task.task_id}에 호환 AMR 없음 — 첫 번째 AMR 사용")
            best_amr = next(iter(available_amrs))
            best_start = amr_free_at[best_amr]

        dur = travel_time_matrix.get(
            (task.source_unit_id, task.dest_unit_id), 1.0
        )
        amr_free_at[best_amr] = best_start + dur
        results.append(TaskAssignment(
            task_id=task.task_id,
            amr_id=best_amr,
            start_time=round(best_start, 4),
            estimated_makespan=round(amr_free_at[best_amr], 4),
        ))

    return sorted(results, key=lambda r: r.start_time)


def solve_task_assignment(
    tasks: list[Task],
    available_amrs: dict[str, str],  # amr_id → amr_type
    travel_time_matrix: dict[tuple[str, str], float],
) -> list[TaskAssignment]:
    """
    MILP로 작업 할당 최적화.

    목적: makespan 최소화 (동률 시 Σ시작시간 최소화)
    솔버: PuLP + CBC (오픈소스)

    Args:
        tasks:               반송 작업 목록
        available_amrs:      사용 가능 AMR {amr_id: amr_type}
        travel_time_matrix:  {(source_unit_id, dest_unit_id): travel_time}

    Returns:
        최적(또는 greedy 폴백) 작업 할당 목록
    """
    try:
        import pulp  # type: ignore
    except ImportError:
        logger.error("[MILP] pulp 미설치 — greedy fallback 사용")
        return _greedy_fallback(tasks, available_amrs, travel_time_matrix)

    if not tasks or not available_amrs:
        return []

    task_ids = [t.task_id for t in tasks]
    amr_ids = list(available_amrs.keys())
    task_map = {t.task_id: t for t in tasks}

    prob = pulp.LpProblem("MCS_TaskAssignment", pulp.LpMinimize)

    # ── 결정 변수 ──────────────────────────────────────────────────
    # x[t_id, a_id] ∈ {0, 1}
    x = pulp.LpVariable.dicts(
        "x", [(t, a) for t in task_ids for a in amr_ids], cat="Binary"
    )
    # s[t_id] ≥ 0 (시작 시각)
    s = pulp.LpVariable.dicts("s", task_ids, lowBound=0, cat="Continuous")
    # C_max ≥ 0 (makespan)
    c_max = pulp.LpVariable("C_max", lowBound=0, cat="Continuous")

    # ── 목적 함수 ──────────────────────────────────────────────────
    prob += c_max + EPS * pulp.lpSum(s[t] for t in task_ids)

    # ── 제약 ───────────────────────────────────────────────────────
    for t_id in task_ids:
        task = task_map[t_id]

        # 작업 유일 할당
        prob += pulp.lpSum(x[(t_id, a)] for a in amr_ids) == 1, f"assign_{t_id}"

        # 호환성: 비호환 AMR에 할당 불가
        for a_id in amr_ids:
            amr_type = available_amrs[a_id]
            if amr_type not in task.allowed_amr_types:
                prob += x[(t_id, a_id)] == 0, f"compat_{t_id}_{a_id}"

        # Makespan ≥ 시작 + 소요시간 (각 AMR 할당 케이스)
        for a_id in amr_ids:
            dur = travel_time_matrix.get(
                (task.source_unit_id, task.dest_unit_id), 1.0
            )
            # C_max ≥ s[t] + dur (x=1 일 때만 강제)
            prob += (
                c_max >= s[t_id] + dur - BIG_M * (1 - x[(t_id, a_id)])
            ), f"makespan_{t_id}_{a_id}"

            # Deadline 제약
            if task.deadline is not None:
                prob += (
                    s[t_id] + dur <= task.deadline + BIG_M * (1 - x[(t_id, a_id)])
                ), f"deadline_{t_id}_{a_id}"

    # 동일 AMR에 할당된 두 작업 직렬화 (순서 바이너리 추가)
    if len(task_ids) > 1:
        # y[t1, t2, a] ∈ {0,1}: t1이 a에서 t2보다 먼저 수행
        y = pulp.LpVariable.dicts(
            "y",
            [(t1, t2, a) for i, t1 in enumerate(task_ids)
             for t2 in task_ids[i + 1:]
             for a in amr_ids],
            cat="Binary",
        )

        for i, t1 in enumerate(task_ids):
            for t2 in task_ids[i + 1:]:
                task1 = task_map[t1]
                task2 = task_map[t2]
                for a_id in amr_ids:
                    dur1 = travel_time_matrix.get(
                        (task1.source_unit_id, task1.dest_unit_id), 1.0
                    )
                    dur2 = travel_time_matrix.get(
                        (task2.source_unit_id, task2.dest_unit_id), 1.0
                    )
                    # t1 → t2 순서
                    prob += (
                        s[t2] >= s[t1] + dur1
                        - BIG_M * (3 - x[(t1, a_id)] - x[(t2, a_id)] - y[(t1, t2, a_id)])
                    ), f"seq_{t1}_{t2}_{a_id}_a"
                    # t2 → t1 순서
                    prob += (
                        s[t1] >= s[t2] + dur2
                        - BIG_M * (2 - x[(t1, a_id)] - x[(t2, a_id)] + y[(t1, t2, a_id)])
                    ), f"seq_{t1}_{t2}_{a_id}_b"

    # ── 풀이 ───────────────────────────────────────────────────────
    solver = pulp.PULP_CBC_CMD(timeLimit=SOLVER_TIME_LIMIT, msg=0)
    prob.solve(solver)

    status = pulp.LpStatus[prob.status]
    if status not in ("Optimal", "Not Solved"):
        logger.warning(f"[MILP] 풀이 상태: {status} — greedy fallback 사용")
        return _greedy_fallback(tasks, available_amrs, travel_time_matrix)

    if status == "Not Solved":
        logger.warning("[MILP] 시간 초과(partial) — greedy fallback 사용")
        return _greedy_fallback(tasks, available_amrs, travel_time_matrix)

    # ── 결과 추출 ───────────────────────────────────────────────────
    makespan_val = pulp.value(c_max) or 0.0
    results: list[TaskAssignment] = []

    for t_id in task_ids:
        task = task_map[t_id]
        assigned_amr = next(
            (a for a in amr_ids if pulp.value(x[(t_id, a)]) > 0.5),
            amr_ids[0],
        )
        dur = travel_time_matrix.get(
            (task.source_unit_id, task.dest_unit_id), 1.0
        )
        start_val = max(pulp.value(s[t_id]) or 0.0, 0.0)
        results.append(TaskAssignment(
            task_id=t_id,
            amr_id=assigned_amr,
            start_time=round(start_val, 4),
            estimated_makespan=round(makespan_val, 4),
        ))

    return sorted(results, key=lambda r: r.start_time)
