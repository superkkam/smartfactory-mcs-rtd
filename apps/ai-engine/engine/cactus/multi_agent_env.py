"""
CACTUS 다중 에이전트 MAPF 환경 (Task 025)

실 layout NetworkX DiGraph 위에서 동작하는 PettingZoo ParallelEnv.
route_env.py의 단일 에이전트 패턴을 멀티에이전트로 확장.

관측 (3*MAX_NODES + MAX_NEIGHBORS):
  [자기 onehot | 목표 onehot | 다른 에이전트 위치 마스크 | 이웃 점유 마스크]

행동: Discrete(MAX_NEIGHBORS) — 이웃 노드 인덱스

보상:
  목적지 도달: +100
  스텝 비용:   -1 (또는 -edge_weight)
  충돌/정지:   -10
  무효 액션:   -10
  최대 스텝:   -50

충돌 처리 룰 (vertex/edge):
  vertex 충돌: 동일 노드에 복수 에이전트 진입 시 agent_id 알파벳 우선 1명만 이동
  edge swap:   A→B, B→A 동시 → 둘 다 정지
  무효 인덱스: 제자리

의존성: pettingzoo>=1.24
"""
from __future__ import annotations
import random
import networkx as nx
import numpy as np
from gymnasium import spaces
from pettingzoo import ParallelEnv
from typing import Any, Dict, List, Optional, Tuple

MAX_NODES = 100
MAX_NEIGHBORS = 10


class GraphMAPFEnv(ParallelEnv):
    """
    그래프 기반 MAPF 멀티에이전트 환경.
    학습 시 QMIX mixer와 함께 사용하고,
    추론 시 각 에이전트가 분산적으로(disentrailzed) 행동 선택.
    """

    metadata = {"name": "graph_mapf_v0", "is_parallelizable": True}

    def __init__(
        self,
        graph: nx.DiGraph,
        agent_tasks: List[Tuple[str, str]],
        max_steps: int = 200,
    ):
        """
        Args:
            graph:       NetworkX DiGraph (unit uuid 노드, 가중 엣지)
            agent_tasks: [(src_uuid, dst_uuid), ...] 에이전트별 작업
            max_steps:   에피소드 최대 스텝
        """
        super().__init__()
        assert len(agent_tasks) > 0, "agent_tasks가 비어 있습니다"
        assert len(graph.nodes()) > 0, "그래프에 노드가 없습니다"

        self.graph = graph
        self._agent_tasks = agent_tasks
        self.max_steps = max_steps

        self.node_list: List[str] = list(graph.nodes())
        self.n_nodes = len(self.node_list)
        self.node_idx: Dict[str, int] = {n: i for i, n in enumerate(self.node_list)}

        n = len(agent_tasks)
        self.possible_agents: List[str] = [f"amr_{i}" for i in range(n)]
        self.agents: List[str] = list(self.possible_agents)

        self._task_map: Dict[str, Tuple[str, str]] = dict(zip(self.agents, agent_tasks))

        # 관측/행동 공간
        obs_dim = 3 * MAX_NODES + MAX_NEIGHBORS
        self._obs_space = spaces.Box(0.0, 1.0, (obs_dim,), dtype=np.float32)
        self._act_space = spaces.Discrete(MAX_NEIGHBORS)

        # 에피소드 상태 (reset에서 초기화)
        self._positions: Dict[str, str] = {}
        self._goals: Dict[str, str] = {}
        self._done: Dict[str, bool] = {}
        self._step_count = 0

    # ── PettingZoo 공간 접근자 ──────────────────────────────────────

    def observation_space(self, agent: str) -> spaces.Space:
        return self._obs_space

    def action_space(self, agent: str) -> spaces.Space:
        return self._act_space

    # ── 리셋 ──────────────────────────────────────────────────────

    def reset(
        self,
        seed: Optional[int] = None,
        options: Optional[dict] = None,
    ) -> Tuple[Dict[str, np.ndarray], Dict[str, dict]]:
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)

        self.agents = list(self.possible_agents)
        self._positions = {a: src for a, (src, dst) in self._task_map.items()}
        self._goals = {a: dst for a, (src, dst) in self._task_map.items()}
        self._done = {a: False for a in self.agents}
        self._step_count = 0

        obs = {a: self._get_obs(a) for a in self.agents}
        infos = {a: {} for a in self.agents}
        return obs, infos

    # ── 스텝 ──────────────────────────────────────────────────────

    def step(
        self,
        actions: Dict[str, int],
    ) -> Tuple[
        Dict[str, np.ndarray],
        Dict[str, float],
        Dict[str, bool],
        Dict[str, bool],
        Dict[str, dict],
    ]:
        self._step_count += 1
        active = [a for a in self.agents if not self._done[a]]

        # 1) 각 에이전트의 의도 노드 결정
        intended: Dict[str, Optional[str]] = {}
        invalid: Dict[str, bool] = {}
        for agent in active:
            cur = self._positions[agent]
            neighbors = list(self.graph.successors(cur))
            act = int(actions.get(agent, 0))
            if act < len(neighbors):
                intended[agent] = neighbors[act]
                invalid[agent] = False
            else:
                intended[agent] = None  # 무효 액션 → 제자리
                invalid[agent] = True

        # 2) 충돌 처리
        collisions: set[str] = set()

        # vertex 충돌: 동일 목적지에 복수 에이전트 → ID 우선 1명만
        dest_agents: Dict[str, List[str]] = {}
        for agent, dst in intended.items():
            if dst is not None:
                dest_agents.setdefault(dst, []).append(agent)

        for dst, group in dest_agents.items():
            if len(group) > 1:
                group_sorted = sorted(group)  # 알파벳 우선 = 첫 번째
                for blocked in group_sorted[1:]:
                    intended[blocked] = None
                    collisions.add(blocked)

        # edge swap 충돌: A→B, B→A 동시 → 둘 다 제자리
        for a1 in active:
            for a2 in active:
                if a1 >= a2:
                    continue
                if (intended.get(a1) == self._positions.get(a2) and
                        intended.get(a2) == self._positions.get(a1)):
                    intended[a1] = None
                    intended[a2] = None
                    collisions.add(a1)
                    collisions.add(a2)

        # 3) 이동 적용 + 보상 계산
        rewards: Dict[str, float] = {}
        terminations: Dict[str, bool] = {}
        truncations: Dict[str, bool] = {}

        for agent in self.agents:
            if self._done[agent]:
                rewards[agent] = 0.0
                terminations[agent] = True
                truncations[agent] = False
                continue

            if invalid.get(agent):
                rewards[agent] = -10.0
            elif agent in collisions:
                rewards[agent] = -10.0
            else:
                nxt = intended.get(agent)
                if nxt is not None:
                    w = self.graph[self._positions[agent]][nxt].get("weight", 1.0)
                    self._positions[agent] = nxt
                    if nxt == self._goals[agent]:
                        rewards[agent] = 100.0
                        self._done[agent] = True
                    else:
                        rewards[agent] = -float(w)
                else:
                    rewards[agent] = -1.0  # 제자리 유지

            term = self._done[agent]
            trunc = (not term) and (self._step_count >= self.max_steps)
            if trunc:
                self._done[agent] = True
            terminations[agent] = term
            truncations[agent] = trunc

        # 완료된 에이전트 agents 목록에서 제거
        self.agents = [a for a in self.agents if not self._done[a]]

        obs = {a: self._get_obs(a) for a in self.agents}
        infos = {a: {"step": self._step_count} for a in self.agents}

        return obs, rewards, terminations, truncations, infos

    # ── 상태/관측 ─────────────────────────────────────────────────

    def _get_obs(self, agent: str) -> np.ndarray:
        """3*MAX_NODES + MAX_NEIGHBORS 크기 관측 벡터"""
        obs = np.zeros(3 * MAX_NODES + MAX_NEIGHBORS, dtype=np.float32)
        pos = self._positions.get(agent, "")
        goal = self._goals.get(agent, "")

        # [0:MAX_NODES] 자기 위치 onehot
        ci = self.node_idx.get(pos, -1)
        if 0 <= ci < MAX_NODES:
            obs[ci] = 1.0

        # [MAX_NODES:2*MAX_NODES] 목표 onehot
        gi = self.node_idx.get(goal, -1)
        if 0 <= gi < MAX_NODES:
            obs[MAX_NODES + gi] = 1.0

        # [2*MAX_NODES:3*MAX_NODES] 다른 에이전트 위치 마스크
        for other, opos in self._positions.items():
            if other == agent:
                continue
            oi = self.node_idx.get(opos, -1)
            if 0 <= oi < MAX_NODES:
                obs[2 * MAX_NODES + oi] = 1.0

        # [3*MAX_NODES:3*MAX_NODES+MAX_NEIGHBORS] 이웃 노드 점유 마스크
        neighbors = list(self.graph.successors(pos))
        occupied = set(self._positions.values())
        for k, nb in enumerate(neighbors[:MAX_NEIGHBORS]):
            if nb in occupied:
                obs[3 * MAX_NODES + k] = 1.0

        return obs

    def get_state(self) -> np.ndarray:
        """
        QMIX mixer 입력용 글로벌 state.
        shape: (2 * MAX_NODES * n_agents,)
        모든 에이전트의 [위치 onehot | 목표 onehot] 연결.
        """
        n = len(self.possible_agents)
        state = np.zeros(2 * MAX_NODES * n, dtype=np.float32)
        for i, agent in enumerate(self.possible_agents):
            pos = self._positions.get(agent, "")
            goal = self._goals.get(agent, "")
            base = i * 2 * MAX_NODES
            pi = self.node_idx.get(pos, -1)
            gi = self.node_idx.get(goal, -1)
            if 0 <= pi < MAX_NODES:
                state[base + pi] = 1.0
            if 0 <= gi < MAX_NODES:
                state[base + MAX_NODES + gi] = 1.0
        return state

    def state_dim(self) -> int:
        """mixer 입력 state 차원"""
        return 2 * MAX_NODES * len(self.possible_agents)

    def obs_dim(self) -> int:
        return 3 * MAX_NODES + MAX_NEIGHBORS

    def render(self) -> None:
        pass

    def close(self) -> None:
        pass


def sample_agent_tasks(
    graph: nx.DiGraph,
    n_agents: int,
    bfs_max_dist: int = 5,
    seed: Optional[int] = None,
) -> List[Tuple[str, str]]:
    """
    그래프에서 BFS 거리 ≤ bfs_max_dist인 (src, dst) 쌍 n_agents 개 샘플링.
    Reverse Curriculum에서 난이도(bfs_max_dist) 증가 시 더 먼 쌍을 배정.
    """
    if seed is not None:
        random.seed(seed)

    nodes = [n for n in graph.nodes() if graph.out_degree(n) > 0]
    if len(nodes) < 2:
        raise ValueError("그래프 노드 수 부족 (최소 2개의 out-edge 보유 노드 필요)")

    tasks: List[Tuple[str, str]] = []
    attempts = 0
    max_attempts = n_agents * 50

    while len(tasks) < n_agents and attempts < max_attempts:
        attempts += 1
        src, dst = random.sample(nodes, 2)
        if not nx.has_path(graph, src, dst):
            continue
        dist = nx.shortest_path_length(graph, src, dst)
        if 1 <= dist <= bfs_max_dist:
            tasks.append((src, dst))

    if len(tasks) < n_agents:
        # 거리 제한 완화 후 재시도
        while len(tasks) < n_agents and attempts < max_attempts * 2:
            attempts += 1
            src, dst = random.sample(nodes, 2)
            if nx.has_path(graph, src, dst):
                tasks.append((src, dst))

    if len(tasks) < n_agents:
        raise ValueError(
            f"요청 에이전트 수({n_agents})에 맞는 (src, dst) 쌍을 찾지 못했습니다 "
            f"(그래프 노드 {len(nodes)}개, bfs_max_dist={bfs_max_dist})"
        )

    return tasks
