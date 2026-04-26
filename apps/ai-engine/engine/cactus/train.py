"""
CACTUS 학습 진입점 (Task 025 구현 예정)

실행 예:
    python -m engine.cactus.train --n-agents 8 --n-episodes 10000
"""
import argparse


def main() -> None:
    parser = argparse.ArgumentParser(description="CACTUS MAPF 학습 (Task 025)")
    parser.add_argument("--n-agents",   type=int, default=8)
    parser.add_argument("--n-episodes", type=int, default=10000)
    parser.add_argument("--layout-id",  type=str, default="MAPF-LAYOUT-001")
    parser.add_argument("--seed",       type=int, default=42)
    _ = parser.parse_args()

    raise NotImplementedError(
        "CACTUS 학습은 Task 025에서 구현 예정입니다.\n"
        "구현 예정 항목:\n"
        "  1. MAPFEnv (PettingZoo ParallelEnv)\n"
        "  2. QMixMixer (CTDE Monotonic Value Factorization)\n"
        "  3. ReverseCurriculumScheduler (μ−η·σ ≥ U 난이도 자동 확장)\n"
        "  4. PPO 다중 에이전트 학습 루프\n"
        "  5. 체크포인트 저장 및 TensorBoard 로깅"
    )


if __name__ == "__main__":
    main()
