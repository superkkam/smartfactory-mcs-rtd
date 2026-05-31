"""
QMIX 에이전트 싱글턴 (Task 025)

학습 완료 후 체크포인트를 로드하여 단일 에이전트 분산 추론에 사용.
PpoAgent(engine/ppo_agent.py) 패턴을 미러링.

체크포인트 포맷:
    torch.save({
        'q_net': q_net.state_dict(),
        'mixer': mixer.state_dict(),
        'meta': {'n_agents': N, 'obs_dim': D, 'state_dim': S, 'embed_dim': E},
    }, path)
"""
from __future__ import annotations
import os
import logging
from typing import Dict, List, Optional, Tuple

import networkx as nx

logger = logging.getLogger(__name__)

MAX_NODES = 100
MAX_NEIGHBORS = 10


class AgentQNet:
    """per-agent Q-network (MLP). 학습/추론 공통 사용."""

    def __init__(self, obs_dim: int, n_actions: int, hidden_dim: int = 64):
        import torch.nn as nn
        self.net = nn.Sequential(
            nn.Linear(obs_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, n_actions),
        )

    def __call__(self, x):
        return self.net(x)

    def parameters(self):
        return self.net.parameters()

    def state_dict(self):
        return self.net.state_dict()

    def load_state_dict(self, sd):
        self.net.load_state_dict(sd)

    def eval(self):
        self.net.eval()
        return self

    def to(self, device):
        self.net.to(device)
        return self


class QmixAgent:
    """QMIX 로딩/추론 싱글턴"""

    _instance: Optional["QmixAgent"] = None

    def __init__(self):
        self.q_net: Optional[AgentQNet] = None
        self.is_loaded: bool = False
        self.checkpoint_path: str = ""
        self._obs_dim: int = 3 * MAX_NODES + MAX_NEIGHBORS
        self._n_actions: int = MAX_NEIGHBORS

    @classmethod
    def get_instance(cls) -> "QmixAgent":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load(self, model_path: str) -> bool:
        """
        체크포인트 로딩 (서버 시작 시 호출).

        Returns:
            True: 로딩 성공, False: 파일 없음 (503 모드)
        """
        self.checkpoint_path = model_path

        if not os.path.exists(model_path):
            logger.warning(f"CACTUS 체크포인트 없음: {model_path} → 503 모드")
            self.is_loaded = False
            return False

        try:
            import torch
            ckpt = torch.load(model_path, map_location="cpu", weights_only=False)
            meta = ckpt.get("meta", {})
            obs_dim = meta.get("obs_dim", self._obs_dim)
            n_actions = meta.get("n_actions", self._n_actions)

            # hidden_dim: state_dict 첫 번째 레이어 편향 크기로 자동 추론
            q_sd = ckpt["q_net"]
            hidden_dim = q_sd["0.bias"].shape[0] if "0.bias" in q_sd else 64

            self.q_net = AgentQNet(obs_dim, n_actions, hidden_dim=hidden_dim)
            self.q_net.load_state_dict(q_sd)
            self.q_net.eval()
            self._obs_dim = obs_dim
            self._n_actions = n_actions
            self.is_loaded = True
            logger.info(f"CACTUS QMix 체크포인트 로딩 완료: {model_path}")
            return True
        except Exception as e:
            logger.error(f"CACTUS 체크포인트 로딩 실패: {e}")
            self.is_loaded = False
            return False

    def predict_single(
        self,
        graph: nx.DiGraph,
        source_id: str,
        dest_id: str,
        unit_labels: Dict[str, str],
        dynamic_weights: Optional[Dict[str, float]] = None,
    ) -> Tuple[List[str], float, float]:
        """
        단일 에이전트 분산 추론 (CTDE의 decentralized 부분).

        학습된 per-agent Q-net을 사용해 greedy action 선택.
        목적지 미도달 시 A* fallback.
        """
        if not self.is_loaded or self.q_net is None:
            return self._astar_fallback(graph, source_id, dest_id)

        try:
            import torch
            import numpy as np

            node_list = list(graph.nodes())
            n_nodes = len(node_list)
            node_idx = {n: i for i, n in enumerate(node_list)}

            # 목표 없는 노드 처리
            if source_id not in node_idx or dest_id not in node_idx:
                return self._astar_fallback(graph, source_id, dest_id)

            current = source_id
            path = [source_id]
            total_cost = 0.0
            max_steps = 3 * n_nodes
            visited: set[str] = {source_id}

            # 더미 agent 위치 (단일 추론 시 타 에이전트 없음 → 0)
            dummy_others = np.zeros(MAX_NODES, dtype=np.float32)

            for _ in range(max_steps):
                neighbors = list(graph.successors(current))
                if not neighbors:
                    break

                # 관측 벡터 구성 (GraphMAPFEnv._get_obs와 동일 포맷)
                obs = np.zeros(3 * MAX_NODES + MAX_NEIGHBORS, dtype=np.float32)
                ci = node_idx.get(current, -1)
                gi = node_idx.get(dest_id, -1)
                if 0 <= ci < MAX_NODES:
                    obs[ci] = 1.0
                if 0 <= gi < MAX_NODES:
                    obs[MAX_NODES + gi] = 1.0
                # 이웃 점유 마스크 (단일 에이전트라 빈 상태)
                for k, nb in enumerate(neighbors[:MAX_NEIGHBORS]):
                    if nb in visited:
                        obs[3 * MAX_NODES + k] = 1.0

                obs_t = torch.tensor(obs, dtype=torch.float32).unsqueeze(0)
                with torch.no_grad():
                    q_vals = self.q_net(obs_t).squeeze(0)  # (n_actions,)

                # 유효 이웃 범위 내에서 greedy
                n_valid = min(len(neighbors), self._n_actions)
                action = int(q_vals[:n_valid].argmax().item())
                nxt = neighbors[action]

                edge_w = graph[current][nxt].get("weight", 1.0)
                total_cost += edge_w
                current = nxt

                if current not in visited:
                    path.append(current)
                    visited.add(current)
                elif path[-1] != current:
                    path.append(current)

                if current == dest_id:
                    return path, total_cost, 0.75

            # 목적지 미도달 → A* fallback
            logger.warning(f"CACTUS 추론 목적지 미도달: {source_id} → {dest_id}")
            return self._astar_fallback(graph, source_id, dest_id)

        except Exception as e:
            logger.error(f"CACTUS 추론 오류: {e} → A* fallback")
            return self._astar_fallback(graph, source_id, dest_id)

    def _astar_fallback(
        self,
        graph: nx.DiGraph,
        source_id: str,
        dest_id: str,
    ) -> Tuple[List[str], float, float]:
        from engine.astar import run_astar
        path, cost = run_astar(graph, source_id, dest_id)
        return path, cost, 0.0


# 전역 싱글턴
qmix_agent = QmixAgent.get_instance()
