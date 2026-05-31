# 구현 알고리즘 전체 방법론 (논문 작성용)

> 기록일: 2026-05-04  
> 논문 Related Work / Method / Experiment 섹션 참고용  
> 구현 위치: `apps/ai-engine/`

---

## 0. 전체 구조 개요

```
apps/ai-engine/
├── engine/
│   ├── astar.py              # 알고리즘 1: A* (베이스라인)
│   ├── route_env.py          # 알고리즘 2: PPO 환경 (Gymnasium)
│   ├── ppo_agent.py          # 알고리즘 2: PPO 추론 싱글턴
│   ├── cbs_ts/               # 알고리즘 3: CBS-TS
│   │   ├── mla_star.py       #   MLA* (이종 AMR 지원)
│   │   ├── cbs_high_level.py #   CBS 고수준 탐색 (CT)
│   │   ├── milp_task_order.py#   MILP 작업 배분 (pulp)
│   │   └── search_forest.py  #   (보조)
│   └── cactus/               # 알고리즘 4: CACTUS (Phan et al., AAMAS 2024)
│       ├── multi_agent_env.py#   GraphMAPFEnv (PettingZoo)
│       ├── qmix_mixer.py     #   QMIX Hypernetwork Mixer
│       ├── qmix_agent.py     #   QmixAgent 싱글턴
│       ├── train.py          #   QMIX 학습 루프
│       └── reverse_curriculum.py # Reverse Curriculum Scheduler
├── scripts/
│   ├── train.py              # PPO 오프라인 학습
│   └── train_cactus.py       # CACTUS 오프라인 학습 (래퍼)
└── engine/strategy.py        # 공통 Strategy Registry (패턴)
```

공통 **Strategy Registry** (`engine/strategy.py`):
- `STRATEGY_REGISTRY: dict[str, RouteStrategy]` 에 4개 전략 등록
- `/api/inference?algorithm={astar|ai_ppo|cbs_ts|cactus}` → 동적 디스패치
- 모든 전략은 `predict(graph, source_id, dest_id, unit_labels, dynamic_weights) → (path, cost, confidence)` 인터페이스 구현

---

## 1. 알고리즘 1: A* (정적 최단 경로 베이스라인)

### 1.1 개요

**역할**: 단일 AMR 최단 경로 탐색. 모든 RL 알고리즘의 fallback 및 비교 베이스라인.

**구현 파일**: `engine/astar.py`

**참고 논문**:
- Hart et al., "A Formal Basis for the Heuristic Determination of Minimum Cost Paths", IEEE Trans. Systems Science and Cybernetics, 1968.

### 1.2 알고리즘 설계

h=0 (heuristic = 0) → 실질적으로 Dijkstra 동등 (admissible 보장):

$$f(n) = g(n) + h(n) = g(n) + 0 = g(n)$$

**이유**: 공장 레이아웃 그래프는 그리드가 아닌 임의 방향 가중 그래프 — 유클리드/맨해튼 휴리스틱 적용 불가.

**구현 핵심**:
```
open_heap: MinHeap (f_cost, node_id)
closed_set: 방문 완료 노드
g_score[n]: 시작점에서 n까지 최소 누적 비용
came_from[n]: 경로 역추적용 부모 노드 맵
```

엣지 비용 = `graph[u][v]["weight"]` (기본 1.0)

### 1.3 두 가지 모드

| 모드 | 함수 | 비용 계산 |
|------|------|-----------|
| 정적 최단 | `run_astar(graph, start, goal)` | `edge_weight` |
| 혼잡 회피 | `run_astar_congestion(graph, start, goal, dynamic_weights)` | `edge_weight × (1 + congestion_factor)` |

혼잡 반영 A*는 PPO fallback 대체용으로, 혼잡도 맵 `{node_uuid: congestion_factor ∈ [0,1]}`을 입력받아 우회 경로 산출.

### 1.4 복잡도

- 시간: O((V + E) log V) — Fibonacci Heap 기준 O(V log V + E)
- 공간: O(V)

### 1.5 한계

- 단일 AMR만 처리 (다중 AMR 간 충돌 미고려)
- 정적 경로 — 실시간 혼잡도 변화 미반영 (`run_astar_congestion` 은 호출 시점 스냅샷)
- MAPF 최적성 보장 없음

---

## 2. 알고리즘 2: PPO (단일 에이전트 강화학습)

### 2.1 개요

**역할**: 혼잡도 동적 반영 단일 AMR 경로 탐색. SB3 PPO + 커스텀 Gymnasium 환경.

**구현 파일**: `engine/route_env.py`, `engine/ppo_agent.py`, `scripts/train.py`

**참고 논문**:
- Schulman et al., "Proximal Policy Optimization Algorithms", arXiv:1707.06347, 2017.
- Raffin et al., "Stable-Baselines3: Reliable Reinforcement Learning Implementations", JMLR, 2021.

### 2.2 환경 설계 (McsRouteEnv)

**그래프**: Supabase mcs_layout 테이블에서 로드한 NetworkX DiGraph G = (V, E)  
**노드 V**: 장비 유닛 (Port, Path, Stocker, Process 등)  
**엣지 E**: 전이 관계 (단방향), 가중치 = 이동 거리/시간

**관측 공간** (4 × MAX_NODES = 400차원, float32):

| 구간 | 크기 | 내용 |
|------|------|------|
| [0 : 100] | 100 | 현재 노드 one-hot |
| [100 : 200] | 100 | 목적 노드 one-hot |
| [200 : 300] | 100 | 동적 가중치(혼잡도) 벡터 |
| [300 : 400] | 100 | 방문 이력 마스크 |

(MAX_NODES = 100 고정 — 실제 노드 수 이후는 zero-padding)

**행동 공간**: `Discrete(MAX_NEIGHBORS=10)` — 현재 노드 이웃 인덱스

**보상 함수**:

$$r(t) = \begin{cases}
+100 & \text{목적지 도달} \\
-e_{uv} \cdot (1 + c_v) & \text{정상 이동 (엣지 가중치 × 혼잡도)} \\
-50 & \text{재방문 (visited 집합)} \\
-10 & \text{무효 행동 (이웃 범위 초과)} \\
-100 & \text{최대 스텝 초과 (truncation)} \\
\end{cases}$$

단, `_reward_shaping=True` 활성 시 재방문 패널티 -5로 완화 + BFS 거리 기반 bonus:
$$r_{shaping}(t) = 2 \cdot (d_{BFS}(cur, dst) - d_{BFS}(next, dst))$$

### 2.3 PPO 하이퍼파라미터

| 파라미터 | 값 | 비고 |
|----------|-----|------|
| 정책 | MlpPolicy | 2층 MLP |
| 학습률 | 3 × 10⁻⁴ | Adam |
| n_steps | 2,048 | 롤아웃 버퍼 |
| batch_size | 64 | minibatch |
| n_epochs | 10 | 업데이트 반복 |
| γ (감가율) | 0.99 | |
| GAE λ | 0.95 | |
| clip_range | 0.2 | PPO-Clip |
| ent_coef | 0.01 | 탐색 장려 |
| 총 학습 스텝 | 200,000 (기본) | |
| n_envs | min(4, cpu_count) | 병렬 벡터 환경 |

### 2.4 학습 설정

- **src/dst 풀**: Port 노드 전용 (공장에서 실제 반송 출발/도착점)
- **에피소드마다** `_random_reset=True` → 새 (src, dst) 샘플링 (일반화)
- **BFS 보상 쉐이핑** (`_reward_shaping=True`): 학습 초기 수렴 가속
- **평가 콜백** (EvalCallback): 학습 중 최우수 모델 자동 저장

### 2.5 추론 (PpoAgent 싱글턴)

```
1. obs = McsRouteEnv._get_obs() (400차원)
2. model.predict(obs, deterministic=True) → action
3. action → 이웃 노드 이동
4. 반복 (최대 2×n_nodes 스텝)
5. 실패(무효/초과) → run_astar_congestion() fallback
```

compact 모델(2×n_nodes 차원) / full 모델(400차원) 자동 감지.

### 2.6 한계

- 단일 에이전트 — 다중 AMR 간 협력 미고려
- 정책은 학습 레이아웃에 특화 (OOD 일반화 제한)
- 학습 시간: 약 200k 스텝 (≈ 수십 분, 4코어 병렬)

---

## 3. 알고리즘 3: CBS-TS (Conflict-Based Search + Task Scheduling)

### 3.1 개요

**역할**: 다중 AMR 충돌 없는 경로 탐색 + MILP 기반 작업 배분. 최적성 지향 MAPF 솔버.

**구현 파일**: `engine/cbs_ts/`

**참고 논문**:
- Sharon et al., "Conflict-Based Search for Optimal Multi-Agent Pathfinding", AIJ, 2015.
- Stern et al., "Multi-Agent Pathfinding: Definitions, Variants, and Benchmarks", SoCS, 2019.
- **CBS-TS (2024). Collaborative Task Assignment, Sequencing and Multi-agent Path-finding for Heterogeneous Robots. arXiv:2510.21738.** ← CBS-TS 원논문

### 3.2 MLA* (Multi-Label A* — 이종 AMR 지원)

**파일**: `engine/cbs_ts/mla_star.py`

표준 A* 확장으로 이종 AMR 유형 호환성 + CBS 충돌 제약 + 시간 축 탐색:

**AMR 유형**:

| 유형 | 설명 |
|------|------|
| TYPE_A | 표준 — 모든 경로 통과 가능 |
| TYPE_B | 고하중 AMR — 엣지 가중치 > HIGH_LOAD_THRESHOLD (5.0) 통과 불가 |
| TYPE_C | 멀티-goal AMR — goal_sequence로 다단계 목적지 지원 |

**CBS 제약 반영**:
- **Vertex constraint** `(node_id, t)`: 시각 t에 node_id 진입 금지 (비용 ∞)
- **Edge constraint** `(from, to, t)`: 시각 t에 해당 엣지 통과 금지

**대기(wait)**: CBS 충돌 해소 시 제자리 대기 행동 비용 `WAIT_COST = 1.0`

### 3.3 CBS High-Level (Constraint Tree 탐색)

**파일**: `engine/cbs_ts/cbs_high_level.py`

Conflict-Based Search 표준 구조:

```
CT 루트: 제약 없이 각 AMR 독립 MLA* → 초기 솔루션
Best-first 확장 (총 비용 = sum of costs 기준)
loop:
    솔루션에서 첫 번째 충돌 탐지
    충돌 없으면 → 완료 (최적 솔루션 반환)
    충돌 (A, B) 발견:
        자식 CT 노드 1: A에 제약 추가 → 재계획
        자식 CT 노드 2: B에 제약 추가 → 재계획
        두 자식 MinHeap에 삽입
```

**탐지 충돌 종류**:
- **Vertex conflict**: 시각 t에 두 AMR이 같은 노드 점유
- **Edge conflict**: 시각 t에 두 AMR이 같은 엣지를 반대 방향 통과

**완전성/최적성**: 충돌 해소 가능한 경우 최적 sum-of-costs 솔루션 보장.

### 3.4 MILP 작업 배분 (Task Scheduling)

**파일**: `engine/cbs_ts/milp_task_order.py`

**목적**: 작업 순서 + AMR 배분 최적화 (makespan 최소화)

```
결정 변수:
  x[i][k] ∈ {0,1}  — 작업 i를 AMR k에 배분
  s[i]    ≥ 0      — 작업 i의 시작 시간

목적함수: minimize makespan (최대 완료 시간)
제약:
  - 각 작업 정확히 1 AMR에 배분
  - AMR 유형 호환성 (amrType ∈ allowed_types)
  - 마감 시간 (deadline)
  - 동일 AMR 직렬화 (Big-M 기법)
```

솔버: pulp >= 2.8 (CBC 내장 MILP 솔버)  
최대 풀이 시간: `SOLVER_TIME_LIMIT = 30초`

### 3.5 복잡도 및 한계

- 최악: CBS → CT 노드 수 지수증가 (NP-hard 일반 MAPF)
- AMR 수 증가 → 풀이 시간 급증 (실용 범위: AMR ≤ 20)
- pulp 미설치 시 `is_available=False` → A* fallback
- 작업 수 증가 → MILP 풀이 시간 증가 (Big-M 기법의 수치적 불안정 가능)

---

## 4. 알고리즘 4: CACTUS (Phan et al., AAMAS 2024 — QMIX 기반 MAPF)

> 상세 내용은 `docs/cactus-methodology.md` 참조.  
> 본 절은 비교 실험 및 논문 통합 서술을 위한 요약.

### 4.1 개요

**CACTUS** = Confidence-based Auto-Curriculum for Team Update Stability

**역할**: QMIX(CTDE) 기반 다중 AMR 협력 경로 탐색. 실제 공장 레이아웃 위에서 MARL 정책 학습.

**구현 파일**: `engine/cactus/`

**참고 논문**:
- **Phan, T. (2024). Confidence-Based Curriculum Learning for Multi-Agent Path Finding. AAMAS 2024. arXiv:2401.05860.** ← CACTUS 원논문
- Rashid et al., "QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning", ICML, 2018.
- Portelas et al., "Automatic Curriculum Learning For Deep RL: A Short Survey", IJCAI, 2020.

### 4.2 GraphMAPFEnv (PettingZoo ParallelEnv)

실제 공장 레이아웃 NetworkX DiGraph 위의 Multi-Agent 환경:

**관측 벡터** (310차원, 에이전트별):

| 구간 | 크기 | 내용 |
|------|------|------|
| [0 : 100] | 100 | 자기 위치 one-hot |
| [100 : 200] | 100 | 목적지 one-hot |
| [200 : 300] | 100 | 타 에이전트 위치 마스크 |
| [300 : 310] | 10 | 현재 위치 이웃 노드 점유 마스크 |

**보상** (세부 내용은 `cactus-methodology.md` §2.3):

$$r_i(t) = \begin{cases}
+100 & \text{목적지 도달} \\
-w_{uv} & \text{정상 이동} \\
-10 & \text{충돌 / 무효 행동} \\
-50 & \text{최대 스텝 초과}
\end{cases}$$

**충돌 처리**: vertex(ID 우선 1명 이동), edge swap(양쪽 정지)

### 4.3 QMIX 네트워크

**Per-Agent Q-Net** (가중치 공유):
```
obs(310) → Linear(64) → ReLU → Linear(64) → ReLU → Linear(10)
```

**Hypernetwork Mixer** (단조성 보장):
$$Q_{tot}(\mathbf{a}, s) = f_\theta(Q_1, \ldots, Q_n, s), \quad \frac{\partial Q_{tot}}{\partial Q_i} \geq 0$$

abs() 적용으로 Mixer weight 비음수 보장.

### 4.4 Reverse Curriculum Learning

$$\mu_R - \eta \cdot \sigma_R \geq U \quad (\eta=1.0,\ U=0.8,\ \text{window}=100)$$

난이도 = `bfs_max_dist` (초기 3, 진급 시 +1)

### 4.5 학습 현황

| 구분 | 상세 |
|------|------|
| 스모크 학습 (2026-05-04) | 합성 12노드 그래프, 200 에피소드, reward -880→+65, 체크포인트 803KB |
| 본 학습 (2026-05-04 진행 중) | 실 레이아웃 88노드 272엣지, 10,000 에피소드, ep=100 reward=-4022 (정상 탐색) |

---

## 5. 알고리즘 비교표

| 항목 | A* | PPO | CBS-TS | **CACTUS** |
|------|-----|-----|--------|------------|
| 유형 | 탐색 (최단 경로) | 단일 에이전트 RL | 다중 에이전트 탐색 | 다중 에이전트 RL |
| 에이전트 수 | 1 | 1 | N (≤ 20 실용적) | N (본 학습 N=4) |
| 충돌 처리 | 없음 | 없음 | CBS (최적) | QMIX 협력 학습 |
| 최적성 | 단일 에이전트 최적 | 근사 | sum-of-costs 최적 | 근사 (정책 기반) |
| 혼잡 적응 | 정적 / 혼잡 A* | 동적 (학습) | 제약 기반 | 학습 (보상 반영) |
| 학습 필요 | 없음 | 필요 (SB3 PPO) | 없음 | 필요 (QMIX) |
| 실시간 추론 | O(V log V) | O(1) (신경망) | NP-hard 일반 | O(1) (분산 실행) |
| 구현 파일 | `astar.py` | `route_env.py`, `ppo_agent.py` | `cbs_ts/` | `cactus/` |
| 의존성 | 없음 | stable-baselines3 | pulp (CBC) | torch, pettingzoo |
| fallback | - | A* (`run_astar_congestion`) | A* | A* |

---

## 6. 비교 실험 계획 (Task 027)

### 6.1 평가 지표 (MAPF 표준, Stern et al. 2019)

| 지표 | 정의 |
|------|------|
| **Makespan** | 모든 AMR 완료까지 총 시간 |
| **Sum of Costs** | 모든 AMR 이동 비용 합 |
| **Throughput** | 단위 시간당 완료 반송 수 |
| **Collision Rate** | 충돌 발생 비율 |
| **Path Optimality** | 실제 비용 / 최적 비용 |

### 6.2 실험 변수

| 변수 | 값 |
|------|-----|
| AMR 수 N | {8, 16, 32} |
| 부하율 ρ | {0.3, 0.5, 0.7} |
| 시뮬레이션 시간 | 300s (표준), 600s (정밀) |
| 시드 | 3개 이상 (Wilcoxon 검정) |

### 6.3 비교 조건

```
A*       — 정적 최단 경로 베이스라인
PPO      — SB3 학습, 200k 스텝, 본 실 레이아웃
CBS-TS   — MLA* + CBS + MILP, pulp CBC
CACTUS   — QMIX CTDE, 10k 에피소드, Reverse Curriculum, 본 실 레이아웃
```

### 6.4 가설

- **H1** (저부하 ρ=0.3): A* ≈ CBS-TS > PPO ≈ CACTUS (충돌 적어 탐색 우세)
- **H2** (고부하 ρ=0.7): CBS-TS > CACTUS > PPO > A* (협력 학습 효과)
- **H3** (대규모 N=32): CACTUS > CBS-TS (CBS 지수 증가 vs QMIX O(1) 추론)

---

## 7. 추론 파이프라인 (공통)

```
POST /api/inference?algorithm={astar|ai_ppo|cbs_ts|cactus}
  │
  ▼
strategy = STRATEGY_REGISTRY[algorithm]
  │
  ├─ AstarStrategy.predict()     → run_astar()
  ├─ PpoStrategy.predict()       → ppo_agent.predict() [or A* fallback]
  ├─ CbsTsStrategy.predict()     → cbs_high_level() [or A* fallback]
  └─ CactusStrategy.predict()    → qmix_agent.predict_single() [or A* fallback]
  │
  ▼
(path: List[str], cost: float, confidence: float)
  │
  ▼
SimPy 시뮬레이션 → carrier 이동 → 결과 DB 저장
```

모든 알고리즘은 checkpoint/solver 미존재 시 A* fallback으로 서비스 가용성 보장.
