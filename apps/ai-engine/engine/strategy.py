"""
경로 탐색 알고리즘 Strategy 패턴
새 알고리즘 추가 시: RouteStrategy를 상속하고 STRATEGY_REGISTRY에 등록

지원 알고리즘:
  astar   — 기존 A* (단일 에이전트, 최단 경로)
  ai_ppo  — 강화학습 PPO (단일 에이전트, 혼잡 적응)
  cactus  — MARL PPO+QMIX CTDE (다중 에이전트 MAPF) — Task 025에서 구현 예정
  cbs_ts  — MILP+CBS High-level / MLA* Low-level (이종 AMR MAPF) — Task 026에서 구현 예정
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Optional
import networkx as nx


class RouteStrategy(ABC):
    """경로 탐색 전략 기본 클래스"""

    @abstractmethod
    def predict(
        self,
        graph: nx.DiGraph,
        source_id: str,
        dest_id: str,
        unit_labels: dict[str, str],
        dynamic_weights: Optional[dict[str, float]] = None,
    ) -> tuple[list[str], float, float]:
        """
        경로를 계산하여 반환.

        Returns:
            (path_uuids, total_cost, confidence)
            - path_uuids: 경유 unit ID 목록 (출발 → 도착 포함)
            - total_cost: 총 이동 비용
            - confidence: 신뢰도 (0~1), 결정론적 알고리즘은 1.0
        """

    @property
    def is_available(self) -> bool:
        """알고리즘 사용 가능 여부 (모델 로드 성공 / 의존성 충족 등)"""
        return True


class AstarStrategy(RouteStrategy):
    """A* 기반 최단 경로 탐색"""

    def predict(
        self,
        graph: nx.DiGraph,
        source_id: str,
        dest_id: str,
        unit_labels: dict[str, str],
        dynamic_weights: Optional[dict[str, float]] = None,
    ) -> tuple[list[str], float, float]:
        from engine.astar import run_astar
        path, cost = run_astar(graph, source_id, dest_id)
        return path, cost, 1.0


class PpoStrategy(RouteStrategy):
    """PPO 강화학습 기반 경로 탐색 (단일 에이전트)"""

    def predict(
        self,
        graph: nx.DiGraph,
        source_id: str,
        dest_id: str,
        unit_labels: dict[str, str],
        dynamic_weights: Optional[dict[str, float]] = None,
    ) -> tuple[list[str], float, float]:
        from engine.ppo_agent import ppo_agent
        path, cost, confidence = ppo_agent.predict(
            graph=graph,
            source_id=source_id,
            dest_id=dest_id,
            unit_labels=unit_labels,
            dynamic_weights=dynamic_weights,
        )
        return path, cost, confidence

    @property
    def is_available(self) -> bool:
        from engine.ppo_agent import ppo_agent
        return ppo_agent.is_loaded


class CactusStrategy(RouteStrategy):
    """
    CACTUS: MARL-based MAPF (PPO + QMIX CTDE, Reverse Curriculum)
    구현 예정 — Task 025
    """

    def predict(
        self,
        graph: nx.DiGraph,
        source_id: str,
        dest_id: str,
        unit_labels: dict[str, str],
        dynamic_weights: Optional[dict[str, float]] = None,
    ) -> tuple[list[str], float, float]:
        raise NotImplementedError(
            "CACTUS 알고리즘은 Task 025에서 구현 예정입니다. "
            "현재 이 요청은 503으로 응답됩니다."
        )

    @property
    def is_available(self) -> bool:
        return False


class CbsTsStrategy(RouteStrategy):
    """
    CBS-TS: MILP+CBS High-level / MLA* Low-level, Search Forest
    이종 AMR 호환 MAPF — Task 026
    """

    def predict(
        self,
        graph: nx.DiGraph,
        source_id: str,
        dest_id: str,
        unit_labels: dict[str, str],
        dynamic_weights: Optional[dict[str, float]] = None,
    ) -> tuple[list[str], float, float]:
        raise NotImplementedError(
            "CBS-TS 알고리즘은 Task 026에서 구현 예정입니다. "
            "현재 이 요청은 503으로 응답됩니다."
        )

    @property
    def is_available(self) -> bool:
        return False


# ── Strategy Registry ──────────────────────────────────────────────

STRATEGY_REGISTRY: dict[str, RouteStrategy] = {
    "astar":   AstarStrategy(),
    "ai_ppo":  PpoStrategy(),
    "cactus":  CactusStrategy(),
    "cbs_ts":  CbsTsStrategy(),
}

VALID_ALGORITHMS = frozenset(STRATEGY_REGISTRY.keys())


def get_strategy(algorithm: str) -> RouteStrategy:
    """알고리즘 이름으로 Strategy 인스턴스 반환. 없으면 ValueError."""
    key = algorithm.lower()
    if key not in STRATEGY_REGISTRY:
        raise ValueError(
            f"알 수 없는 알고리즘: '{algorithm}'. "
            f"지원: {sorted(VALID_ALGORITHMS)}"
        )
    return STRATEGY_REGISTRY[key]
