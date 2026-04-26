"""
QMIX Monotonic Mixer (Task 025 구현 예정)

CTDE(Centralized Training Decentralized Execution):
  - 중앙화 학습: 전체 에이전트 Q값을 단조 합산 → 글로벌 Q 계산
  - 분산 실행: 각 에이전트는 로컬 관측만으로 행동 선택

참고: Rashid et al., "QMIX: Monotonic Value Function Factorisation for
      Deep Multi-Agent Reinforcement Learning", ICML 2018
"""
from __future__ import annotations
from typing import Optional
import torch
import torch.nn as nn


class QMixMixer(nn.Module):
    """
    QMIX Mixer 스텁.
    Task 025에서 전체 구현 예정.

    입력: (n_agents, q_values), (state,)
    출력: scalar Q_tot
    """

    def __init__(
        self,
        n_agents: int,
        state_dim: int,
        embed_dim: int = 32,
    ):
        super().__init__()
        self.n_agents = n_agents
        self.state_dim = state_dim
        self.embed_dim = embed_dim
        # Task 025에서 hypernetwork layers 추가 예정
        raise NotImplementedError(
            "QMixMixer는 Task 025에서 구현 예정. "
            "w1, b1, w2, b2 hypernetwork가 state → weights를 생성."
        )

    def forward(
        self,
        agent_qs: torch.Tensor,
        states: torch.Tensor,
    ) -> torch.Tensor:
        """
        Args:
            agent_qs: (batch, n_agents) — 각 에이전트의 Q값
            states:   (batch, state_dim) — 글로벌 상태
        Returns:
            q_tot: (batch, 1) — 단조 합산 글로벌 Q
        """
        raise NotImplementedError
