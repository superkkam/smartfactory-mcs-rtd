# CACTUS 학습 방법론 (논문 작성용)

> Task 025 구현 기록 — 2026-05-04  
> 논문 Method 섹션, Algorithm 섹션 작성 시 참고

---

## 1. 알고리즘 개요

본 연구에서 적용한 **CACTUS** (Confidence-based Auto-Curriculum for Team Update Stability, Phan et al., AAMAS 2024)는 QMIX 기반 CTDE(Centralized Training, Decentralized Execution) 다중 에이전트 강화학습 알고리즘을 실제 스마트 팩토리 반송 레이아웃에 적용한 MAPF 솔루션이다.

참고 논문:
- **Phan, T. (2024). Confidence-Based Curriculum Learning for Multi-Agent Path Finding. AAMAS 2024. arXiv:2401.05860.** ← CACTUS 원논문
- Rashid et al., "QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning", ICML 2018
- Portelas et al., "Automatic Curriculum Learning For Deep RL: A Short Survey", IJCAI 2020
- Stern et al., "Multi-Agent Pathfinding: Definitions, Variants, and Benchmarks", SoCS 2019

---

## 2. 환경 설계 (GraphMAPFEnv)

### 2.1 상태 공간

실제 공장 레이아웃을 Supabase DB에서 로드한 NetworkX 방향 가중 그래프 G = (V, E) 위에서 정의.

- **노드 V**: 장비 유닛 (Port, Path, Stocker, Process 등), 최대 100개 (MAX_NODES=100)
- **엣지 E**: 전이 관계 (departure_unit → arrival_unit), 가중치 = 이동 거리/시간

에이전트 관측 벡터 (차원: 3 × MAX_NODES + MAX_NEIGHBORS = 310):

| 구간 | 크기 | 내용 |
|------|------|------|
| [0 : 100] | 100 | 자기 위치 one-hot |
| [100 : 200] | 100 | 목적지 one-hot |
| [200 : 300] | 100 | 타 에이전트 위치 마스크 |
| [300 : 310] | 10 | 현재 위치 이웃 노드 점유 마스크 |

글로벌 상태 (Mixer 입력, 차원: 2 × MAX_NODES × N_agents):
- 모든 에이전트의 [위치 one-hot | 목적지 one-hot] 연결

### 2.2 행동 공간

`Discrete(MAX_NEIGHBORS=10)` — 현재 노드의 이웃 인덱스 선택 (그래프 인접 리스트 순서)

### 2.3 보상 함수

$$
r_i(t) = \begin{cases}
+100 & \text{목적지 도달} \\
-w_{uv} & \text{정상 이동 (엣지 가중치)} \\
-10 & \text{충돌 (vertex / edge swap)} \\
-10 & \text{무효 행동 (인덱스 범위 초과)} \\
-50 & \text{최대 스텝 초과 (truncation)}
\end{cases}
$$

### 2.4 충돌 처리 규칙

1. **Vertex 충돌**: 동일 에피소드 스텝에서 복수 에이전트가 같은 노드 진입 시도 → agent_id 알파벳 우선 1명만 이동, 나머지 제자리 + −10 페널티
2. **Edge Swap 충돌**: A→B, B→A 동시 시도 → 양쪽 모두 제자리 + −10 페널티
3. **무효 행동**: 이웃 수 초과 인덱스 → 제자리 + −10 페널티

---

## 3. QMIX 네트워크 구조

### 3.1 Per-Agent Q-Network (공유 가중치)

```
입력: obs (310,)
→ Linear(310, 32) → ReLU
→ Linear(32, 32) → ReLU
→ Linear(32, 10)  # Q값 (MAX_NEIGHBORS개 행동)
출력: Q_i(o_i, a_i)
```

모든 에이전트가 동일한 가중치를 공유 (parameter sharing).  
hidden_dim=32는 2차 실제 학습 기준값. state_dict에서 자동 추론하여 로딩.

### 3.2 Hypernetwork Mixer

CTDE의 중앙화 학습 부분. 글로벌 상태 s로부터 하이퍼네트워크를 통해 가중치를 생성하여 per-agent Q값을 단조적으로 합산:

$$Q_{tot}(\mathbf{a}, s) = f_\theta(Q_1, Q_2, \ldots, Q_n, s)$$

**단조성 보장 (Monotonicity)**:
$$\frac{\partial Q_{tot}}{\partial Q_i} \geq 0, \quad \forall i$$

구현: 하이퍼네트워크 출력 weight에 `abs()` 적용

```
Layer 1: state → abs(Linear(state_dim, n_agents × embed_dim))
         → ELU(w1 @ agent_qs + b1)
Layer 2: state → abs(Linear(state_dim, embed_dim))
         → w2 @ hidden + b2
출력: Q_tot (B, 1)
```

하이퍼파라미터:
- `embed_dim = 16` (2차 학습 기준, 1차 32에서 축소)
- `state_dim = 2 × 100 × 2 = 400` (2 에이전트 기준)

---

## 4. 학습 알고리즘

### 4.1 Reverse Curriculum Learning

에피소드 초기에 쉬운 작업(BFS 거리 짧음)부터 시작하여 수렴하면 난이도 확장:

**진급 조건** (Portelas et al., 2020):
$$\mu_R - \eta \cdot \sigma_R \geq U$$

- $\mu_R$: 최근 window 에피소드 평균 reward
- $\sigma_R$: 표준편차
- $\eta = 0.0$ (2차 학습 기준; 불확실성 페널티 비활성화)
- $U = -200$ (2차 학습 기준; raw reward 스케일에 맞춰 조정)
- window = 100 에피소드

> **주의**: 1차 학습 실패 원인 중 하나가 $U=0.8$ 설정. raw reward가 −3,000 ~ −5,000 범위인데  
> 정규화 없이 0.8을 임계값으로 쓰면 진급 조건이 영구적으로 충족 불가능.

**난이도 표현**: `bfs_max_dist` — 에이전트 (src, dst) 쌍의 최대 BFS 거리 상한
- 초기: 3 (인접 3홉 이내)
- 진급 시: +1 (점진적 확장)

### 4.2 학습 루프 (QMIX TD)

```
for ep in 1..N:
    tasks = sample_agent_tasks(graph, n_agents, bfs_max_dist)
    env.reset()
    while not done:
        a_i = ε-greedy(Q_net, obs_i)   # 분산 행동 선택
        obs', r, done = env.step(actions)
        replay.push(transition)
        if |replay| ≥ batch:
            batch = replay.sample(32)
            # CTDE: Q_tot via Mixer
            loss = MSE(Q_tot, r + γ * Q_tot_target)
            optimizer.step()
    if ep % 50 == 0:
        target_net ← Q_net   # Hard update
    scheduler.record(ep_reward)
    if scheduler.should_advance():
        bfs_max_dist += 1
```

### 4.3 하이퍼파라미터

| 파라미터 | 1차 학습 | 2차 학습 | 비고 |
|----------|---------|---------|------|
| 학습률 (lr) | 5 × 10⁻⁴ | 5 × 10⁻⁴ | Adam optimizer |
| 할인율 (γ) | 0.99 | 0.99 | |
| ε 초기값 | 1.0 | 1.0 | 선형 감소 |
| ε 최종값 | 0.05 | 0.05 | |
| 배치 크기 | 32 | 32 | |
| Replay Buffer 크기 | 10,000 | 10,000 | |
| Target Q-net 업데이트 | 50 ep | 50 ep | Hard copy |
| embed_dim (Mixer) | 32 | **16** | 축소 → CPU 안정화 |
| hidden_dim (Q-net) | 64 | **32** | 축소 |
| 최대 스텝/에피소드 | 3 × n_nodes | 3 × n_nodes | 264 (88 노드) |
| 에이전트 수 (N) | 4 | **2** | 복잡도 축소 |
| 에피소드 수 | 10,000 | **20,000** | |
| curriculum threshold (U) | 0.8 | **-200** | raw reward 스케일 |
| curriculum eta (η) | 1.0 | **0.0** | σ 페널티 제거 |
| 하드웨어 | CPU | **MPS (Apple Silicon)** | |

---

## 5. 학습 실행 정보

### 5.1 스모크 학습 (2026-05-04)

```
환경: 합성 선형 그래프 (12 노드)
에피소드: 200
결과: reward -880 → +65 (수렴 방향 확인)
체크포인트: trained_models/cactus_qmix.pt (803KB)
소요 시간: 약 10초 (CPU)
```

### 5.2 본 학습 1차 (2026-05-04 완료 — 미수렴)

```
환경: 실 레이아웃 deca33f5-1996-480b-b906-5de3e160c93e
      노드 88개, 엣지 272개 (Supabase mcs_layout 테이블)
에이전트 수: 4
에피소드: 10,000
소요 시간: 약 63분 (15:11 ~ 16:14, Apple Silicon CPU)
하드웨어: Apple Silicon CPU (MPS 미사용)
```

**학습 곡선 요약**:

| 구간 | reward_avg(50) | 비고 |
|------|---------------|------|
| ep=0 | -3,294 | 초기 (ε=1.000) |
| ep=100 | -4,022 | 탐색 초기 |
| ep=1,400 | -3,183 | 소폭 개선 |
| ep=7,700 | -2,931 | 최저점 (최고 성능) |
| ep=9,999 | -3,864 | 최종 (ε=0.050) |
| 마지막 100ep 평균 μ | -4,428 | σ=2,761 |

**결론 (미수렴)**:
- `bfs_max_dist=3` — 10,000 에피소드 내내 Reverse Curriculum 진급 조건 미달성
  - 진급 조건: μ − σ ≥ 0.8 → 실제 μ ≈ -4,000 이하로 충족 불가
- ε 감소 후반부(ep≥9,000)에서 reward 오히려 악화 → exploitation이 탐색보다 나쁨
- **체크포인트는 저장됐으나 정책 품질 낮음** → 추론 시 A* fallback 위주 동작 예상

**원인 분석**:
1. 실 레이아웃 88노드는 12노드 스모크 환경 대비 state/action space 과대
2. CPU 전용 10,000 에피소드로 replay buffer 충분히 채워지지 않음 (배치 학습 편향)
3. state_dim = 2 × 100 × 4 = 800 → Mixer hyper_w1 파라미터 과다, CPU에서 gradient 불안정
4. `bfs_max_dist=3` 고정으로 task가 너무 짧아 정책이 장거리 경로 학습 불가

**체크포인트**: `trained_models/cactus_qmix.pt` (803KB, 2026-05-04 16:14)

### 5.3 본 학습 2차 (2026-05-05 완료 — 부분 수렴)

**개선 사항** (1차 실패 원인 대응):

| 항목 | 1차 | 2차 |
|------|-----|-----|
| 하드웨어 | CPU | MPS (Apple Silicon GPU) |
| 에이전트 수 | 4 | **2** (복잡도 축소) |
| curriculum threshold | 0.8 | **-200** (raw reward 스케일 대응) |
| curriculum eta | 1.0 | **0.0** (σ 페널티 제거) |
| hidden_dim | 64 | **32** |
| embed_dim | 32 | **16** |
| 에피소드 수 | 10,000 | **20,000** |

```
환경: 실 레이아웃 deca33f5-1996-480b-b906-5de3e160c93e
      노드 88개, 엣지 272개 (Supabase mcs_layout 테이블)
에이전트 수: 2
에피소드: 20,000 (ep=0 ~ ep=19999)
소요 시간: 약 8시간 (MPS, 2026-05-05 07:xx ~ 15:44)
하드웨어: Apple Silicon MPS GPU
체크포인트: trained_models/cactus_n2.pt (175KB, 2026-05-05 15:44)
```

**학습 곡선 요약**:

| 구간 | reward_avg(50) | bfs_dist | ε | 비고 |
|------|---------------|---------|---|------|
| ep=15,900 | -562.8 | 3 | 0.245 | |
| ep=16,400 | -457.8 | 3 | 0.221 | |
| ep=17,100 | -436.7 | 3 | 0.188 | |
| ep=17,600 | **-280.4** | 3 | 0.164 | **최고 성능** |
| ep=18,000 | -363.2 | 3 | 0.154 | |
| ep=19,600 | -495.7 | 3 | 0.069 | |
| ep=19,999 | -461.4 | 3 | 0.050 | |
| **마지막 100ep μ** | **-426.69** | 3 | — | 최종 |

**결론 (부분 수렴)**:
- **1차 대비 10× 개선**: μ = -4,428 → -427 (reward 스케일 동일)
- `bfs_max_dist=3` 고착: 20,000 에피소드에서도 커리큘럼 진급 조건 미달성
  - 진급 조건: μ ≥ -200 → 실제 μ ≈ -300 ~ -500 범위에서 수렴 진동
  - ep=17,600 최고점 μ=-280으로 임계값 접근했으나 미달
- ε=0.050 도달 이후 exploitation 모드에서 reward 진동 유지 → 완전 수렴 미완성
- **추론 통합 완료**: `cactusLoaded: true`, `/api/health` 확인, confidence=0.75로 A* fallback 없이 직접 추론 가능

**미수렴 원인 분석**:
1. N=2, bfs_dist=3 (최대 3홉) 조합에서도 reward −100 달성이 어려움
   - 이동 step마다 −(엣지 가중치) 페널티 누적 → 3홉 경로도 reward ≈ −30 이상
   - +100 도착 보상으로도 충분히 μ ≥ -200 달성이 어려운 reward 구조
2. 20k 에피소드로도 exploration 충분치 않음 (최적 행동 수렴에 ε 감소 후 진동)
3. replay buffer에서 sampling 편향: 초기 무작위 행동이 buffer 대부분을 채움

### 5.4 추가 학습 고려 사항

```
단기 (필요 시):
  - --curriculum-threshold -400 으로 더 낮춰 bfs_dist 진급 유도
  - n_agents=1 단일 에이전트 먼저 수렴 확인 후 N=2 확장
  - 보상 함수 정규화: r ← r / max_steps (scale ≈ [-1, +1])

장기 (Task 028 이후):
  - 다중 레이아웃 샘플링 학습 (일반화)
  - QMIX → QPLEX 또는 MAPPO 업그레이드
  - 에이전트 수 N=8, 16 스케일 학습
  - GPU 서버 (CUDA) 50,000+ 에피소드 본 학습
```

현재 비교 실험(Task 027)에서 CACTUS는 **2차 체크포인트(cactus_n2.pt)** 기준으로 측정.  
부분 수렴 상태이므로 A* fallback 비율이 높을 수 있으며,  
수렴 완료 정책 기준 재실험은 Task 028 이후로 미룸.

---

## 6. 추론 (Decentralized Execution)

학습 완료 후 실제 시뮬레이션에서는 Mixer 없이 per-agent Q-net만으로 분산 추론:

1. 에이전트 i의 로컬 관측 `obs_i` 구성 (310차원)
2. `Q_net(obs_i)` → 이웃별 Q값
3. `argmax` → 행동 선택 (greedy, ε=0)
4. 목적지 미도달 또는 최대 스텝 초과 시 → A* fallback

---

## 7. 비교 실험 계획 (Task 027)

비교 대상 알고리즘:
| 알고리즘 | 유형 | 특징 |
|----------|------|------|
| A* | 단일 에이전트 최단 경로 | 베이스라인 |
| PPO (AI) | 단일 에이전트 RL | 혼잡 적응 |
| CBS-TS | 다중 에이전트 탐색 | 최적 MAPF |
| **CACTUS** | **다중 에이전트 RL** | **본 연구 제안** |

평가 지표 (MAPF 표준, Stern et al. 2019):
- **Makespan**: 모든 에이전트 완료까지 총 시간
- **Sum of Costs**: 모든 에이전트 이동 비용 합
- **Throughput**: 단위 시간당 완료 반송 수
- **Collision Rate**: 충돌 발생 비율
- **Path Optimality**: 실제 비용 / 최적 비용

실험 변수:
- AMR 수 N ∈ {8, 16, 32} (논문 기준)
- 부하율 ρ ∈ {0.3, 0.5, 0.7}
- 시뮬레이션 시간: 300s (표준), 600s (정밀)
- 시드: 3개 이상 (통계적 유의성, Wilcoxon 검정)

---

## 8. 향후 개선 방향 (Future Work)

1. **배치 멀티에이전트 rollout**: 현재 carrier별 개별 추론 → 전체 carrier 동시 CTDE rollout으로 전환 시 협력 효과 극대화
2. **다중 레이아웃 학습**: 단일 레이아웃 의존 → 여러 레이아웃 샘플링으로 일반화
3. **에이전트 수 확장**: N=2 → N=4, 8, 16 스케일 학습
4. ~~**MPS(Apple Silicon GPU) 활용**: 현재 CPU 학습 → MPS 백엔드로 5~10× 가속 가능~~ ✅ **완료** (2차 학습 적용)
5. **Communication 확장**: QMIX → QPLEX 또는 MAPPO로 업그레이드
6. **보상 정규화**: raw reward 스케일 문제 → r ← r/max_steps 정규화로 커리큘럼 임계값 통일
7. **본 학습 (GPU 서버)**: 50,000+ 에피소드, CUDA 환경, N=4 이상 에이전트
