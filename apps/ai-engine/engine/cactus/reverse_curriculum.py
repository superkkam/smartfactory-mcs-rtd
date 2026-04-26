"""
Reverse Curriculum Learning for CACTUS (Task 025 구현 예정)

R_alloc 윈도우 통계 기반 난이도 자동 확장:
  - 조건: μ − η·σ ≥ U  (μ=평균, σ=표준편차, η=안전 계수, U=임계값)
  - 조건 충족 시 난이도 상승 (에이전트 수 또는 장애물 수 증가)

참고: Portelas et al., "Automatic Curriculum Learning For Deep RL:
      A Short Survey", IJCAI 2020
"""
from __future__ import annotations
from collections import deque
import statistics


class ReverseCurriculumScheduler:
    """
    R_alloc 통계 기반 커리큘럼 스케줄러.

    사용 예:
        scheduler = ReverseCurriculumScheduler(window=100, eta=1.0, threshold=0.8)
        scheduler.record(reward)
        if scheduler.should_advance():
            env.increase_difficulty()
    """

    def __init__(
        self,
        window: int = 100,
        eta: float = 1.0,
        threshold: float = 0.8,
    ):
        """
        Args:
            window:    통계 계산 윈도우 크기 (에피소드 수)
            eta:       안전 계수 (μ − eta·σ ≥ U)
            threshold: 진급 임계값 U
        """
        self.window = window
        self.eta = eta
        self.threshold = threshold
        self._history: deque[float] = deque(maxlen=window)

    def record(self, r_alloc: float) -> None:
        """에피소드 보상 기록"""
        self._history.append(r_alloc)

    def should_advance(self) -> bool:
        """
        μ − η·σ ≥ U 조건 검사.
        윈도우가 채워지지 않았으면 False 반환.
        """
        if len(self._history) < self.window:
            return False
        mu = statistics.mean(self._history)
        sigma = statistics.stdev(self._history) if len(self._history) > 1 else 0.0
        return (mu - self.eta * sigma) >= self.threshold

    @property
    def stats(self) -> dict[str, float]:
        """현재 통계 반환"""
        if len(self._history) < 2:
            return {"mu": 0.0, "sigma": 0.0, "n": len(self._history)}
        return {
            "mu":    statistics.mean(self._history),
            "sigma": statistics.stdev(self._history),
            "n":     float(len(self._history)),
        }
