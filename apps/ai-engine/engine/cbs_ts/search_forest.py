"""
Search Forest 구조 — CBS 병렬 탐색 결과 관리

각 에이전트의 SearchTree를 병렬로 관리하며, CBS 완료 후 최종 솔루션을 병합.

참고: Sharon et al., "Conflict-based search for optimal multi-agent pathfinding",
      Artificial Intelligence, 2015
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class SearchTree:
    """단일 에이전트 탐색 결과"""
    agent_id: str
    root_path: list[str] = field(default_factory=list)   # unit_id 목록 (시간 인덱스 없음)
    constraints: list[object] = field(default_factory=list)
    cost: float = float("inf")


@dataclass
class SearchForest:
    """
    다중 에이전트 탐색 포레스트.
    CBS 완료 솔루션을 agent별 SearchTree로 저장 후 일괄 반환.
    """
    trees: dict[str, SearchTree] = field(default_factory=dict)

    def add_agent(self, agent_id: str) -> None:
        self.trees[agent_id] = SearchTree(agent_id=agent_id)

    def update_from_cbs_solution(
        self,
        cbs_solution: dict[str, list[str]],
        costs: Optional[dict[str, float]] = None,
    ) -> None:
        """CBS 솔루션을 Forest에 반영"""
        for agent_id, path in cbs_solution.items():
            if agent_id not in self.trees:
                self.add_agent(agent_id)
            tree = self.trees[agent_id]
            tree.root_path = path
            if costs:
                tree.cost = costs.get(agent_id, float("inf"))

    def merge_solutions(self) -> dict[str, list[str]]:
        """
        모든 에이전트의 최적 경로 병합.

        Returns:
            agent_id → path (unit_id 리스트)
        """
        return {
            agent_id: tree.root_path
            for agent_id, tree in self.trees.items()
            if tree.root_path
        }

    @property
    def total_cost(self) -> float:
        return sum(
            t.cost for t in self.trees.values()
            if t.cost != float("inf")
        )


# Optional 타입 힌트를 위한 임포트
from typing import Optional  # noqa: E402
