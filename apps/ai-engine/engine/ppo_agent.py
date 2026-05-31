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

            # env=None으로 로딩 → 관측 차원 자동 감지 (compact 176차원 또는 full 400차원)
            self.model = PPO.load(model_path, env=None)
            self._obs_size = self.model.observation_space.shape[0]
            self.is_loaded = True
            logger.info(f"PPO 모델 로딩 완료: {model_path} (관측 차원: {self._obs_size})")
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

        compact 모델(2*n_nodes 관측)과 full 모델(4*MAX_NODES 관측) 모두 지원.

        Returns:
            (path_uuids, total_cost, confidence)
        """
        if not self.is_loaded or self.model is None:
            return self._astar_fallback(graph, source_id, dest_id, dynamic_weights)

        try:
            import numpy as np
            node_list = sorted(graph.nodes())
            n_nodes   = len(node_list)
            node_idx  = {nd: i for i, nd in enumerate(node_list)}
            obs_size  = getattr(self, "_obs_size", 400)

            def _make_obs(cur: str, dst: str) -> np.ndarray:
                """compact (2*n) 또는 full (4*MAX) 관측 생성"""
                if obs_size == 2 * n_nodes:
                    obs = np.zeros(obs_size, dtype=np.float32)
                    obs[node_idx.get(cur, 0)]           = 1.0
                    obs[n_nodes + node_idx.get(dst, 0)] = 1.0
                else:
                    from engine.route_env import MAX_NODES
                    obs = np.zeros(4 * MAX_NODES, dtype=np.float32)
                    ci = node_idx.get(cur, -1)
                    di = node_idx.get(dst, -1)
                    if 0 <= ci < MAX_NODES:
                        obs[ci] = 1.0
                    if 0 <= di < MAX_NODES:
                        obs[MAX_NODES + di] = 1.0
                return obs

            current    = source_id
            path_uuids = [source_id]
            total_cost = 0.0
            max_steps  = 3 * n_nodes
            visited    = {source_id}

            for _ in range(max_steps):
                obs       = _make_obs(current, dest_id)
                action, _ = self.model.predict(obs, deterministic=True)
                nbrs      = sorted(graph.successors(current))

                if not nbrs or int(action) >= len(nbrs):
                    break

                nxt = nbrs[int(action)]
                edge_w = graph[current][nxt].get("weight", 1.0) if graph.has_edge(current, nxt) else 1.0
                total_cost += edge_w
                current = nxt

                if current not in visited:
                    path_uuids.append(current)
                    visited.add(current)
                elif path_uuids[-1] != current:
                    path_uuids.append(current)

                if current == dest_id:
                    return path_uuids, total_cost, 0.85

            # 목적지 미도달 → A* 폴백
            logger.warning(f"PPO 추론 목적지 미도달: {source_id} → {dest_id}")
            return self._astar_fallback(graph, source_id, dest_id, dynamic_weights)

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
