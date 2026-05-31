"""
PPO Smoke 학습 — 합성 4×4 그리드 (Supabase 없이 동작)

관측 공간을 작게 유지하고 BFS 거리 기반 보상 쉐이핑을 추가해
30,000 스텝 내 80%+ 성공률 달성.

저장: trained_models/ppo_smoke.zip

사용법:
    cd apps/ai-engine
    .venv/bin/python scripts/train_ppo_smoke.py [--steps 30000]
"""
import sys, os, argparse, logging, random
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import gymnasium as gym
from gymnasium import spaces
import networkx as nx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

GRID_SIZE = 4   # 4×4 = 16 노드 (관측 32차원으로 충분히 작음)


def build_grid_graph(size: int):
    G = nx.DiGraph()
    node_ids = {}
    for r in range(size):
        for c in range(size):
            nid = f"n{r}_{c}"
            node_ids[(r, c)] = nid
            G.add_node(nid, unit_type="Port")
    for r in range(size):
        for c in range(size):
            for dr, dc in [(0, 1), (1, 0)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < size and 0 <= nc < size:
                    u = node_ids[(r, c)]
                    v = node_ids[(nr, nc)]
                    G.add_edge(u, v, weight=1.0)
                    G.add_edge(v, u, weight=1.0)
    return G, list(node_ids.values())


class SmallRouteEnv(gym.Env):
    """소형 경로 탐색 환경 (smoke 학습 전용 — BFS 거리 보상 쉐이핑 포함)"""

    MAX_NEIGHBORS = 4

    def __init__(self, graph: nx.DiGraph, node_list: list):
        super().__init__()
        self.graph     = graph
        self.nodes     = sorted(node_list)
        self.n         = len(self.nodes)
        self.idx       = {n: i for i, n in enumerate(self.nodes)}

        # BFS 거리 사전 계산
        self._dist: dict[tuple[str, str], int] = {}
        for src in self.nodes:
            lengths = nx.single_source_shortest_path_length(graph, src)
            for dst, d in lengths.items():
                self._dist[(src, dst)] = d

        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(2 * self.n,), dtype=np.float32
        )
        self.action_space = spaces.Discrete(self.MAX_NEIGHBORS)

        self._cur: str  = self.nodes[0]
        self._dst: str  = self.nodes[-1]
        self._steps: int = 0
        self._max_steps: int = 3 * self.n

    def _obs(self):
        obs = np.zeros(2 * self.n, dtype=np.float32)
        obs[self.idx[self._cur]] = 1.0
        obs[self.n + self.idx[self._dst]] = 1.0
        return obs

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        pairs = [(s, d) for s in self.nodes for d in self.nodes if s != d and (s, d) in self._dist]
        self._cur, self._dst = random.choice(pairs)
        self._steps = 0
        return self._obs(), {}

    def step(self, action: int):
        self._steps += 1
        nbrs = sorted(self.graph.successors(self._cur))

        if not nbrs or action >= len(nbrs):
            return self._obs(), -5.0, False, self._steps >= self._max_steps, {}

        prev_dist = self._dist.get((self._cur, self._dst), self.n)
        nxt = nbrs[action]
        self._cur = nxt

        terminated = self._cur == self._dst
        truncated  = (not terminated) and self._steps >= self._max_steps

        if terminated:
            reward = 50.0
        elif truncated:
            reward = -20.0
        else:
            new_dist = self._dist.get((self._cur, self._dst), self.n)
            reward = float(prev_dist - new_dist)  # 목표에 가까워지면 +1, 멀어지면 -1

        return self._obs(), reward, terminated, truncated, {}


def evaluate_model(model, env_class, graph, node_list, n_episodes=100):
    success = 0
    for _ in range(n_episodes):
        env = env_class(graph, node_list)
        obs, _ = env.reset()
        for _ in range(3 * len(node_list)):
            action, _ = model.predict(obs, deterministic=True)
            obs, _, terminated, truncated, _ = env.step(int(action))
            if terminated:
                success += 1
                break
            if truncated:
                break
    rate = success / n_episodes * 100
    logger.info(f"평가: {success}/{n_episodes} 성공 ({rate:.1f}%)")
    return rate


def train_smoke(total_steps: int, output_path: str) -> float:
    from stable_baselines3 import PPO
    from stable_baselines3.common.env_util import make_vec_env

    graph, node_list = build_grid_graph(GRID_SIZE)
    logger.info(f"합성 그래프: {len(graph.nodes())}노드 ({GRID_SIZE}×{GRID_SIZE} 그리드)")

    def make_env():
        return SmallRouteEnv(graph, node_list)

    n_envs = min(4, os.cpu_count() or 1)
    env    = make_vec_env(make_env, n_envs=n_envs)

    model = PPO(
        policy="MlpPolicy",
        env=env,
        learning_rate=3e-4,
        n_steps=512,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        ent_coef=0.01,
        verbose=1,
    )

    logger.info(f"PPO smoke 학습 시작: {total_steps}스텝")
    model.learn(total_timesteps=total_steps, progress_bar=True)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    model.save(output_path)
    logger.info(f"모델 저장: {output_path}.zip")

    rate = evaluate_model(model, SmallRouteEnv, graph, node_list)
    if rate < 80:
        logger.warning(f"성공률 {rate:.1f}% < 80% — 스텝 증가 권장")
    else:
        logger.info(f"smoke 학습 통과: 성공률 {rate:.1f}% >= 80%")
    return rate


def main():
    parser = argparse.ArgumentParser(description="PPO smoke 학습")
    parser.add_argument("--steps",  type=int, default=30_000)
    parser.add_argument("--output", default="trained_models/ppo_smoke")
    args = parser.parse_args()
    train_smoke(args.steps, args.output)


if __name__ == "__main__":
    main()
