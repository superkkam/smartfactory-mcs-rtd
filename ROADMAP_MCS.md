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
- **애니메이션**: framer-motion@11 (AMR/캐리어 위치 보간, RF Node.position 직접 애니메이션)
- **ACS 층**: MCS 내부 `apps/mcs/lib/acs/` 모듈 (SEMI E82 축소판 vehicle state machine, BFS path planning, localStorage leader lock tick loop)
- **심볼**: SVG React 컴포넌트 (Stocker/Conveyor/Port/LHT/AGV/Carrier 등)
- **시각화**: Recharts (히스토그램, 막대 그래프)
- **실시간**: Supabase Realtime postgres_changes (장비 상태, 캐리어/AMR 위치 이벤트)
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

- ✅ **Task 001: Turborepo 모노레포 초기 설정 및 라우팅 골격 구성** — 완료
  - `apps/mcs` Next.js 16 앱 생성 + `packages/ui`, `packages/auth`, `packages/types` 워크스페이스 구성 (RTD와 공유)
  - `turbo.json` 빌드 파이프라인 설정
  - App Router 전체 라우트 구조 생성: `/(auth)/login`, `/(auth)/register`, `/(app)/dashboard`, `/(app)/layout-modeler`, `/(app)/transfer-control`, `/(app)/simulation`, `/(app)/simulation/result`, `/(app)/simulation/settings`
  - 각 라우트에 빈 페이지 컴포넌트 (`page.tsx`) 생성
  - `.env.example` 환경 변수 템플릿 작성 (Supabase, FastAPI AI 엔진 URL)

- ✅ **Task 002: TypeScript 타입 정의 및 Zod 스키마 구성** — 완료
  - `packages/types/src/mcs.ts`에 10개 엔티티 인터페이스 정의 + React Flow 커스텀 타입 + AI API 타입
  - `packages/types/src/constants.ts`에 MCS 상수 8종 추가 (EQUIPMENT_TYPES, UNIT_TYPES, IN_OUT_MODES, EQUIPMENT_STATES, COMMAND_STATES, CARRIER_STATES, ALGORITHM_TYPES, SIMULATION_STATUSES)
  - `packages/types/src/schemas.ts`에 MCS Zod 스키마 6종 추가 (layout, equipment, equipmentUnit, carrier, macroCommand, simulationParams)

- ✅ **Task 003: 공통 레이아웃 골격 구현** — 완료
  - 인증 보호 프록시 (`proxy.ts`) — Next.js 16 proxy 방식, Supabase 세션 관리 + 로그인 리디렉션
  - 앱 레이아웃 (`/(app)/layout.tsx`): 사이드바 + 헤더 네비게이션 골격
  - 사이드바 메뉴 구조: 대시보드, 레이아웃 모델러, 반송 제어, 시뮬레이션, 시뮬레이션 결과
  - 인증 레이아웃 (`/(auth)/layout.tsx`)

---

### Phase 2: UI/UX 완성 (더미 데이터 활용)

- ✅ **Task 004: shadcn/ui 공통 컴포넌트 라이브러리 + 더미 데이터 구성** — 완료
  - shadcn/ui 컴포넌트 RTD→MCS 복사 (badge, card, checkbox, dialog, dropdown-menu, select, separator, sonner, table, tabs, tooltip) → 총 14개
  - 더미 데이터 유틸리티 (`lib/dummy/`): layout, equipment, commands, carriers, simulation (A* vs AI 비교 포함)
  - SVG 심볼 컴포넌트 생성 (`components/symbols/`): THiRA JSON 원본 파싱 기반 실제 장비 형상
    - `PortSymbol` (9×9, rect+triangle), `ConveyorSymbol` (14×12, 8롤러), `CraneSymbol` (21×22, 본체+바퀴)
    - `AgvSymbol` (100×100, 암+캐빈), `ProcessSymbol` (100×40, 챔버3개+설비), `StockerSymbol` (300×45, 44포트 프로그래매틱)
    - `CarrierSymbol` (40×40, FOUP 커스텀 구현)
  - `segmentsToPath()` 헬퍼 — THiRA segments(1=M/2=L/3=corner/4=C) → SVG path d 변환

- ✅ **Task 005: 로그인/회원가입 페이지 UI 구현** — 완료
  - 로그인 페이지: 이메일/비밀번호 폼, 유효성 검사, 회원가입 링크, Supabase 실연동
  - 회원가입 페이지: 이메일/비밀번호/비밀번호 확인 폼, 유효성 검사
  - 로그인 성공 → `/dashboard` 리디렉션

- ✅ **Task 006: 대시보드 UI 구현 — 레이아웃 기반 물류 모니터링 뷰어** — 완료
  - React Flow 읽기 전용 뷰어: 저장된 레이아웃 JSON 로드 → 노드/엣지 렌더링 (더미 JSON)
  - 장비 상태 오버레이 UI: Online(초록)/Offline(회색)/Error(빨강) 배지 (더미 상태)
  - 캐리어 위치 표시 (더미 데이터로 레이아웃 위 캐리어 노드 렌더링)
  - 층별(Floor) 탭 전환 UI (1F/2F/3F)
  - 진행 중인 MacroCommand/MicroCommand 상태 목록 패널 (더미)
  - 알람/이상 배지 표시, 레이아웃 편집·반송 제어·시뮬레이션 바로가기 버튼

- ✅ **Task 007: 레이아웃 모델러 페이지 UI 구현 — React Flow 편집 캔버스** — 완료
  - AMR 기반 반송 아키텍처 (컨베이어 제거): Process+Port 그룹 노드, Node(경유 노드), TransferRelation 엣지
  - 심볼 팔레트 (Stocker/Process/Node) → 캔버스 드래그앤드롭 (HTML DnD API, `screenToFlowPosition()`)
  - 그룹 노드: Stocker(200×80) / Process(180×110) + 자식 Port 노드 자동 생성 (`parentId` + `extent: 'parent'`)
  - Node: 다이아몬드(◆) 형태, 4방향 Handle — AMR 경로 중간 경유 지점 (구 Waypoint, AMR 업계 표준 용어로 변경)
  - TransferRelation 커스텀 엣지: 점선 화살표, 거리(가중치) 라벨, `hidden` 토글 — `EdgeLabelRenderer` 활용
  - 속성 패널: 선택 노드 타입별 정보 표시 (Equipment/Port/Node/TransferRelation 구분)
  - 하단 툴바: 릴레이션 전체 보기/숨기기 토글, 저장(콘솔), 노드·엣지 수 통계
  - `onConnect` 콜백으로 Port/Node 간 TransferEdge 직접 연결 가능
  - 대시보드 뷰어도 동일 노드 컴포넌트 재사용 (읽기 전용)

- ✅ **Task 008: 레이아웃 모델러 — AGV 경로 생성 UI 구현** — 완료
  - Port 노드 핸들 → 드래그 → 다른 Port 노드에 연결하여 개별 TransferEdge 생성 (`onConnect` 콜백)
  - Port-to-Port 전용 연결 검증 UI (비Port 노드 연결 시 에러 토스트) + `isValidConnection` 연결 방향 제한
  - IN 포트 → 출발 불가 / OUT 포트 → 도착 불가 방향 제한 (IN/OUT/BOTH 배지 기존 유지)
  - 복수 Port 선택(Shift+클릭) → 우클릭 컨텍스트 메뉴 → "경로 일괄 생성" 모달: ACS 시스템 + WEIGHT 입력 → 완전 양방향 경로 자동 생성 미리보기 (`canvas-context-menu.tsx`, `batch-route-dialog.tsx`)
  - TransferEdge 선택 시 속성 패널에서 WEIGHT·ACS 시스템 직접 편집 가능 (`setExternalEdgeUpdate` ref 패턴)
  - TransferEdge 라벨에 weight(m) + system 배지 표시
  - 저장/버전관리 UI: 저장 버튼, 버전 목록 드롭다운 더미 3개 (`@base-ui/react/select`)

- ✅ **Task 009: 반송 제어 페이지 UI 구현** — 완료
  - 출발지/목적지 EquipmentUnit 선택 폼 (드롭다운, 더미 유닛 목록)
  - MacroCommand 생성 결과 및 MicroCommand 분해 시퀀스 표시 카드 (더미)
  - A* 경로 탐색 결과 표시: 경로 경유지 시퀀스 + GCOST/HCOST/FCOST 테이블 (더미)
  - AI 경로 추론 결과 표시: 동적 가중치 반영 경로 + A* vs AI 비교 뷰 (더미)
  - RTD 연동 상태 배지 + 수동 트리거 버튼 (비활성 UI 상태로)
  - 명령 실행 버튼

- ✅ **Task 010: 시뮬레이션 페이지 + 시뮬레이션 설정 페이지 + 시뮬레이션 결과 페이지 UI 구현** — 완료
  - 시뮬레이션 페이지: 시나리오 파라미터 폼(캐리어 수/반송 요청 수/시뮬레이션 시간), 알고리즘 선택(A* 단독/AI 단독/비교), 진행 상태 Progress 바
  - 시뮬레이션 설정 페이지: Carrier CRUD 테이블(캐리어 ID/자재 유형/현재 위치), 기본 파라미터 저장 폼
  - 시뮬레이션 결과 페이지: A* vs AI 성과 지표 비교 테이블(평균 반송 시간/처리량/충돌 횟수/부하균형 표준편차, 더미), 개선율 배지(20% 목표), 반송 시간 분포 히스토그램(Recharts), 장비별 가동률 막대 그래프(Recharts), CSV 내보내기 버튼

---

### Phase 3: 핵심 기능 구현 (백엔드 연동)

- ✅ **Task 011: Supabase Auth 실제 연동** — 완료
  - `@supabase/ssr` 기반 쿠키 세션 관리 구현
  - `signInWithPassword()`, `signUp()`, `signOut()` 실제 API 연동
  - `apps/mcs/proxy.ts` 인증 보호 미들웨어 완성 (Next.js 16 proxy 방식)
  - `packages/auth` 공통 Supabase 클라이언트 모듈화 (RTD와 공유), MCS는 `proxy.ts` 독립 운영
  - 로그인 → `/dashboard` 리다이렉트, 비인증 → `/login` 리다이렉트 동작 확인

- ✅ **Task 012: Supabase DB API 연동 레이어 구성** — 완료
  - `docs/supabase-schema-mcs.sql` 작성 — 10개 테이블 DDL (mcs_ 접두사), RLS authenticated_all 정책
  - `packages/types/src/mcs.ts`에 `layoutId` FK 필드 추가 (Equipment, TransferRelation)
  - `apps/mcs/lib/api/` 7개 파일 생성: layouts, equipment, equipment-units, transfer-relations, carriers, macro-commands, micro-commands
  - RTD `rule-groups.ts` 패턴 적용: `toEntity(row)` / `toRow(entity)` + `useQuery`/`useMutation` CRUD hooks
  - 관계 기반 쿼리 훅: `useEquipmentsByLayout`, `useUnitsByEquipment`, `useMicroCommandsByMacro`, `useTransferRelationsByLayout`, `useActiveMacroCommands`, `useReplaceTransferRelations`
  - `npx turbo build --filter=mcs` 빌드 성공 확인

- ✅ **Task 013: 레이아웃 모델러 저장/로드 실제 연동** — 완료
  - React Flow 노드/엣지 JSON → `mcs_layout.json_data` JSONB 저장 (신규/업데이트 분기)
  - 저장 시 `sync-layout-to-db.ts`로 `mcs_equipment`, `mcs_equipment_unit`, `mcs_transfer_relation` 동기화 (경로 탐색 엔진용)
  - 레이아웃 버전 목록: `useLayouts()` 훅으로 실데이터 로드, 하드코딩 더미 제거
  - 버전 선택 → `jsonData`에서 nodes/edges 복원 → 캔버스 교체 (`initialNodes`/`initialEdges` props)
  - 신규 레이아웃 저장 시 이름 입력 Dialog
  - canvas 저장 버그 수정: `useCallback` → `useEffect`로 교체 (저장 함수 미등록 버그 해결)
  - `saveRef` 타입 `() => void` → `() => SaveResult` 변경 (nodes/edges/viewport 반환)

- ✅ **Task 014: A* 경로 탐색 엔진 구현 (Baseline)** — 완료
  - `apps/mcs/lib/engine/astar.ts`: MinHeap 기반 A* 순수 함수 (h=0, Dijkstra-equivalent)
  - `apps/mcs/lib/engine/graph-loader.ts`: Supabase에서 `mcs_transfer_relation` + `mcs_equipment_unit` 로드
  - `apps/mcs/app/api/astar/route.ts`: `POST /api/astar` Route Handler (그래프 로드 → A* 실행 → 결과 반환)
  - `syncLayoutToDb` 버그 수정: data.equipmentId 기반 nodeIdToDbId 매핑, Node(경유 노드) Navigation equipment 하위로 저장, relation 삭제 순서 수정 (FK 제약 대응)
  - 반송 제어 페이지 실데이터 연동: 출발/목적 드롭다운 DB 유닛 표시, A* 경로 탐색 결과 실시간 표시
  - Playwright 검증: stk-001-port-1 → proc-001-port-1, 경로 nd-001 경유 20.5m, MicroCommand 2구간 정상 표시

- ✅ **Task 015: FastAPI AI 엔진 서버 구축 (Python)** — 완료
  - `apps/ai-engine/` 전체 구조 생성 (main.py, config.py, routers/, engine/, services/, models/, scripts/)
  - REST API 엔드포인트 구현:
    - `POST /api/inference` — PPO 경로 추론 (모델 미존재 시 A* 폴백, confidence/fallback 반환)
    - `GET /api/health` — 서버 상태, PPO 모델 로딩 여부, Supabase 연결 확인
    - `POST /api/simulation/run` — SimPy 시뮬레이션 시작 → runId 즉시 반환 (BackgroundTasks)
    - `GET /api/simulation/status/{id}` — 진행률 폴링 (인메모리 store)
    - `GET /api/simulation/result/{id}` — 결과 조회 (7개 지표 + comparison + distributions)
  - `engine/route_env.py`: Gymnasium McsRouteEnv (4*MAX_NODES observation, Discrete action)
  - `engine/ppo_agent.py`: SB3 PPO 싱글턴 (모델 미존재 시 A* 폴백 자동 전환)
  - `engine/simulation.py`: SimPy 이산 이벤트 시뮬레이션 (A* vs PPO 동시 실행, 7개 지표 수집)
  - `services/graph_loader.py`: Supabase → NetworkX DiGraph (TS graph-loader.ts 포팅)
  - `scripts/train.py`: 오프라인 PPO 학습 스크립트 (`--layout-id`, `--total-steps` 인자)

- ✅ **Task 016: AI PPO 경로 추론 + 시뮬레이션 프론트엔드 연동** — 완료
  - `lib/api/ai-engine.ts`: FastAPI 클라이언트 래퍼 (inferRoute, runSimulation, useSimulationStatus, useSimulationResult)
  - `lib/api/simulation-runs.ts`: Supabase 실행 이력 조회 훅
  - 반송 제어 페이지: A* + AI 병렬 호출, `fallback` 시 토스트 안내
  - 시뮬레이션 페이지: 가짜 interval 제거 → FastAPI run + 1.5초 폴링
  - 시뮬레이션 결과 페이지: `?runId=` 쿼리 파라미터 기반 실데이터 조회
  - 더미 `simulation.ts` 삭제 (ComparisonTable, TransferTimeChart, UtilizationChart, RunHistoryTable 모두 실데이터)
  - `packages/types/src/mcs.ts`: AiRouteStep, SimulationResult 3필드 추가, 응답 타입 신규
  - `packages/types/src/constants.ts`: SIMULATION_STATUSES.PENDING 추가

- ✅ **Task 017: SimPy 시뮬레이션 엔진 구현 + 결과 연동** — 완료 (Task 015·016에 흡수)
  - `apps/ai-engine/engine/simulation.py`: SimPy 이산 이벤트 시뮬레이션 (A* vs PPO 동시 실행)
  - `_generate_transfer_requests()`: 캐리어 수 / 반송 요청 수 / 시뮬레이션 시간 파라미터 기반 가상 반송 요청 자동 생성
  - 7개 성과 지표 수집: avg_transfer_time, throughput, collision_count, load_balance_std, equipment_utilization, deadlock_count, route_efficiency_score
  - Supabase `mcs_simulation_run` / `mcs_simulation_result` 테이블 저장 (Task 015 `/api/simulation/run` 백그라운드 작업)
  - 시뮬레이션 결과 페이지 실데이터 바인딩 + CSV 내보내기는 Task 016에서 완료 (`apps/mcs/app/(app)/simulation/result/page.tsx`, `csv-export-button.tsx`)

- ✅ **Task 018: Phase 3 통합 테스트** — 완료
  - `/api/health`, `/api/inference`, `/api/simulation/run|status|result` curl 기반 API 검증 완료
  - AI 추론 버그 수정: `sourceUnitId`(라벨) → 그래프 UUID 변환 누락 (`routers/inference.py` label_to_uuid 역매핑 추가)
  - stk-001-port-1 → proc-001-port-1: A* 폴백 경로 20.5m, fallback:true, confidence:0.0 확인
  - 시뮬레이션 run→status(Completed)→result 전체 흐름 확인 (7개 지표, deadlock 0/0→0% 버그 수정 재검증)
  - 실행 이력 "결과 보기" 링크 버그 수정, CSV 내보내기 정상 동작 확인
  - CORS localhost:3001 허용 확인, 더미 데이터 import 0건 확인, TypeScript `tsc --noEmit` 통과
  - `docs/phase3-integration-test-report.md` 작성 완료

- ✅ **Task 019: AMR 업계 표준 용어 통일 — Waypoint → Node 전면 변경 + 시뮬레이션 S/D Port 제한** — 완료
  - **용어 변경**: "Waypoint" → "Node" (AMR 경로망 경유 노드, 업계 표준 용어). DB `unit_type: 'Waypoint'` → `'Node'`
  - DB 마이그레이션 SQL 작성 (`docs/migrations/001-waypoint-to-node.sql`): Supabase SQL Editor에서 수동 실행 필요
  - `packages/types/src/constants.ts`: `UNIT_TYPES.NODE = 'Node'` 추가
  - `components/layout-modeler/types.ts`: `WaypointNodeData` → `PathNodeData`, `waypointId` → `nodeId`, `PathNode = RFNode<..., 'node'>`, `LegacyWaypointData` 하위 호환 타입 유지
  - `nodes/path-node.tsx` 신규 (구 `waypoint-node.tsx` 대체), 동일 다이아몬드(◆) 컴포넌트
  - `layout-modeler-canvas.tsx`: `NODE_TYPES` `node:PathNode` 등록, 드롭 ID prefix `ND-`, JSONB 구버전 호환 마이그레이션 레이어 추가
  - `symbol-palette.tsx`, `properties-panel.tsx`, `dashboard/layout-viewer.tsx`: 라벨·범례 "Node"/"노드" 통일
  - `lib/api/sync-layout-to-db.ts`: `pathNodes` 변수명, `unit_type: 'Node'`
  - `lib/dummy/layout.ts`: `ND-001~003` ID, `type: 'node'`, `nodeId` 필드로 전환
  - **Part 2 — 시뮬레이션 S/D Port 제한**: `engine/simulation.py`에 `_port_node_list` 추가, `random.sample` 대상을 Port 노드만으로 제한 (Node는 경유점 전용)
  - `routers/simulation.py`: 더미 장비 가동률 라벨 `"Waypoint-1"` → `"Node-1"`

---

### Phase 4: 실시간 모니터링 + RTD 연동 + 배포

- ✅ **Task 020: 실시간 물류 모니터링 연동 (Supabase Realtime)** — 완료
  - `docs/migrations/002-enable-realtime-monitoring.sql`: mcs_equipment/mcs_carrier/mcs_equipment_unit Realtime publication 활성화 (중복 실행 안전 가드 포함)
  - `apps/mcs/lib/api/layout-monitor.ts`: `useLayoutMonitor(layoutId)` 훅 — Supabase `postgres_changes` 구독, TanStack Query 캐시 직접 업데이트, 자동 재연결
  - `apps/mcs/lib/monitor/state-colors.ts`: 장비 상태 색상/라벨 유틸 (3곳 중복 제거)
  - `apps/mcs/lib/monitor/carrier-position.ts`: `getCarrierRFPosition()` — Task 021 framer-motion 재사용 가능 순수 함수
  - 대시보드 React Flow 뷰어 실데이터 바인딩: equipment state 실시간 오버레이, CarrierNode RF 등록 (currentEquipmentId 기준 스냅 위치)
  - 우상단 연결 상태 배지: 초록(구독중) / 노랑(연결중) / 빨강(오류)
  - Floor 탭 → Layout 선택 드롭다운으로 대체 (designName + version 표시, 실DB 목록)
  - StatsCards: DUMMY_EQUIPMENTS/DUMMY_CARRIERS 제거 → useEquipmentsByLayout/useCarriers 실데이터
  - CommandPanel: DUMMY_MACRO_COMMANDS/DUMMY_MICRO_COMMANDS 제거 → useActiveMacroCommands/useMicroCommandsByMacro 실데이터
  - CarrierNode state enum: Idle/Moving → Installed/Transferring/Stored (DB 기준 통일)
  - ProcessGroupNode / StockerGroupNode: 인라인 상태 스타일 → state-colors.ts 유틸 사용
  - `lib/dummy/carriers.ts`, `lib/dummy/equipment.ts` 삭제 (dashboard에서 완전 제거 확인)
  - `npx turbo build --filter=mcs` TypeScript 빌드 성공 확인

- **Task 021: AMR 자연 이동 (스키마 + ACS + 대시보드 애니메이션)** ✅
  - Phase A — DB 스키마 확장 (`docs/migrations/003-carrier-location.sql`): `mcs_carrier.location_id` (가시성 기준: null=숨김, non-null=표시), `mcs_equipment.location_id` (AMR path 노드), `mcs_micro_command.executor_equipment_id` (실행 AMR), packages/types 및 API 레이어 동기화
  - Phase B — ACS 모듈 (`apps/mcs/lib/acs/`): `useLayout()` React Query 공유 소비 → BFS path planning, SEMI E82 축소판 vehicle state machine (Idle→Assigned→MovingEmpty→Acquiring→Loaded→MovingLoaded→Depositing), `useAcsTickLoop()` 훅 (100ms + localStorage leader lock 멀티탭 방지), 시나리오 seeder, `/acs` 상태 패널 페이지
  - Phase C — MCS 대시보드 애니메이션: `framer-motion@^11` 설치, `useLayoutMonitor` 에 equipment/carrier `location_id` hopEvents 큐 추가 (REPLICA IDENTITY FULL payload.old 활용), `useCarrierAnimations` 훅 (RF Node.position 보간, 거리 비례 300~1500ms), AMR 위 캐리어 parent-child 오프셋 렌더, `location_id=null` 캐리어 숨김, `onInit` 배선
  - **Scope out (후속)**: OHT/Stocker 크레인 Pick/Place 내부 모션, equipment 내부 drill-down 뷰, edge smooth-step path 샘플링, ACS server-side 이관, SEMI 완전 시나리오(Task 022)

- **Task 022: RTD-MCS 통합 인터페이스 구현**
  - RTD 디스패칭 결과 수신 → MacroCommand 자동 생성 API 엔드포인트
  - MCS 반송 완료 이벤트 → RTD 트리거 REST API 전송
  - 반송 제어 페이지 RTD 연동 상태 표시 + 수동 트리거 버튼 실데이터 연동
  - 단독 실행 시 F009 인터페이스 비활성 처리 (환경 변수 `NEXT_PUBLIC_RTD_ENABLED` 기반)

- **Task 023: 성능 최적화 + Vercel 배포 + CI/CD 구성**
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
| Phase 1: 애플리케이션 골격 구축 | ✅ 완료 | 3 | 3/3 |
| Phase 2: UI/UX 완성 (더미 데이터) | ✅ 완료 | 7 | 7/7 |
| Phase 3: 핵심 기능 구현 | ✅ 완료 | 9 | 9/9 |
| Phase 4: 실시간 모니터링 + 배포 | 진행 중 | 4 | 2/4 |
| **합계** | | **23** | **21/23** |
