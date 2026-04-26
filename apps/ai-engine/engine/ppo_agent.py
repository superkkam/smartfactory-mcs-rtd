"""
PPO 모델 로딩 + 경로 추론 싱글턴
Stable-Baselines3 PPO 기반

모델 미존재 시 Python A* 폴백:
  - confidence=0.0, fallback=True 반환
  - /api/health에서 modelLoaded=False 표시
"""
import os
import time
import logging
from typing import Dict, List, Optional, Tuple
import networkx as nx

logger = logging.getLogger(__name__)


class PpoAgent:
    """PPO 모델 로딩/추론 싱글턴"""

    _instance: Optional["PpoAgent"] = None

    def __init__(self):
        self.model = None
        self.is_loaded: bool = False
        self.model_path: str = ""

    @classmethod
    def get_instance(cls) -> "PpoAgent":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load(self, model_path: str) -> bool:
        """
        PPO 모델 로딩 (서버 시작 시 호출)

        Returns:
            True: 로딩 성공, False: 파일 없음 (폴백 모드)
        """
        self.model_path = model_path

        if not os.path.exists(model_path):
            logger.warning(f"PPO 모델 파일 없음: {model_path} → A* 폴백 모드로 동작")
            self.is_loaded = False
            return False

        try:
            from stable_baselines3 import PPO
            from engine.route_env import McsRouteEnv
            import networkx as nx

            # 더미 그래프로 환경 생성 (모델 로딩용)
            dummy_graph = nx.DiGraph()
            dummy_graph.add_edge("a", "b", weight=1.0)
            dummy_env = McsRouteEnv(dummy_graph, "a", "b")

            self.model = PPO.load(model_path, env=dummy_env)
            self.is_loaded = True
            logger.info(f"PPO 모델 로딩 완료: {model_path}")
            return True
        except Exception as e:
            logger.error(f"PPO 모델 로딩 실패: {e} → A* 폴백 모드")
            self.is_loaded = False
            return False

    def predict(
        self,
        graph: nx.DiGraph,
        source_id: str,
        dest_id: str,
        unit_labels: Dict[str, str],
        dynamic_weights: Optional[Dict[str, float]] = None,
    ) -> Tuple[List[str], float, float]:
        """
        PPO 경로 추론 (모델 미존재 시 A* 폴백)

        Returns:
            (path_uuids, total_cost, confidence)
            - path_uuids: 유닛 uuid 리스트
            - total_cost: 총 경로 비용
            - confidence: 0~1 (폴백 시 0.0)
        """
        if not self.is_loaded or self.model is None:
            return self._astar_fallback(graph, source_id, dest_id, dynamic_weights)

        try:
            from engine.route_env import McsRouteEnv
            weights = dynamic_weights or {}

            env = McsRouteEnv(graph, source_id, dest_id, weights)
            obs, _ = env.reset()

            path_uuids = [source_id]
            total_cost = 0.0
            max_steps = 2 * len(graph.nodes)

            for _ in range(max_steps):
                action, _ = self.model.predict(obs, deterministic=True)
                obs, _, terminated, truncated, info = env.step(int(action))

                current_node = info.get("current_node_uuid", "")
                step_cost = info.get("step_cost", 0.0)

                if current_node and current_node != path_uuids[-1]:
                    path_uuids.append(current_node)
                    total_cost += step_cost

                if terminated:
                    # 목적지 도달: 높은 신뢰도
                    confidence = 0.85
                    return path_uuids, total_cost, confidence

                if truncated:
                    break

            # 목적지 미도달: 낮은 신뢰도로 현재 경로 반환
            logger.warning(f"PPO 추론 최대 스텝 초과: {source_id} → {dest_id}")
            return path_uuids, total_cost, 0.3

        except Exception as e:
            logger.error(f"PPO 추론 오류: {e} → A* 폴백")
            return self._astar_fallback(graph, source_id, dest_id, dynamic_weights)

    def _astar_fallback(
        self,
        graph: nx.DiGraph,
        source_id: str,
        dest_id: str,
        dynamic_weights: Optional[Dict[str, float]] = None,
    ) -> Tuple[List[str], float, float]:
        """
        PPO 미사용 시 폴백 (confidence=0.0)

        dynamicWeights가 있으면 혼잡 반영 A*를 사용하여 AI 경로를 차별화.
        dynamicWeights가 없으면 일반 A*와 동일하므로 경로 차이 없음.
        """
        if dynamic_weights:
            from engine.astar import run_astar_congestion
            path, cost = run_astar_congestion(graph, source_id, dest_id, dynamic_weights)
        else:
            from engine.astar import run_astar
            path, cost = run_astar(graph, source_id, dest_id)
        return path, cost, 0.0


# 전역 싱글턴
ppo_agent = PpoAgent.get_instance()
