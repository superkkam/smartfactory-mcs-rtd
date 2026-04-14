"""
Gymnasium 커스텀 환경: McsRouteEnv
PPO 학습/추론을 위한 MCS 반송 경로 탐색 환경

Observation (4 * MAX_NODES):
  [현재노드 원핫 | 목적노드 원핫 | 동적가중치 | 방문이력]

Action (Discrete):
  현재 노드의 이웃 인덱스 (0 ~ max_neighbors-1)

Reward:
  목적지 도달: +100
  각 스텝: -edge_weight * (1 + congestion_factor)
  재방문: -50
  무효 액션: -10
  최대 스텝 초과: -100
"""
import numpy as np
import gymnasium as gym
from gymnasium import spaces
from typing import Dict, List, Optional, Tuple, Any
import networkx as nx


MAX_NODES = 100        # 최대 노드 수 (zero-padding)
MAX_NEIGHBORS = 10     # 최대 이웃 노드 수 (Discrete action space 크기)


class McsRouteEnv(gym.Env):
    """MCS 반송 경로 탐색 Gymnasium 환경"""

    metadata = {"render_modes": []}

    def __init__(
        self,
        graph: nx.DiGraph,
        source_id: str,
        dest_id: str,
        dynamic_weights: Optional[Dict[str, float]] = None,
    ):
        """
        Args:
            graph: NetworkX DiGraph (노드 ID = DB uuid)
            source_id: 출발 유닛 uuid
            dest_id: 목적 유닛 uuid
            dynamic_weights: {unit_uuid: congestion_factor (0~1)} 혼잡도 맵
        """
        super().__init__()

        self.graph = graph
        self.source_id = source_id
        self.dest_id = dest_id
        self.dynamic_weights = dynamic_weights or {}

        # 노드 리스트 + uuid↔정수 인덱스 매핑
        self.node_list: List[str] = list(graph.nodes())
        self.n_nodes = len(self.node_list)
        self.uuid_to_idx: Dict[str, int] = {uid: i for i, uid in enumerate(self.node_list)}

        # Gymnasium 공간 정의
        obs_size = 4 * MAX_NODES
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(obs_size,), dtype=np.float32
        )
        self.action_space = spaces.Discrete(MAX_NEIGHBORS)

        # 에피소드 상태
        self._current_id: str = source_id
        self._visited: set = set()
        self._step_count: int = 0
        self._max_steps: int = 2 * self.n_nodes

    # ── 리셋 ──────────────────────────────────────────────────────

    def reset(
        self,
        seed: Optional[int] = None,
        options: Optional[dict] = None,
        *,
        source_id: Optional[str] = None,
        dest_id: Optional[str] = None,
        graph: Optional[nx.DiGraph] = None,
        dynamic_weights: Optional[Dict[str, float]] = None,
    ) -> Tuple[np.ndarray, dict]:
        """에피소드 초기화. 그래프/출발지/목적지/혼잡도 업데이트 가능."""
        super().reset(seed=seed)

        # 그래프 교체 (레이아웃이 다를 때)
        if graph is not None:
            self.graph = graph
            self.node_list = list(graph.nodes())
            self.n_nodes = len(self.node_list)
            self.uuid_to_idx = {uid: i for i, uid in enumerate(self.node_list)}
            self._max_steps = 2 * self.n_nodes

        if source_id is not None:
            self.source_id = source_id
        if dest_id is not None:
            self.dest_id = dest_id
        if dynamic_weights is not None:
            self.dynamic_weights = dynamic_weights

        self._current_id = self.source_id
        self._visited = {self.source_id}
        self._step_count = 0

        return self._get_obs(), {}

    # ── 스텝 ──────────────────────────────────────────────────────

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, dict]:
        """
        액션: 현재 노드 이웃 인덱스 선택
        반환: (obs, reward, terminated, truncated, info)
        """
        self._step_count += 1
        neighbors = list(self.graph.successors(self._current_id))

        # 무효 액션 (이웃 범위 초과)
        if action >= len(neighbors):
            obs = self._get_obs()
            return obs, -10.0, False, self._step_count >= self._max_steps, {
                "current_node_uuid": self._current_id,
                "step_cost": 0.0,
                "invalid_action": True,
            }

        next_id = neighbors[action]
        edge_weight = self.graph[self._current_id][next_id].get("weight", 1.0)
        congestion = self.dynamic_weights.get(next_id, 0.0)

        # 보상 계산
        if next_id == self.dest_id:
            reward = 100.0
            terminated = True
        elif next_id in self._visited:
            reward = -50.0  # 재방문 패널티
            terminated = False
        else:
            reward = -edge_weight * (1.0 + congestion)
            terminated = False

        step_cost = edge_weight
        self._current_id = next_id
        self._visited.add(next_id)

        truncated = (not terminated) and (self._step_count >= self._max_steps)
        if truncated:
            reward = -100.0

        obs = self._get_obs()
        return obs, reward, terminated, truncated, {
            "current_node_uuid": self._current_id,
            "step_cost": step_cost,
            "invalid_action": False,
        }

    # ── 관측 생성 ─────────────────────────────────────────────────

    def _get_obs(self) -> np.ndarray:
        """현재 상태를 4*MAX_NODES 크기의 float32 벡터로 변환"""
        obs = np.zeros(4 * MAX_NODES, dtype=np.float32)

        current_idx = self.uuid_to_idx.get(self._current_id, -1)
        dest_idx = self.uuid_to_idx.get(self.dest_id, -1)

        # [0:MAX_NODES] 현재 노드 원핫
        if 0 <= current_idx < MAX_NODES:
            obs[current_idx] = 1.0

        # [MAX_NODES:2*MAX_NODES] 목적 노드 원핫
        if 0 <= dest_idx < MAX_NODES:
            obs[MAX_NODES + dest_idx] = 1.0

        # [2*MAX_NODES:3*MAX_NODES] 동적 가중치(혼잡도)
        for uid, weight in self.dynamic_weights.items():
            idx = self.uuid_to_idx.get(uid, -1)
            if 0 <= idx < MAX_NODES:
                obs[2 * MAX_NODES + idx] = float(weight)

        # [3*MAX_NODES:4*MAX_NODES] 방문 이력
        for uid in self._visited:
            idx = self.uuid_to_idx.get(uid, -1)
            if 0 <= idx < MAX_NODES:
                obs[3 * MAX_NODES + idx] = 1.0

        return obs
