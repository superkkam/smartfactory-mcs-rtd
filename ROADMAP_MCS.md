# MCS 물류 모델링·AI 경로 최적화 플랫폼 개발 로드맵

공장 물류 레이아웃 모델링·실시간 모니터링과 AI 경로 최적화를 통합하여, 기존 A* 알고리즘 대비 반송 효율 20% 이상 개선하는 MCS 연구 플랫폼

## 개요

MCS 플랫폼은 스마트팩토리 연구원 및 현장 엔지니어를 위한 물류 모델링·AI 경로 최적화 시스템으로 다음 기능을 제공합니다:

- **공장 레이아웃 모델러 (F001)**: React Flow 기반 드래그앤드롭 장비 배치, 기준정보 입력, AGV 경로 개별/일괄 생성, JSON 저장/버전관리
- **반송 명령 생성 및 경로 탐색 (F002~F004)**: MacroCommand→MicroCommand 분해, A* Baseline 경로 탐색, PPO 기반 AI 경로 최적화 추론
- **시뮬레이션 엔진 (F005, F006)**: A* vs AI 알고리즘 비교 실험, 성과 지표(반송 시간/처리량/충돌/부하균형) 분석 및 CSV 내보내기
- **실시간 물류 모니터링 (F007, F008)**: 레이아웃 위 장비 상태 오버레이, framer-motion 캐리어 이동 애니메이션, WebSocket Push
- **RTD-MCS 통합 인터페이스 (F009)**: RTD 디스패칭 결과 수신 → MacroCommand 자동 생성 (통합 실행 시 활성)

## 기술 스택

- **프론트엔드**: Next.js 15 (App Router) + React 19 + TypeScript 5.6+
- **모노레포**: Turborepo (`apps/mcs`, `packages/ui`, `packages/auth`, `packages/types`)
- **UI**: TailwindCSS v4 + shadcn/ui
- **레이아웃 모델러**: React Flow 12.x + Zustand (Undo/Redo 이력)
- **애니메이션**: framer-motion (캐리어 LHT/Stocker 이동 애니메이션)
- **심볼**: SVG React 컴포넌트 (Stocker/Conveyor/Port/LHT/AGV/Carrier 등)
- **시각화**: Recharts (히스토그램, 막대 그래프)
- **실시간**: WebSocket (장비 상태, 캐리어 이동 이벤트)
- **인증**: Supabase Auth (이메일/비밀번호)
- **AI 엔진**: Python 3.12+ + FastAPI + PyTorch 2.x + Stable-Baselines3 (PPO) + NetworkX + SimPy

## 개발 워크플로우

1. **작업 계획**
   - 현재 코드베이스를 파악하고 `ROADMAP_MCS.md` 업데이트
   - 우선순위 작업은 마지막 완료된 작업 다음에 삽입

2. **작업 생성**
   - `/tasks` 디렉토리에 새 작업 파일 생성
   - 명명 형식: `MCS-XXX-description.md` (예: `MCS-001-monorepo-setup.md`)

3. **작업 구현**
   - 작업 파일 명세서에 따라 구현
   - API 연동 및 비즈니스 로직 구현 시 Playwright MCP로 테스트 수행
   - 각 단계 완료 후 체크리스트 업데이트

4. **로드맵 업데이트**
   - 완료된 작업을 ✅로 표시

---

## 개발 단계

### Phase 1: 애플리케이션 골격 구축

- **Task 001: Turborepo 모노레포 초기 설정 및 라우팅 골격 구성** - 우선순위
  - `apps/mcs` Next.js 15 앱 생성 + `packages/ui`, `packages/auth`, `packages/types` 워크스페이스 구성 (RTD와 공유)
  - `turbo.json` 빌드 파이프라인 설정
  - App Router 전체 라우트 구조 생성: `/(auth)/login`, `/(auth)/register`, `/(app)/dashboard`, `/(app)/layout-modeler`, `/(app)/transfer-control`, `/(app)/simulation`, `/(app)/simulation/result`, `/(app)/simulation/settings`
  - 각 라우트에 빈 페이지 컴포넌트 (`page.tsx`) 생성
  - `.env.example` 환경 변수 템플릿 작성 (Supabase, FastAPI AI 엔진 URL)

- **Task 002: TypeScript 타입 정의 및 Zod 스키마 구성**
  - `packages/types`에 10개 엔티티 인터페이스 정의: `Layout`, `Equipment`, `EquipmentUnit`, `TransferRelation`, `MacroCommand`, `MicroCommand`, `Carrier`, `RouteFindingResult`, `SimulationRun`, `SimulationResult`
  - React Flow 노드/엣지 커스텀 타입 정의 (`EquipmentNode`, `UnitNode`, `TransferEdge`)
  - AI 엔진 API 요청/응답 타입 정의 (`InferenceRequest`, `InferenceResponse`, `SimulationRunRequest`)
  - 공통 상수 정의 (장비 유형, 유닛 유형, 명령 상태, 알고리즘 유형 등)

- **Task 003: 공통 레이아웃 골격 구현**
  - 인증 보호 미들웨어 껍데기 (`middleware.ts`)
  - 앱 레이아웃 (`/(app)/layout.tsx`): 사이드바 + 헤더 네비게이션 골격
  - 사이드바 메뉴 구조: 대시보드, 레이아웃 모델러, 반송 제어, 시뮬레이션, 시뮬레이션 결과
  - 인증 레이아웃 (`/(auth)/layout.tsx`)

---

### Phase 2: UI/UX 완성 (더미 데이터 활용)

- **Task 004: shadcn/ui 공통 컴포넌트 라이브러리 + 더미 데이터 구성**
  - `packages/ui`에 공통 컴포넌트 구현: Button, Input, Select, Dialog, Table, Card, Badge, Tabs, Toast, Progress
  - 더미 데이터 유틸리티 (`lib/dummy/`): 레이아웃 JSON, 장비 목록, 캐리어 상태, 반송 명령, 시뮬레이션 결과 목 데이터
  - SVG 심볼 기본 뼈대 컴포넌트 생성: `StorkerSymbol`, `ConveyorSymbol`, `PortSymbol`, `AGVSymbol`, `CarrierSymbol`
  - 디자인 시스템 설정 (TailwindCSS v4 테마)

- **Task 005: 로그인/회원가입 페이지 UI 구현**
  - 로그인 페이지: 이메일/비밀번호 폼, React Hook Form + Zod 유효성 검사, 회원가입 링크
  - 회원가입 페이지: 이메일/비밀번호/비밀번호 확인 폼
  - 더미 인증 흐름 (로그인 버튼 클릭 → 대시보드로 이동)

- **Task 006: 대시보드 UI 구현 — 레이아웃 기반 물류 모니터링 뷰어**
  - React Flow 읽기 전용 뷰어: 저장된 레이아웃 JSON 로드 → 노드/엣지 렌더링 (더미 JSON)
  - 장비 상태 오버레이 UI: Online(초록)/Offline(회색)/Error(빨강) 배지 (더미 상태)
  - 캐리어 위치 표시 (더미 데이터로 레이아웃 위 캐리어 노드 렌더링)
  - 층별(Floor) 탭 전환 UI (1F/2F/3F)
  - 진행 중인 MacroCommand/MicroCommand 상태 목록 패널 (더미)
  - 알람/이상 배지 표시, 레이아웃 편집·반송 제어·시뮬레이션 바로가기 버튼

- **Task 007: 레이아웃 모델러 페이지 UI 구현 — React Flow 편집 캔버스**
  - React Flow 12.x 편집 캔버스 기본 설정 (줌/패닝, 미니맵, 배경 그리드, Undo/Redo)
  - 좌측 심볼 팔레트: Equipment(Stocker/Conveyor/Process), Unit(Port/Crane/AGV), System(ACS), 보조 탭 분류
  - 심볼 팔레트 → 캔버스 드래그앤드롭 (HTML Drag and Drop API, `screenToFlowPosition()` 변환)
  - 커스텀 노드 렌더링: 각 심볼 SVG 컴포넌트 + Equipment/Unit 계층 그룹 노드
  - 우측 기준정보 속성 패널: EQUIPMENT_ID, EQUIPMENT_UNIT_ID, EC_SERVER_NAME, EQUIPMENT_TYPE, INLINE_STOCKER 입력 폼 (선택 노드 연동 더미)
  - Zustand 레이아웃 편집 상태 관리 (노드/엣지 + Undo/Redo 이력 스택)

- **Task 008: 레이아웃 모델러 — AGV 경로 생성 UI 구현**
  - Port 노드 핸들 → 드래그 → 다른 Port 노드에 연결하여 개별 TransferEdge 생성 (`onConnect` 콜백)
  - Port-to-Port 전용 연결 검증 UI (비Port 노드 연결 시 에러 토스트)
  - FIXED_IN_OUT_MODE 표시 (INPUT/OUTPUT 배지) + 연결 방향 제한 UI
  - 복수 Port 선택 → 우클릭 컨텍스트 메뉴 → "경로 일괄 생성" 모달: ACS 시스템 + WEIGHT 입력 → 완전 양방향 경로 자동 생성 미리보기
  - TransferEdge 점선 화살표 커스텀 엣지 컴포넌트, 선택 시 속성 패널에 WEIGHT·시스템 정보 표시
  - 저장/버전관리 UI: 저장 버튼, 버전 목록 드롭다운 (더미)

- **Task 009: 반송 제어 페이지 UI 구현**
  - 출발지/목적지 EquipmentUnit 선택 폼 (드롭다운, 더미 유닛 목록)
  - MacroCommand 생성 결과 및 MicroCommand 분해 시퀀스 표시 카드 (더미)
  - A* 경로 탐색 결과 표시: 경로 경유지 시퀀스 + GCOST/HCOST/FCOST 테이블 (더미)
  - AI 경로 추론 결과 표시: 동적 가중치 반영 경로 + A* vs AI 비교 뷰 (더미)
  - RTD 연동 상태 배지 + 수동 트리거 버튼 (비활성 UI 상태로)
  - 명령 실행 버튼

- **Task 010: 시뮬레이션 페이지 + 시뮬레이션 설정 페이지 + 시뮬레이션 결과 페이지 UI 구현**
  - 시뮬레이션 페이지: 시나리오 파라미터 폼(캐리어 수/반송 요청 수/시뮬레이션 시간), 알고리즘 선택(A* 단독/AI 단독/비교), 진행 상태 Progress 바
  - 시뮬레이션 설정 페이지: Carrier CRUD 테이블(캐리어 ID/자재 유형/현재 위치), 기본 파라미터 저장 폼
  - 시뮬레이션 결과 페이지: A* vs AI 성과 지표 비교 테이블(평균 반송 시간/처리량/충돌 횟수/부하균형 표준편차, 더미), 개선율 배지(20% 목표), 반송 시간 분포 히스토그램, 장비별 가동률 막대 그래프, CSV 내보내기 버튼

---

### Phase 3: 핵심 기능 구현 (백엔드 연동)

- **Task 011: Supabase Auth 실제 연동** - 우선순위
  - `@supabase/ssr` 기반 쿠키 세션 관리 구현
  - `signInWithPassword()`, `signUp()`, `signOut()` 실제 API 연동
  - `middleware.ts` 인증 보호 미들웨어 완성
  - `packages/auth` 공통 Supabase 클라이언트 모듈화 (RTD와 공유)
  - Playwright MCP로 로그인/로그아웃/회원가입 E2E 테스트

- **Task 012: Supabase DB API 연동 레이어 구성**
  - Supabase 클라이언트 기반 API 유틸리티 구현 (`lib/api/`)
  - TanStack Query 5.x 설정 (`QueryClient`, `QueryClientProvider`)
  - Layout, Equipment, EquipmentUnit, TransferRelation, MacroCommand, MicroCommand, Carrier CRUD API 훅 구현

- **Task 013: 레이아웃 모델러 저장/로드 실제 연동**
  - React Flow 노드/엣지 JSON 직렬화 → Supabase `Layout.json_data` 저장 API 연동
  - 레이아웃 버전 목록 조회 및 불러오기 API 연동 (더미→실데이터 교체)
  - JSON 로드 시 Equipment, EquipmentUnit, TransferRelation 자동 파싱 및 DB 동기화
  - AGV 경로 일괄 생성 비즈니스 로직 완성 (Port-to-Port 검증, FIXED_IN_OUT_MODE, N×M 생성 → `setEdges()` 일괄 추가 → 저장)
  - Playwright MCP로 레이아웃 편집 → 저장 → 로드 플로우 테스트

- **Task 014: A* 경로 탐색 엔진 구현 (Baseline)**
  - Supabase DB에서 TransferRelation 그래프 로드 → NetworkX 방향 가중 그래프 변환 (Next.js Server Action 또는 FastAPI 엔드포인트)
  - A* 알고리즘 구현: GCOST(누적 weight), HCOST(출발~목적지 유클리드 거리), FCOST = GCOST + HCOST
  - MacroCommand → MicroCommand 시퀀스 분해 로직
  - 경로 탐색 결과 → RouteFindingResult DB 저장
  - Playwright MCP로 출발지/목적지 선택 → A* 경로 탐색 → 결과 표시 플로우 테스트

- **Task 015: FastAPI AI 엔진 서버 구축 (Python)**
  - `apps/ai-engine/` FastAPI 프로젝트 구성 (`main.py`, `routers/`, `models/`)
  - REST API 엔드포인트 구현:
    - `POST /api/inference` — 레이아웃 그래프 + 현재 상태 → PPO 경로 추론 결과 반환
    - `GET /api/model/status` — PPO 모델 로딩 상태
    - `POST /api/simulation/run` — SimPy 기반 시뮬레이션 실행 요청
    - `GET /api/simulation/{id}/result` — 시뮬레이션 결과 조회
  - Stable-Baselines3 PPO 모델 로딩 및 추론 로직 구현
  - NetworkX 그래프 변환 유틸리티 (Layout JSON → 방향 가중 그래프)

- **Task 016: AI PPO 경로 추론 프론트엔드 연동**
  - Next.js → FastAPI `POST /api/inference` 호출 구현
  - 동적 가중치 입력 (장비 상태: Equipment.state, 트래픽: 진행 중인 MicroCommand 수)
  - AI 추론 결과 → A* vs AI 비교 뷰 실데이터 바인딩 (더미→실데이터 교체)
  - 로딩 상태 표시 (모델 추론 중 Spinner)
  - Playwright MCP로 AI 경로 추론 → 결과 표시 플로우 테스트

- **Task 017: SimPy 시뮬레이션 엔진 구현 + 결과 연동**
  - `apps/ai-engine/` 내 SimPy 기반 이산 이벤트 시뮬레이션 구현
  - 가상 반송 요청 자동 생성기 (캐리어 수, 반송 요청 수, 시뮬레이션 시간 파라미터 기반)
  - A* vs PPO 알고리즘 동시 실행 및 성과 지표(평균 반송 시간/처리량/충돌 횟수/부하균형 표준편차) 산출
  - SimulationRun, SimulationResult Supabase DB 저장
  - 시뮬레이션 결과 페이지 실데이터 바인딩 (더미→실데이터 교체) + CSV 내보내기 기능

- **Task 018: Phase 3 통합 테스트**
  - Playwright MCP를 사용한 전체 사용자 플로우 E2E 테스트
  - 로그인 → 레이아웃 모델링 → 저장 → 반송 제어(A*/AI) → 시뮬레이션 실행 → 결과 확인 전체 흐름 검증
  - 에러 핸들링 테스트 (AI 엔진 오프라인, 레이아웃 없음, 경로 없음 등)

---

### Phase 4: 실시간 모니터링 + RTD 연동 + 배포

- **Task 019: WebSocket 실시간 물류 모니터링 연동**
  - WebSocket 연결 훅 구현 (`useLayoutMonitor`): 장비 상태 변경 이벤트 수신
  - 대시보드 React Flow 뷰어 실시간 장비 상태 오버레이 바인딩 (더미→실데이터 교체)
  - 캐리어 이동 이벤트 수신 → 노드 위치 업데이트 처리
  - 층별 탭 전환 실데이터 연동
  - 연결 끊김 자동 재연결 처리

- **Task 020: framer-motion 캐리어 이동 애니메이션 구현**
  - LHT 크레인 애니메이션: Pick(수직 이동) → X축 이동 → Place(수직 이동) 4단계 순차 애니메이션 (`useAnimationControls()`)
  - Stocker 크레인 애니메이션: 수직 이동 시퀀스
  - AGV 이동 애니메이션: TransferRelation 경로 따라 이동 (`motionValue` 기반)
  - React Flow 좌표계 ↔ 화면 좌표계 변환 (`useReactFlow().flowToScreenPosition()`)
  - WebSocket 캐리어 이동 이벤트 → 애니메이션 트리거 연동

- **Task 021: RTD-MCS 통합 인터페이스 구현**
  - RTD 디스패칭 결과 수신 → MacroCommand 자동 생성 API 엔드포인트
  - MCS 반송 완료 이벤트 → RTD 트리거 REST API 전송
  - 반송 제어 페이지 RTD 연동 상태 표시 + 수동 트리거 버튼 실데이터 연동
  - 단독 실행 시 F009 인터페이스 비활성 처리 (환경 변수 `NEXT_PUBLIC_RTD_ENABLED` 기반)

- **Task 022: 성능 최적화 + Vercel 배포 + CI/CD 구성**
  - Next.js 번들 크기 분석 및 최적화 (React Flow 지연 로딩, SVG 심볼 코드 스플리팅)
  - TanStack Query 캐싱 전략 최적화 (레이아웃 데이터 staleTime 설정)
  - `apps/mcs` Vercel 독립 배포 설정
  - `apps/ai-engine` FastAPI 배포 설정 (Railway / Fly.io 등)
  - GitHub Actions CI/CD 파이프라인 (lint, type-check, build, test)
  - 환경 변수 관리 (`.env.production`: Supabase URL/Key, FastAPI URL)

---

## 진행 현황 요약

| Phase | 상태 | Task 수 | 완료 |
|-------|------|---------|------|
| Phase 1: 애플리케이션 골격 구축 | 대기 | 3 | 0/3 |
| Phase 2: UI/UX 완성 (더미 데이터) | 대기 | 7 | 0/7 |
| Phase 3: 핵심 기능 구현 | 대기 | 8 | 0/8 |
| Phase 4: 실시간 모니터링 + 배포 | 대기 | 4 | 0/4 |
| **합계** | | **22** | **0/22** |
