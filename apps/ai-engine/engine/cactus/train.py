"""
CACTUS 학습 진입점 (Task 025)

QMix CTDE 학습 루프:
  1. Supabase에서 layout 로드 → NetworkX DiGraph
  2. ReverseCurriculumScheduler: 초기 BFS 거리 짧음 → 점진 확장
  3. ε-greedy 탐색 + ReplayBuffer + per-agent Q-net 학습
  4. Mixer(QMixMixer)를 통한 CTDE Q_tot 최적화
  5. Target Q-net 주기적 업데이트
  6. 체크포인트 저장: trained_models/cactus_qmix.pt

실행 예:
    python -m engine.cactus.train \
        --layout-id <uuid> --n-agents 4 --n-episodes 500 --seed 0 \
        --output trained_models/cactus_qmix.pt
"""
from __future__ import annotations
import argparse
import os
import random
import sys
import logging
from collections import deque
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

from engine.cactus.multi_agent_env import GraphMAPFEnv, sample_agent_tasks, MAX_NODES, MAX_NEIGHBORS
from engine.cactus.qmix_mixer import QMixMixer
from engine.cactus.qmix_agent import AgentQNet
from engine.cactus.reverse_curriculum import ReverseCurriculumScheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── 하이퍼파라미터 기본값 ────────────────────────────────────────
LR          = 5e-4
GAMMA       = 0.99
EPS_START   = 1.0
EPS_END     = 0.05
BATCH_SIZE  = 32
TARGET_UPDATE = 50     # 에피소드 단위
REPLAY_CAP  = 10_000   # 전환(transition) 수
EMBED_DIM   = 32
HIDDEN_DIM  = 64
CHECKPOINT_FREQ = 100  # 에피소드 단위
INIT_BFS_DIST = 3      # 초기 최대 BFS 거리 (커리큘럼 시작 난이도)


# ── ReplayBuffer ─────────────────────────────────────────────────

class ReplayBuffer:
    """per-에이전트 experience 저장소 (QMIX 배치 학습용)"""

    def __init__(self, capacity: int):
        self._buf = deque(maxlen=capacity)

    def push(
        self,
        obs: Dict[str, np.ndarray],
        actions: Dict[str, int],
        rewards: Dict[str, float],
        next_obs: Dict[str, np.ndarray],
        dones: Dict[str, bool],
        state: np.ndarray,
        next_state: np.ndarray,
        agent_order: List[str],
    ) -> None:
        self._buf.append((obs, actions, rewards, next_obs, dones, state, next_state, agent_order))

    def sample(self, batch_size: int):
        batch = random.sample(self._buf, batch_size)
        return batch

    def __len__(self) -> int:
        return len(self._buf)


# ── 학습 유틸 ───────────────────────────────────────────────────

def epsilon_greedy(
    q_net: AgentQNet,
    obs: np.ndarray,
    n_neighbors: int,
    epsilon: float,
    device: torch.device = torch.device("cpu"),
) -> int:
    if random.random() < epsilon or n_neighbors == 0:
        return random.randint(0, MAX_NEIGHBORS - 1)
    obs_t = torch.tensor(obs, dtype=torch.float32).unsqueeze(0).to(device)
    with torch.no_grad():
        q_vals = q_net(obs_t).squeeze(0)
    n_valid = min(n_neighbors, MAX_NEIGHBORS)
    return int(q_vals[:n_valid].argmax().item())


def train_step(
    q_net: AgentQNet,
    target_q_net: AgentQNet,
    mixer: QMixMixer,
    target_mixer: QMixMixer,
    optimizer: optim.Optimizer,
    batch,
    n_agents: int,
    state_dim: int,
    device: torch.device,
) -> float:
    """배치 1회 gradient 업데이트. TD 손실 반환."""
    obs_batch, act_batch, rew_batch, next_obs_batch, done_batch, state_batch, next_state_batch, agent_orders = zip(*batch)
    B = len(batch)

    # 에이전트 0..n_agents-1 순서 고정
    obs_arr     = np.zeros((B, n_agents, 3 * MAX_NODES + MAX_NEIGHBORS), dtype=np.float32)
    act_arr     = np.zeros((B, n_agents), dtype=np.int64)
    rew_arr     = np.zeros((B, n_agents), dtype=np.float32)
    next_obs_arr = np.zeros_like(obs_arr)
    done_arr    = np.zeros((B, n_agents), dtype=np.float32)
    state_arr   = np.stack(state_batch).astype(np.float32)           # (B, state_dim)
    next_state_arr = np.stack(next_state_batch).astype(np.float32)

    for b, (obs, acts, rews, next_obs, dones, _, _, agents) in enumerate(batch):
        for i, agent in enumerate(agents[:n_agents]):
            if agent in obs:
                obs_arr[b, i] = obs[agent]
            if agent in acts:
                act_arr[b, i] = acts[agent]
            if agent in rews:
                rew_arr[b, i] = rews[agent]
            if agent in next_obs:
                next_obs_arr[b, i] = next_obs[agent]
            if agent in dones:
                done_arr[b, i] = float(dones[agent])

    obs_t     = torch.tensor(obs_arr, dtype=torch.float32, device=device)          # (B, n, obs)
    act_t     = torch.tensor(act_arr, dtype=torch.int64, device=device)            # (B, n)
    rew_t     = torch.tensor(rew_arr, dtype=torch.float32, device=device)          # (B, n)
    next_obs_t = torch.tensor(next_obs_arr, dtype=torch.float32, device=device)
    done_t    = torch.tensor(done_arr, dtype=torch.float32, device=device)         # (B, n)
    state_t   = torch.tensor(state_arr, dtype=torch.float32, device=device)        # (B, state)
    next_state_t = torch.tensor(next_state_arr, dtype=torch.float32, device=device)

    # per-agent Q(s, a) — 선택된 행동의 Q값
    chosen_q = []
    for i in range(n_agents):
        obs_i = obs_t[:, i, :]                  # (B, obs)
        q_all = q_net(obs_i)                     # (B, n_actions)
        chosen = q_all.gather(1, act_t[:, i:i+1])  # (B, 1)
        chosen_q.append(chosen)
    agent_qs = torch.cat(chosen_q, dim=1)        # (B, n_agents)

    q_tot = mixer(agent_qs, state_t)             # (B, 1)

    # target: per-agent max Q'
    with torch.no_grad():
        target_qs = []
        for i in range(n_agents):
            next_obs_i = next_obs_t[:, i, :]
            q_next = target_q_net(next_obs_i).max(dim=1, keepdim=True).values  # (B, 1)
            target_qs.append(q_next)
        target_agent_qs = torch.cat(target_qs, dim=1)                          # (B, n_agents)

        # 에이전트별 평균 reward + done 마스크
        mean_rew = rew_t.mean(dim=1, keepdim=True)   # (B, 1)
        any_done = done_t.max(dim=1, keepdim=True).values  # (B, 1)

        target_q_tot = target_mixer(target_agent_qs, next_state_t)  # (B, 1)
        y = mean_rew + GAMMA * (1.0 - any_done) * target_q_tot      # (B, 1)

    loss = nn.MSELoss()(q_tot, y.detach())
    optimizer.zero_grad()
    loss.backward()
    nn.utils.clip_grad_norm_(list(q_net.parameters()) + list(mixer.parameters()), 10.0)
    optimizer.step()
    return loss.item()


def soft_copy(src: nn.Module, dst: nn.Module) -> None:
    dst.load_state_dict(src.state_dict())


# ── 메인 학습 루프 ───────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="CACTUS QMix MAPF 학습 (Task 025)")
    parser.add_argument("--layout-id",    type=str, required=False, default=None,
                        help="Supabase mcs_layout.id. 미지정 시 소형 합성 그래프 사용(스모크 테스트).")
    parser.add_argument("--n-agents",     type=int, default=4)
    parser.add_argument("--n-episodes",   type=int, default=500)
    parser.add_argument("--seed",         type=int, default=0)
    parser.add_argument("--output",       type=str, default="trained_models/cactus_qmix.pt")
    parser.add_argument("--embed-dim",    type=int, default=EMBED_DIM)
    parser.add_argument("--hidden-dim",   type=int, default=HIDDEN_DIM)
    parser.add_argument("--curriculum-threshold", type=float, default=-500.0,
                        help="커리큘럼 진급 임계값 (raw reward 기준). 기본 -500.")
    parser.add_argument("--curriculum-eta",       type=float, default=0.0,
                        help="커리큘럼 안전 계수 η. 0이면 μ ≥ U 단순 조건.")
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    if torch.backends.mps.is_available():
        device = torch.device("mps")
    elif torch.cuda.is_available():
        device = torch.device("cuda")
    else:
        device = torch.device("cpu")
    logger.info(f"장치: {device} | 에이전트: {args.n_agents} | 에피소드: {args.n_episodes}")

    # ── 그래프 로드 ──────────────────────────────────────────────
    import networkx as nx
    if args.layout_id:
        try:
            from services.graph_loader import load_graph
            graph, unit_labels = load_graph(args.layout_id)
            logger.info(f"레이아웃 로드 완료: 노드 {graph.number_of_nodes()}개, 엣지 {graph.number_of_edges()}개")
        except Exception as e:
            logger.error(f"레이아웃 로드 실패: {e}. 합성 그래프로 대체합니다.")
            graph = _make_synthetic_graph(12)
    else:
        logger.info("layout_id 미지정 → 합성 그래프(12노드 선형) 사용")
        graph = _make_synthetic_graph(12)

    n_nodes = graph.number_of_nodes()
    if n_nodes < 2:
        logger.error("그래프 노드 수 부족")
        sys.exit(1)

    # ── 환경 차원 계산 ──────────────────────────────────────────
    obs_dim = 3 * MAX_NODES + MAX_NEIGHBORS
    state_dim = 2 * MAX_NODES * args.n_agents
    n_actions = MAX_NEIGHBORS

    # ── 신경망 초기화 ───────────────────────────────────────────
    q_net       = AgentQNet(obs_dim, n_actions, args.hidden_dim)
    target_q_net = AgentQNet(obs_dim, n_actions, args.hidden_dim)
    q_net.to(device)
    target_q_net.to(device)
    soft_copy(q_net.net, target_q_net.net)

    mixer        = QMixMixer(args.n_agents, state_dim, args.embed_dim).to(device)
    target_mixer = QMixMixer(args.n_agents, state_dim, args.embed_dim).to(device)
    soft_copy(mixer, target_mixer)

    optimizer = optim.Adam(
        list(q_net.parameters()) + list(mixer.parameters()),
        lr=LR,
    )

    replay = ReplayBuffer(REPLAY_CAP)
    scheduler = ReverseCurriculumScheduler(
        window=100,
        eta=args.curriculum_eta,
        threshold=args.curriculum_threshold,
    )
    bfs_max_dist = INIT_BFS_DIST

    # ── ε 스케줄 ────────────────────────────────────────────────
    def get_epsilon(ep: int) -> float:
        progress = ep / max(args.n_episodes - 1, 1)
        return EPS_END + (EPS_START - EPS_END) * (1.0 - progress)

    ep_rewards: List[float] = []

    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else ".", exist_ok=True)

    # ── 학습 루프 ────────────────────────────────────────────────
    for ep in range(args.n_episodes):
        epsilon = get_epsilon(ep)

        try:
            agent_tasks = sample_agent_tasks(graph, args.n_agents, bfs_max_dist, seed=args.seed + ep)
        except ValueError as e:
            logger.warning(f"ep={ep}: task 샘플링 실패({e}), bfs_max_dist={bfs_max_dist+1}로 재시도")
            bfs_max_dist = min(bfs_max_dist + 1, n_nodes)
            try:
                agent_tasks = sample_agent_tasks(graph, args.n_agents, bfs_max_dist, seed=args.seed + ep)
            except ValueError:
                continue

        env = GraphMAPFEnv(graph, agent_tasks, max_steps=3 * n_nodes)
        obs_dict, _ = env.reset(seed=args.seed + ep)
        state = env.get_state()

        all_agents = list(env.possible_agents)
        ep_total_reward = 0.0
        done_ep = False

        while not done_ep:
            # 행동 선택 (활성 에이전트만)
            actions: Dict[str, int] = {}
            for agent in env.agents:
                ag_obs = obs_dict.get(agent, np.zeros(obs_dim, dtype=np.float32))
                pos = env._positions.get(agent, "")
                n_nbrs = len(list(graph.successors(pos)))
                actions[agent] = epsilon_greedy(q_net, ag_obs, n_nbrs, epsilon, device)

            next_obs_dict, rewards, terminations, truncations, _ = env.step(actions)
            next_state = env.get_state()

            # 종료 판단: 모든 possible_agents가 완료
            done_ep = all(terminations.get(a, True) or truncations.get(a, True)
                          for a in all_agents)

            # 배치에 현재 obs/next_obs를 possible_agents 기준으로 저장
            full_obs = {a: obs_dict.get(a, np.zeros(obs_dim, dtype=np.float32)) for a in all_agents}
            full_next_obs = {a: next_obs_dict.get(a, np.zeros(obs_dim, dtype=np.float32)) for a in all_agents}
            full_acts = {a: actions.get(a, 0) for a in all_agents}
            full_rews = {a: rewards.get(a, 0.0) for a in all_agents}
            full_dones = {a: terminations.get(a, False) or truncations.get(a, False) for a in all_agents}

            replay.push(full_obs, full_acts, full_rews, full_next_obs, full_dones,
                        state, next_state, all_agents)

            ep_total_reward += sum(rewards.values())
            obs_dict = next_obs_dict
            state = next_state

            # 미니배치 업데이트
            if len(replay) >= BATCH_SIZE:
                batch = replay.sample(BATCH_SIZE)
                train_step(q_net, target_q_net, mixer, target_mixer,
                           optimizer, batch, args.n_agents, state_dim, device)

        ep_rewards.append(ep_total_reward)
        scheduler.record(ep_total_reward)

        # 커리큘럼 진급
        if scheduler.should_advance():
            bfs_max_dist += 1
            logger.info(f"ep={ep}: 커리큘럼 진급 → bfs_max_dist={bfs_max_dist}")

        # Target Q-net 업데이트
        if ep % TARGET_UPDATE == 0:
            soft_copy(q_net.net, target_q_net.net)
            soft_copy(mixer, target_mixer)

        # 체크포인트 저장
        if ep % CHECKPOINT_FREQ == 0 or ep == args.n_episodes - 1:
            _save_checkpoint(q_net, mixer, args, obs_dim, n_actions, args.embed_dim, args.output)
            recent_mean = float(np.mean(ep_rewards[-50:])) if ep_rewards else 0.0
            stats = scheduler.stats
            logger.info(
                f"ep={ep:4d} | ε={epsilon:.3f} | bfs_dist={bfs_max_dist} "
                f"| reward_avg(50)={recent_mean:.1f} "
                f"| μ={stats.get('mu', 0):.2f} σ={stats.get('sigma', 0):.2f}"
            )

    # ── 최종 저장 ──────────────────────────────────────────────
    _save_checkpoint(q_net, mixer, args, obs_dim, n_actions, args.embed_dim, args.output)
    last100_mean = float(np.mean(ep_rewards[-100:])) if ep_rewards else 0.0
    logger.info(f"학습 완료. 마지막 100 에피소드 평균 reward: {last100_mean:.2f}")
    logger.info(f"체크포인트 저장: {args.output}")


def _save_checkpoint(
    q_net: AgentQNet,
    mixer: QMixMixer,
    args,
    obs_dim: int,
    n_actions: int,
    embed_dim: int,
    output_path: str,
) -> None:
    torch.save({
        "q_net": q_net.state_dict(),
        "mixer": mixer.state_dict(),
        "meta": {
            "n_agents":  args.n_agents,
            "obs_dim":   obs_dim,
            "n_actions": n_actions,
            "embed_dim": embed_dim,
        },
    }, output_path)


def _make_synthetic_graph(n: int = 12):
    """Supabase 없이 테스트 가능한 선형 체인 합성 그래프"""
    import networkx as nx
    g = nx.DiGraph()
    nodes = [f"node_{i}" for i in range(n)]
    for nd in nodes:
        g.add_node(nd, unit_type="Port")
    for i in range(n - 1):
        g.add_edge(nodes[i], nodes[i + 1], weight=1.0)
        g.add_edge(nodes[i + 1], nodes[i], weight=1.0)
    return g


if __name__ == "__main__":
    main()
