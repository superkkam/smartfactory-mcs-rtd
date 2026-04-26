"""
CACTUS 다중 에이전트 환경 (Task 025 구현 예정)

PettingZoo ParallelEnv 인터페이스 기반:
  - 관측: 로컬 그리드 뷰 + 글로벌 충돌 마스크
  - 행동: Discrete(5) — 정지, 상, 하, 좌, 우
  - 보상: R_alloc (작업 할당 기반) + R_coop (협력 보너스)
  - 역방향 커리큘럼: μ − η·σ ≥ U 기준으로 난이도 자동 확장

의존성: pettingzoo>=1.24, supersuit>=3.9
"""
from __future__ import annotations
from typing import Any, Optional
import numpy as np


class MAPFEnv:
    """
    다중 에이전트 MAPF 환경 스텁.
    Task 025에서 PettingZoo ParallelEnv 로 완성 예정.
    """

    metadata = {"name": "mapf_cactus_v0"}

    def __init__(
        self,
        graph: Any,
        n_agents: int = 8,
        max_steps: int = 200,
        obs_radius: int = 3,
    ):
        self.graph = graph
        self.n_agents = n_agents
        self.max_steps = max_steps
        self.obs_radius = obs_radius
        self.agents: list[str] = [f"amr_{i}" for i in range(n_agents)]
        raise NotImplementedError(
            "MAPFEnv는 Task 025에서 PettingZoo ParallelEnv 기반으로 구현 예정."
        )

    def reset(self, seed: Optional[int] = None) -> dict[str, np.ndarray]:
        raise NotImplementedError

    def step(self, actions: dict[str, int]) -> tuple[
        dict[str, np.ndarray],
        dict[str, float],
        dict[str, bool],
        dict[str, bool],
        dict[str, Any],
    ]:
        raise NotImplementedError

    def observation_space(self, agent: str) -> Any:
        raise NotImplementedError

    def action_space(self, agent: str) -> Any:
        raise NotImplementedError
