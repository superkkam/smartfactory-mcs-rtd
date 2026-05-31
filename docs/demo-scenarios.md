# 최종 발표 데모 시나리오

노코드 디스패칭 룰 빌더와 AI 경로 최적화를 적용한 스마트팩토리 MCS-RTD 통합 제어 플랫폼

---

## 시나리오 A — MCS 단독: AI 알고리즘 비교 (약 7분)

> **목적**: A* 대비 강화학습 기반 알고리즘(PPO, CACTUS, CBS-TS)의 반송 효율 개선 시연

### 사전 준비
- 기존 저장된 레이아웃 로드 (STK-001, PROC-001 등)
- 데모용 캐리어 시드 데이터 삽입

### 진행 순서

**Step 1. 레이아웃 확인 (1분)**
- 대시보드 → 저장된 레이아웃 로드
- 장비 배치 및 경로 엣지 가중치 설명
- AMR 초기 위치 확인

**Step 2. 시뮬레이션 파라미터 설정 (1분)**
- 시뮬레이션 페이지 이동
- 파라미터 입력
  - AMR 수 / 반송 요청 수 / 시뮬레이션 시간
- 알고리즘 선택: 4종 비교 모드

**Step 3. 알고리즘 4종 비교 실행 (2분)**

| 알고리즘 | 방식 | 특징 |
|---------|------|------|
| A* | 정적 최단경로 | Baseline — 비교 기준선 |
| PPO | 단일 에이전트 강화학습 | 동적 혼잡도 실시간 반영 |
| CACTUS | QMIX 멀티 에이전트 협력 학습 | AMR 간 협력 최적화 |
| CBS-TS | MILP + CBS 충돌 회피 | 작업 순서 최적화 + 충돌 없는 경로 보장 |

**Step 4. 결과 비교 (2분) — 클라이맥스**
- 7개 지표 비교 테이블
  - 평균 반송시간 / 처리량 / 충돌 횟수
  - 부하균형 std / 데드락 / 경로효율 점수
- A* 대비 개선율 배지 (목표: 20% 이상)
- 반송 시간 분포 히스토그램 (4개 알고리즘 오버레이)

**Step 5. ReplayCanvas 재생 (1분)**
- 알고리즘 탭 전환하며 이동 경로 재생
- CBS-TS vs PPO 충돌 처리 방식 차이 시각 비교

**Step 6. CSV 내보내기**
- 논문 실험 데이터 저장 시연

---

## 시나리오 B — RTD 단독: 노코드 룰 빌더 (약 5분)

> **목적**: 코드 없이 현장 엔지니어가 직접 디스패칭 룰을 생성·검증하는 과정 시연

### 사전 준비
- PROC-001 장비 / LoadRequest 이벤트 매핑 사전 설정
- 데모용 룰 그룹 및 시퀀스 시드 데이터 삽입

### 진행 순서

**Step 1. 룰 그룹 관리 (1분)**
- Fallback 계층 구조 설명 (EQP_FULL / EQP_EMPTY / EQP_COMMON)
- PROC-001 장비 — LoadRequest 이벤트 매핑 확인

**Step 2. 룰 플로우 빌더 (2분)**
- React Flow 캔버스에서 시퀀스 블록 구성 설명
  - Data 블록: `mcs_carrier` 테이블 전체 조회
  - Filter 블록: `lot_state = 'FULL'` 조건 필터
  - Sort 블록: `priority DESC` 정렬
- SQL 자동 생성 미리보기 토글 (개발자 전용 확인)

**Step 3. 룰 시뮬레이터 dry-run (1분)**
- 테스트 파라미터 입력 (장비ID: PROC-001, 이벤트: LoadRequest)
- 시퀀스별 필터 결과 건수 확인
- 1순위 캐리어 선택 결과 표시

**Step 4. 모니터링 대시보드 (1분)**
- 실행 이력 테이블 확인
- 룰 히트율 순위 차트
- Supabase Realtime 연결 상태 배지

---

## 시나리오 C — MCS-RTD 통합: End-to-End 반송 (약 8분)

> **목적**: LoadRequest 발생부터 실제 AMR 이동까지 SEMI E82 기준 완전한 흐름 시연

### 사전 준비
- MCS + RTD 통합 실행 모드 (`NEXT_PUBLIC_RTD_ENABLED=true`)
- 캐리어 C-001이 STK-001-PORT-1에 위치, 상태: Idle
- PROC-001-PORT-1 LoadRequest 룰 매핑 설정 완료
- MCS 대시보드 + RTD 모니터링 화면 분할 표시

### 진행 순서

**Step 1. 초기 상태 확인 (1분)**
- MCS 대시보드: 캐리어 C-001 위치 (STK-001), 상태 Idle
- RTD 모니터링: Supabase Realtime 연결 배지 Green
- 연동 상태 배지 확인

**Step 2. LoadRequest 발생 (1분) — 핵심**
- MCS 대시보드에서 PROC-001-PORT-1 노드 우클릭
- 컨텍스트 메뉴 → "LoadRequest 발생" 클릭
- RTD 화면에서 룰 실행 로그 실시간 등장
  ```
  [LoadRequest] PROC-001 / PORT-1
  → 룰 실행: PROC-001_LoadRequest
  → C-001 선택 (priority: 1, lot_state: FULL)
  → 출발: STK-001-PORT-1 / 목적: PROC-001-PORT-1
  → MCS 전달 완료
  ```

**Step 3. MacroCommand 자동 생성 확인 (1분)**
- MCS 반송 제어 페이지: RTD 수신 배지 활성화
- 자동 생성된 MacroCommand 표시
  - 출발: STK-001-PORT-1 → 목적: PROC-001-PORT-1
  - 알고리즘: A* / AI 자동 선택
  - 경로: nd-001 경유

**Step 4. 실시간 반송 (3분) — 클라이맥스**
- MCS 대시보드에서 AMR 이동 애니메이션 시작
- SEMI E82 상태 전이 배지 실시간 표시

  | 상태 | 설명 |
  |------|------|
  | Idle | 대기 중 |
  | Assigned | 반송 명령 할당 |
  | MovingEmpty | 빈 상태로 STK-001 방향 이동 |
  | Acquiring | STK-001-PORT-1에서 캐리어 인수 |
  | Loaded | C-001 탑재 완료 |
  | MovingLoaded | PROC-001 방향 이동 |
  | Depositing | PROC-001-PORT-1에 캐리어 내려놓기 |
  | Idle | 반송 완료, 대기 복귀 |

- RTD 모니터링: 각 단계별 이벤트 로그 동시 표시

**Step 5. 완료 확인 (1분)**
- 캐리어 C-001이 PROC-001 위치로 이동 완료
- RTD 모니터링: "반송 완료" 콜백 이벤트 기록
- MacroCommand 상태: Completed
- MCS 대시보드 캐리어 위치 업데이트 확인

---

## 데모 환경 체크리스트

### 공통
- [ ] Supabase 연결 정상
- [ ] MCS 앱 실행 (`localhost:3001`)
- [ ] RTD 앱 실행 (`localhost:3000`)
- [ ] AI 엔진 실행 (`localhost:8000`)

### 시나리오 A
- [ ] 기존 레이아웃 로드 확인
- [ ] AI 엔진 `/api/health` 정상 (PPO 모델 로딩 여부 확인)
- [ ] CACTUS 모델 (`trained_models/cactus_qmix.pt`) 존재 확인

### 시나리오 B
- [ ] PROC-001 룰 매핑 설정 확인
- [ ] 룰 시퀀스 시드 데이터 삽입 확인

### 시나리오 C
- [ ] `NEXT_PUBLIC_RTD_ENABLED=true` 환경 변수 확인
- [ ] C-001 캐리어 STK-001-PORT-1 위치 초기화
- [ ] PROC-001-PORT-1 LoadRequest 매핑 확인
- [ ] MCS + RTD 화면 분할 준비 (발표자 화면)
