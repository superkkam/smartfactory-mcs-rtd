"""
MILP 기반 작업 순서 최적화 (Task 026 구현 예정)

목적: makespan(최대 완료 시간) 최소화
제약:
  - AMR 유형 호환성 (amrType ∈ allowed_types)
  - 작업 마감 시간 (deadline)
  - 동시 점유 한계 (capacity)

의존성: pulp>=2.8 (오픈소스 MILP 솔버)
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


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


def solve_task_assignment(
    tasks: list[Task],
    available_amrs: dict[str, str],  # amr_id → amr_type
    travel_time_matrix: dict[tuple[str, str], float],
) -> list[TaskAssignment]:
    """
    MILP로 작업 할당 최적화.
    Task 026에서 pulp 기반으로 구현 예정.

    Args:
        tasks:               반송 작업 목록
        available_amrs:      사용 가능 AMR (id → type)
        travel_time_matrix:  (source, dest) → 이동 시간

    Returns:
        최적 작업 할당 목록
    """
    raise NotImplementedError(
        "MILP 작업 순서 최적화는 Task 026에서 pulp 라이브러리로 구현 예정.\n"
        "모델: min(makespan) s.t. AMR 호환성, deadline, capacity 제약"
    )
