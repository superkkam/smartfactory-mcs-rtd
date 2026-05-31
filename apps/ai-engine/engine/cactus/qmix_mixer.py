"""
QMIX Monotonic Mixer (Task 025)

CTDE(Centralized Training, Decentralized Execution):
  - 중앙화 학습: 전체 에이전트 Q값 + 글로벌 state → 하이퍼네트워크 가중치로 Q_tot 합산
  - 단조성 보장: 하이퍼네트워크 출력 weight에 abs() 적용
  - 분산 실행: 각 에이전트는 로컬 관측만으로 행동 선택 (mixer 불필요)

참고: Rashid et al., "QMIX: Monotonic Value Function Factorisation for
      Deep Multi-Agent Reinforcement Learning", ICML 2018
"""
from __future__ import annotations
import torch
import torch.nn as nn
import torch.nn.functional as F


class QMixMixer(nn.Module):
    """
    QMIX Hypernetwork Mixer.

    학습 시에만 사용 (CTDE centralized 부분).
    추론 시에는 per-agent Q-net만 사용.

    Args:
        n_agents:  에이전트 수
        state_dim: 글로벌 state 차원 (GraphMAPFEnv.state_dim())
        embed_dim: 하이퍼네트워크 hidden dim (기본 32)
    """

    def __init__(self, n_agents: int, state_dim: int, embed_dim: int = 32):
        super().__init__()
        self.n_agents = n_agents
        self.state_dim = state_dim
        self.embed_dim = embed_dim

        # layer 1 하이퍼네트워크: state → (n_agents × embed_dim) weights + embed_dim bias
        self.hyper_w1 = nn.Linear(state_dim, n_agents * embed_dim)
        self.hyper_b1 = nn.Linear(state_dim, embed_dim)

        # layer 2 하이퍼네트워크: state → embed_dim weights + scalar bias
        self.hyper_w2 = nn.Linear(state_dim, embed_dim)
        self.hyper_b2 = nn.Sequential(
            nn.Linear(state_dim, embed_dim),
            nn.ReLU(),
            nn.Linear(embed_dim, 1),
        )

    def forward(
        self,
        agent_qs: torch.Tensor,
        states: torch.Tensor,
    ) -> torch.Tensor:
        """
        Args:
            agent_qs: (B, n_agents) — 각 에이전트의 선택 Q값
            states:   (B, state_dim) — 글로벌 상태

        Returns:
            q_tot: (B, 1) — 단조 합산 글로벌 Q
        """
        B = agent_qs.size(0)

        # Layer 1: abs() → 단조성 보장
        w1 = torch.abs(self.hyper_w1(states))               # (B, n_agents*embed)
        w1 = w1.view(B, self.n_agents, self.embed_dim)       # (B, n_agents, embed)
        b1 = self.hyper_b1(states).view(B, 1, self.embed_dim)  # (B, 1, embed)

        # (B, 1, n_agents) × (B, n_agents, embed) = (B, 1, embed)
        hidden = F.elu(torch.bmm(agent_qs.unsqueeze(1), w1) + b1)

        # Layer 2: abs() → 단조성 보장
        w2 = torch.abs(self.hyper_w2(states)).view(B, self.embed_dim, 1)  # (B, embed, 1)
        b2 = self.hyper_b2(states).view(B, 1, 1)                           # (B, 1, 1)

        # (B, 1, embed) × (B, embed, 1) = (B, 1, 1)
        q_tot = torch.bmm(hidden, w2) + b2
        return q_tot.view(B, 1)
