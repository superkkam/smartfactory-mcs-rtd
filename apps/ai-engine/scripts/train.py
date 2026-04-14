"""
PPO 경로 탐색 모델 오프라인 학습 스크립트
서버와 분리된 1회성 학습 실행

사용법:
    cd apps/ai-engine
    python scripts/train.py --layout-id <uuid> --total-steps 200000

학습 완료 후 trained_models/ppo_route.zip 생성 → 서버 재시작 시 자동 로딩
"""
import sys
import os
import argparse
import logging

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def train(layout_id: str, total_steps: int, output_path: str) -> None:
    """PPO 모델 학습"""
    from stable_baselines3 import PPO
    from stable_baselines3.common.env_util import make_vec_env
    from stable_baselines3.common.callbacks import EvalCallback, CheckpointCallback

    from services.graph_loader import load_graph
    from engine.route_env import McsRouteEnv, MAX_NODES

    logger.info(f"레이아웃 그래프 로드 중: {layout_id}")
    graph, unit_labels = load_graph(layout_id)
    logger.info(f"그래프 로드 완료: {len(graph.nodes())}개 노드, {len(graph.edges())}개 엣지")

    node_list = list(graph.nodes())
    if len(node_list) < 2:
        raise ValueError("학습에 필요한 노드가 부족합니다 (최소 2개).")

    import random

    def make_env():
        """랜덤 출발/목적지 환경 생성"""
        src, dst = random.sample(node_list, 2)
        return McsRouteEnv(graph, src, dst)

    # 벡터화 환경 (병렬 학습)
    n_envs = min(4, os.cpu_count() or 1)
    env = make_vec_env(make_env, n_envs=n_envs)
    eval_env = make_vec_env(make_env, n_envs=1)

    # PPO 하이퍼파라미터
    model = PPO(
        policy="MlpPolicy",
        env=env,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,        # 탐색 장려
        verbose=1,
    )

    # 콜백 설정
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    checkpoint_cb = CheckpointCallback(
        save_freq=max(total_steps // 10, 1000),
        save_path=os.path.dirname(output_path),
        name_prefix="ppo_route_checkpoint",
    )
    eval_cb = EvalCallback(
        eval_env,
        best_model_save_path=os.path.dirname(output_path),
        log_path=os.path.dirname(output_path),
        eval_freq=max(total_steps // 20, 500),
        deterministic=True,
        render=False,
    )

    logger.info(f"PPO 학습 시작: {total_steps}스텝, {n_envs}개 병렬 환경")
    model.learn(
        total_timesteps=total_steps,
        callback=[checkpoint_cb, eval_cb],
        progress_bar=True,
    )

    # 최종 모델 저장
    model.save(output_path)
    logger.info(f"모델 저장 완료: {output_path}.zip")


def main():
    parser = argparse.ArgumentParser(description="PPO 경로 탐색 모델 학습")
    parser.add_argument("--layout-id", required=True, help="Supabase mcs_layout.id")
    parser.add_argument("--total-steps", type=int, default=200_000, help="학습 총 스텝 수")
    parser.add_argument(
        "--output",
        default="trained_models/ppo_route",
        help="모델 저장 경로 (.zip 확장자 자동 추가)",
    )
    args = parser.parse_args()

    train(
        layout_id=args.layout_id,
        total_steps=args.total_steps,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
