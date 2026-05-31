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
    CACTUS: MARL-based MAPF (QMIX CTDE + Reverse Curriculum)
    per-agent 분산 추론 (CTDE decentralized 부분). Task 025 구현.
    """

    def predict(
        self,
        graph: nx.DiGraph,
        source_id: str,
        dest_id: str,
        unit_labels: dict[str, str],
        dynamic_weights: Optional[dict[str, float]] = None,
    ) -> tuple[list[str], float, float]:
        from engine.cactus.qmix_agent import qmix_agent
        return qmix_agent.predict_single(
            graph=graph,
            source_id=source_id,
            dest_id=dest_id,
            unit_labels=unit_labels,
            dynamic_weights=dynamic_weights,
        )

    @property
    def is_available(self) -> bool:
        from engine.cactus.qmix_agent import qmix_agent
        return qmix_agent.is_loaded


class CbsTsStrategy(RouteStrategy):
    """
    CBS-TS: MLA* 기반 단일 에이전트 경로 탐색 (RouteStrategy 호환)
    다중 에이전트 충돌 해소(CBS)는 solve_multi_agent()를 통해 호출.

    단일 호출 시 MLA* 단독 결과 반환 — 결정론적 → confidence=1.0
    """

    def predict(
        self,
        graph: nx.DiGraph,
        source_id: str,
        dest_id: str,
        unit_labels: dict[str, str],
        dynamic_weights: Optional[dict[str, float]] = None,
    ) -> tuple[list[str], float, float]:
        from engine.cbs_ts.mla_star import mla_star

        # 출발 노드 속성에서 amr_type 추정 (없으면 TYPE_A 기본값)
        amr_type = self._infer_amr_type(graph, source_id)

        path, cost = mla_star(graph, source_id, dest_id, amr_type=amr_type)
        return path, cost, 1.0  # 결정론적 → confidence=1.0

    @staticmethod
    def _infer_amr_type(graph: nx.DiGraph, node_id: str) -> str:
        """그래프 노드 속성에서 amr_type 추정. 없으면 TYPE_A."""
        if node_id in graph:
            attrs = graph.nodes[node_id]
            return attrs.get("amr_type", "TYPE_A")
        return "TYPE_A"

    @property
    def is_available(self) -> bool:
        try:
            import pulp  # noqa: F401
            return True
        except ImportError:
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
