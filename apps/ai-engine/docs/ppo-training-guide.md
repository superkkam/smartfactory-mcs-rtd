# PPO 모델 학습 가이드

## 개요

AI(PPO) 전략은 Stable-Baselines3 PPO 모델을 사용한다.
학습 모델이 없으면 자동으로 A* 폴백으로 동작한다 (`confidence=0.0`).

---

## 학습 결과 요약 (2026-04-28)

| 모델 | 파일 | 환경 | 스텝 | Port→Port 성공률 |
|------|------|------|------|-----------------|
| Smoke | `ppo_smoke.zip` | 합성 4×4 그리드 | 30k | **100%** |
| 실제 레이아웃 | `ppo_route.zip` | 레이아웃 deca33f5 (88노드) | 500k | 45% PPO + 55% A* 폴백 = **100%** |

`ppo_agent.predict()` 동작:
- PPO 경로 도달 성공 → confidence=0.85 반환
- PPO 미도달 → A* 폴백 (confidence=0.0)
- 결과적으로 100% 전송 완료 보장

---

## 학습 방식

### 1. Smoke 학습 (빠른 검증, Supabase 불필요)

```bash
cd apps/ai-engine
.venv/bin/python scripts/train_ppo_smoke.py --steps 30000
# → trained_models/ppo_smoke.zip
```

**환경**: 합성 4×4 그리드 (16노드), BFS 거리 보상 쉐이핑 포함

---

### 2. 실제 레이아웃 학습 (SCI 저널용)

```bash
cd apps/ai-engine
.venv/bin/python scripts/train.py \
  --layout-id deca33f5-1996-480b-b906-5de3e160c93e \
  --total-steps 500000 \
  --output trained_models/ppo_route
```

**환경 설계**:
- `_random_reset = True`: 에피소드마다 새 src/dst 샘플 (일반화 학습)
- `_reward_shaping = True`: BFS 거리 기반 쉐이핑 × 2.0 (sparse reward 해결)
- `_train_nodes = port_nodes`: Port 노드 20개만 src/dst 사용 (380쌍 집중 학습)
- 재방문 패널티: -5 (쉐이핑 활성 시, 원래 -50에서 완화)

**관측 공간**: `4 × MAX_NODES = 400` 차원 (현재+목적지+혼잡도+방문이력)

---

## 하이퍼파라미터

| 파라미터 | Smoke | 실제 레이아웃 |
|----------|-------|--------------|
| `total_steps` | 30,000 | 500,000+ |
| `learning_rate` | 3e-4 | 3e-4 |
| `n_steps` | 512 | 2048 |
| `batch_size` | 64 | 64 |
| `n_epochs` | 10 | 10 |
| `gamma` | 0.99 | 0.99 |
| `ent_coef` | 0.01 | 0.01 |

---

## 모델 로딩 및 추론

`ppo_agent.py`는 compact(2×n) 및 full(4×MAX) 관측 형식을 자동 감지한다.

```python
from engine.ppo_agent import ppo_agent
ppo_agent.load("trained_models/ppo_route.zip")
# 관측 차원 자동 감지: model.observation_space.shape[0]

path, cost, confidence = ppo_agent.predict(graph, source_id, dest_id, unit_labels)
# confidence = 0.85 → PPO 성공
# confidence = 0.0  → A* 폴백
```

---

## 향후 개선 방향

| 항목 | 현재 | 목표 |
|------|------|------|
| Port→Port PPO 성공률 | 45% | 90%+ |
| 평균 경로 효율 | ~360 홉 (서브옵티멀) | A* 대비 1.2배 이내 |
| 필요 학습 스텝 (추정) | 500k | 5M+ |

**개선 방법**:
- `--total-steps 5000000` 으로 장기 학습 (약 12분)
- HER (Hindsight Experience Replay) 적용 → 목표 조건부 RL
- 커리큘럼 학습: 가까운 쌍 → 먼 쌍 순서로 학습

---

## 파일 구조

```
apps/ai-engine/
├── engine/
│   ├── ppo_agent.py         # PPO 싱글턴 (compact/full 관측 자동 감지)
│   └── route_env.py         # McsRouteEnv (_random_reset, _reward_shaping, _train_nodes)
├── scripts/
│   ├── train.py             # 실제 레이아웃 학습 (Supabase 필요)
│   └── train_ppo_smoke.py   # Smoke 학습 (합성 그리드)
└── trained_models/
    ├── ppo_smoke.zip         # Smoke 모델 (4×4 그리드, 100% 성공)
    ├── ppo_route.zip         # 실제 레이아웃 모델 (45% PPO + 55% A* 폴백)
    └── best_model.zip        # EvalCallback 최적 체크포인트
```
