"""
Conflict-Based Search (CBS) High-Level 탐색 (Task 026 구현 예정)

충돌 종류:
  - Vertex conflict: 두 AMR이 같은 시간에 같은 노드 점유
  - Edge conflict:   두 AMR이 같은 시간에 같은 엣지를 반대 방향으로 통과
  - Following:       후행 AMR이 선행 AMR을 추월하려는 경우

탐색 구조: CT (Constraint Tree) — 루트에서 충돌 감지 → 분기
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class Constraint:
    """CBS 충돌 제약"""
    agent_id: str
    node_id: Optional[str] = None          # Vertex conflict
    from_node: Optional[str] = None        # Edge conflict 출발
    to_node: Optional[str] = None          # Edge conflict 도착
    time_step: int = 0


@dataclass
class CTNode:
    """Constraint Tree 노드"""
    constraints: list[Constraint] = field(default_factory=list)
    solution: dict[str, list[str]] = field(default_factory=dict)  # agent_id → path
    cost: float = float("inf")


def detect_conflicts(
    solution: dict[str, list[str]],
) -> Optional[tuple[str, str, int, str]]:
    """
    현재 솔루션에서 첫 번째 충돌 탐지.
    Returns: (agent1, agent2, timestep, conflict_type) or None
    Task 026에서 구현 예정.
    """
    raise NotImplementedError("CBS 충돌 탐지는 Task 026에서 구현 예정")


def cbs_search(
    graph: object,
    tasks: dict[str, tuple[str, str]],  # agent_id → (source, dest)
    time_limit: float = 30.0,
) -> dict[str, list[str]]:
    """
    CBS 고수준 탐색.
    Returns: agent_id → collision-free path
    Task 026에서 구현 예정.
    """
    raise NotImplementedError(
        "CBS High-Level 탐색은 Task 026에서 구현 예정.\n"
        "Low-level: MLA* (Multi-Label A*), Search Forest 구조 활용."
    )
