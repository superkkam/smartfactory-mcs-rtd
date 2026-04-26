"""
Search Forest 구조 — CBS 병렬 탐색 (Task 026 구현 예정)

구조:
  - 다중 루트 트리: 각 AMR 마다 독립 탐색 트리
  - 충돌 감지 후 분기: 두 AMR의 제약 집합에 각각 제약 추가 → 두 자식 트리
  - 재사용: 이전에 탐색한 부분 트리를 공유(Search Forest)

참고: Sharon et al., "Conflict-based search for optimal multi-agent pathfinding",
      Artificial Intelligence, 2015
"""
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class SearchTree:
    """단일 에이전트 탐색 트리 (CT Node 묶음)"""
    agent_id: str
    root_path: list[str] = field(default_factory=list)
    constraints: list[object] = field(default_factory=list)
    cost: float = float("inf")


@dataclass
class SearchForest:
    """
    다중 에이전트 탐색 포레스트.
    각 에이전트의 SearchTree를 병렬로 관리.
    """
    trees: dict[str, SearchTree] = field(default_factory=dict)

    def add_agent(self, agent_id: str) -> None:
        self.trees[agent_id] = SearchTree(agent_id=agent_id)

    def merge_solutions(self) -> dict[str, list[str]]:
        """
        모든 에이전트의 최적 경로 병합.
        Task 026에서 CBS 충돌 해소 후 최종 병합 구현 예정.
        """
        raise NotImplementedError("SearchForest.merge_solutions는 Task 026에서 구현 예정")

    @property
    def total_cost(self) -> float:
        return sum(t.cost for t in self.trees.values())
