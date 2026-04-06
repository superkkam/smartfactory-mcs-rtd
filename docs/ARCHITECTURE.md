# MCS-RTD 통합 플랫폼 소프트웨어 아키텍처

> 이 문서는 prd-common.md, prd-mcs.md, prd-rtd.md 및 ROADMAP_MCS.md, ROADMAP_RTD.md를 기반으로 전체 시스템 아키텍처를 정의합니다.

---

## 1. 시스템 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              사용자 (브라우저)                                │
│         MCS 연구원 · 현장 엔지니어 · RTD 공정 엔지니어                         │
└───────────┬─────────────────────────────────┬───────────────────────────────┘
            │ HTTPS                            │ HTTPS
            ▼                                  ▼
┌───────────────────────┐          ┌───────────────────────┐
│   apps/mcs (Vercel)   │          │   apps/rtd (Vercel)   │
│   Next.js 15 App      │◄────────►│   Next.js 15 App      │
│   Router              │ REST API │   Router              │
│                       │ (F009/   │                       │
│  • 레이아웃 모델러     │  F010)   │  • 노코드 룰 빌더     │
│  • 반송 제어          │          │  • 룰 시뮬레이터      │
│  • 시뮬레이션         │          │  • 룰 실행 모니터링   │
│  • 실시간 모니터링    │          │  • 실행 통계          │
└─────┬─────┬───────────┘          └─────┬──────────────────┘
      │     │                            │
      │     │ REST API                   │ REST API
      │     ▼                            ▼
      │  ┌──────────────────┐   ┌──────────────────────┐
      │  │  apps/ai-engine  │   │  기존 Java/Spring     │
      │  │  FastAPI (Python)│   │  백엔드 서버           │
      │  │                  │   │                       │
      │  │ • PPO 추론       │   │ • DMS 룰 실행 엔진    │
      │  │ • SimPy 시뮬     │   │ • CRUD REST API       │
      │  │ • NetworkX 그래프│   │ • WebSocket/SSE Push  │
      │  └──────────────────┘   └───────────┬───────────┘
      │                                     │
      │  Supabase SDK                       │ JDBC
      ▼                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase (BaaS)                        │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │   Auth   │  │  PostgreSQL  │  │   Realtime (옵션)     │ │
│  │          │  │              │  │                       │ │
│  │ • 회원가 │  │ • MCS 테이블 │  │ • DB 변경 구독        │ │
│  │   입/로그│  │ • RTD 테이블 │  │                       │ │
│  │   인     │  │   (DMS_*)   │  │                       │ │
│  └──────────┘  └──────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Turborepo 모노레포 디렉토리 구조

```
project-root/
│
├── apps/
│   ├── mcs/                          # MCS 모듈 — Next.js 15 독립 앱
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── (app)/
│   │   │   │   ├── dashboard/page.tsx        # F007, F008
│   │   │   │   ├── layout-modeler/page.tsx   # F001
│   │   │   │   ├── transfer-control/page.tsx # F002, F003, F004, F009
│   │   │   │   ├── simulation/
│   │   │   │   │   ├── page.tsx              # F005
│   │   │   │   │   ├── result/page.tsx       # F006
│   │   │   │   │   └── settings/page.tsx     # F005 보조
│   │   │   │   └── layout.tsx
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── modeler/                # 레이아웃 모델러 전용
│   │   │   │   ├── SymbolPalette.tsx
│   │   │   │   ├── ModelerCanvas.tsx
│   │   │   │   ├── PropertyPanel.tsx
│   │   │   │   ├── RouteContextMenu.tsx
│   │   │   │   └── nodes/             # React Flow 커스텀 노드
│   │   │   │       ├── StockerNode.tsx
│   │   │   │       ├── ConveyorNode.tsx
│   │   │   │       ├── PortNode.tsx
│   │   │   │       ├── AGVNode.tsx
│   │   │   │       └── TransferEdge.tsx
│   │   │   ├── monitoring/            # 실시간 모니터링 전용
│   │   │   │   ├── LayoutViewer.tsx
│   │   │   │   ├── CarrierAnimation.tsx
│   │   │   │   └── EquipmentOverlay.tsx
│   │   │   ├── transfer/              # 반송 제어 전용
│   │   │   └── simulation/            # 시뮬레이션 전용
│   │   ├── lib/
│   │   │   ├── api/                   # Supabase + FastAPI 클라이언트
│   │   │   ├── hooks/                 # 커스텀 훅
│   │   │   ├── store/                 # Zustand 스토어 (레이아웃 편집)
│   │   │   ├── algorithms/            # A* 경로 탐색 로직
│   │   │   └── dummy/                 # 더미 데이터
│   │   └── next.config.ts
│   │
│   ├── rtd/                          # RTD 모듈 — Next.js 15 독립 앱
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── (app)/
│   │   │   │   ├── dashboard/page.tsx          # F008, F009
│   │   │   │   ├── rule-groups/page.tsx        # F001, F002
│   │   │   │   ├── rule-builder/
│   │   │   │   │   └── [groupId]/page.tsx      # F003, F004, F005, F006
│   │   │   │   ├── simulator/
│   │   │   │   │   └── [groupId]/page.tsx      # F007
│   │   │   │   ├── monitoring/page.tsx         # F008, F009, F010
│   │   │   │   └── layout.tsx
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── rule-builder/          # 룰 플로우 빌더 전용
│   │   │   │   ├── FlowCanvas.tsx
│   │   │   │   ├── SequenceBlock.tsx
│   │   │   │   ├── QueryBuilderModal.tsx
│   │   │   │   ├── SortEditorModal.tsx
│   │   │   │   └── ParamEditorModal.tsx
│   │   │   ├── rule-groups/           # 룰 그룹 관리 전용
│   │   │   └── monitoring/            # 모니터링 전용
│   │   ├── lib/
│   │   │   ├── api/                   # Java/Spring REST API 클라이언트
│   │   │   ├── hooks/                 # TanStack Query 훅
│   │   │   ├── sql-generator/         # SQL 자동 생성 엔진
│   │   │   └── dummy/                 # 더미 데이터
│   │   └── next.config.ts
│   │
│   └── ai-engine/                    # AI 엔진 — Python FastAPI
│       ├── main.py                    # FastAPI 앱 진입점
│       ├── routers/
│       │   ├── inference.py           # POST /api/inference
│       │   └── simulation.py          # POST /api/simulation/run
│       ├── models/
│       │   └── ppo_agent.py           # Stable-Baselines3 PPO 래퍼
│       ├── core/
│       │   ├── graph.py               # NetworkX 그래프 변환
│       │   └── simulator.py           # SimPy 시뮬레이션 엔진
│       └── requirements.txt
│
├── packages/
│   ├── ui/                           # 공통 UI 컴포넌트
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   └── package.json
│   │
│   ├── auth/                         # 공통 Supabase Auth 모듈
│   │   ├── src/
│   │   │   ├── client.ts              # Supabase 클라이언트 생성
│   │   │   ├── middleware.ts           # 인증 미들웨어 헬퍼
│   │   │   └── hooks.ts               # useUser, useSession 등
│   │   └── package.json
│   │
│   └── types/                        # 공통 TypeScript 타입
│       ├── src/
│       │   ├── common.ts              # User, ApiResponse, PaginatedResponse
│       │   ├── mcs.ts                 # Layout, Equipment, EquipmentUnit, TransferRelation, ...
│       │   ├── rtd.ts                 # RuleGroup, RuleObject, RuleRelation, RuleDef, ...
│       │   └── index.ts
│       └── package.json
│
├── turbo.json
├── package.json
├── .env.example
└── CLAUDE.md
```

---

## 3. 모듈별 상세 아키텍처

### 3.1 MCS 모듈 내부 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/mcs (Next.js 15)                    │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Pages      │  │  Components  │  │  State Management      │ │
│  │  (App       │  │              │  │                        │ │
│  │   Router)   │  │  Modeler/    │  │  Zustand Store         │ │
│  │             │  │  Monitoring/ │  │  ├─ nodes[]            │ │
│  │ /dashboard  │──│  Transfer/   │──│  ├─ edges[]            │ │
│  │ /modeler    │  │  Simulation/ │  │  ├─ undoStack[]        │ │
│  │ /transfer   │  │              │  │  └─ selectedNode       │ │
│  │ /simulation │  │  SVG Symbols │  │                        │ │
│  │ /sim/result │  │  (커스텀노드)│  │  TanStack Query        │ │
│  └─────────────┘  └──────────────┘  │  (서버 상태 캐싱)      │ │
│                                     └────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Lib Layer                           │  │
│  │                                                          │  │
│  │  api/            hooks/           algorithms/            │  │
│  │  ├─ supabase.ts  ├─ useLayout()   ├─ astar.ts           │  │
│  │  ├─ ai-engine.ts ├─ useMonitor()  └─ graph-utils.ts     │  │
│  │  └─ types.ts     └─ useTransfer()                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────┬──────────────────┬──────────────────┬─────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
  │   Supabase   │  │   FastAPI    │  │   WebSocket      │
  │   (Auth+DB)  │  │   AI Engine  │  │   Server         │
  │              │  │              │  │                  │
  │ • Layout     │  │ • PPO 추론   │  │ • 장비 상태      │
  │ • Equipment  │  │ • SimPy 시뮬 │  │ • 캐리어 이동    │
  │ • Carrier    │  │ • NetworkX   │  │                  │
  │ • Command   │  │   그래프     │  │                  │
  └──────────────┘  └──────────────┘  └──────────────────┘
```

### 3.2 RTD 모듈 내부 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/rtd (Next.js 15)                    │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Pages      │  │  Components  │  │  State Management      │ │
│  │  (App       │  │              │  │                        │ │
│  │   Router)   │  │  RuleBuilder/│  │  TanStack Query 5.x   │ │
│  │             │  │  RuleGroups/ │  │  (서버 상태 관리)       │ │
│  │ /dashboard  │──│  Monitoring/ │──│                        │ │
│  │ /rule-groups│  │              │  │  React Flow 내부 상태  │ │
│  │ /rule-builder│ │  FlowCanvas  │  │  (useNodesState,       │ │
│  │ /simulator  │  │  QueryModal  │  │   useEdgesState)       │ │
│  │ /monitoring │  │  SortModal   │  │                        │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Lib Layer                           │  │
│  │                                                          │  │
│  │  api/              hooks/           sql-generator/       │  │
│  │  ├─ java-client.ts ├─ useRuleGroup() ├─ builder.ts      │  │
│  │  ├─ supabase.ts    ├─ useRuleFlow()  ├─ conditions.ts   │  │
│  │  └─ types.ts       └─ useRunLog()    └─ preview.ts      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────┬──────────────────┬──────────────────┬─────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │   Supabase   │  │ Java/Spring      │  │  WebSocket/SSE   │
  │   (Auth)     │  │ 백엔드           │  │  (Java 백엔드)   │
  │              │  │                  │  │                  │
  │ • 인증만     │  │ • DMS CRUD API   │  │ • 룰 실행 로그   │
  │              │  │ • 룰 실행 엔진   │  │   실시간 Push    │
  │              │  │ • dry-run 모드   │  │                  │
  └──────────────┘  └──────────────────┘  └──────────────────┘
```

---

## 4. 데이터 흐름도

### 4.1 MCS: 레이아웃 모델링 → 경로 탐색 → 시뮬레이션

```
[레이아웃 모델러]                     [반송 제어]                    [시뮬레이션]
      │                                   │                              │
      ▼                                   │                              │
 SymbolPalette                            │                              │
 → 드래그앤드롭                           │                              │
 → React Flow 캔버스                      │                              │
      │                                   │                              │
      ▼                                   │                              │
 기준정보 입력                            │                              │
 (EQUIPMENT_ID,                           │                              │
  EQUIPMENT_UNIT_ID,                      │                              │
  EC_SERVER_NAME)                         │                              │
      │                                   │                              │
      ▼                                   │                              │
 AGV 경로 생성                            │                              │
 (Port→Port 드래그                        │                              │
  또는 일괄 생성)                          │                              │
      │                                   │                              │
      ▼                                   │                              │
 JSON 저장 ──────────────────────────────►│                              │
 (Layout.json_data)                       │                              │
      │                                   ▼                              │
      │                          출발/목적지 선택                         │
      │                          → MacroCommand 생성                     │
      │                          → MicroCommand 분해                     │
      │                                   │                              │
      │                          ┌────────┴────────┐                     │
      │                          ▼                  ▼                    │
      │                    A* 경로 탐색      PPO AI 추론                 │
      │                    (Next.js)         (FastAPI)                   │
      │                          │                  │                    │
      │                          ▼                  ▼                    │
      │                    RouteFindingResult 저장                       │
      │                    A* vs AI 비교 뷰 표시                         │
      │                                                                  │
      │                                                          시나리오 설정
      │                                                          → SimPy 실행
      │                                                          → A* vs AI
      │                                                            동시 비교
      │                                                                  │
      │                                                                  ▼
      │                                                          SimulationResult
      │                                                          → 성과 지표 비교
      │                                                          → CSV 내보내기
      │
      ▼
 [대시보드 모니터링]
 ← Layout JSON 로드 (읽기 전용)
 ← WebSocket: 장비 상태, 캐리어 이동
 → framer-motion 애니메이션 렌더링
```

### 4.2 RTD: 룰 생성 → 시뮬레이션 → 모니터링

```
[룰 그룹 관리]              [룰 플로우 빌더]             [시뮬레이터]
      │                           │                          │
      ▼                           │                          │
 RuleGroup CRUD                   │                          │
 (트리 구조,                      │                          │
  Fallback 계층)                  │                          │
      │                           │                          │
      ▼                           │                          │
 RuleObject 매핑                  │                          │
 (장비+이벤트                     │                          │
  → 룰그룹 연결)                  │                          │
      │                           │                          │
      └──► 룰그룹 선택 ──────────►│                          │
                                  ▼                          │
                          React Flow 캔버스                   │
                          시퀀스 블록 편집                     │
                          (Data/Filter/Sort/...)              │
                                  │                          │
                          ┌───────┼───────┐                  │
                          ▼       ▼       ▼                  │
                       쿼리    정렬     파라미터               │
                       빌더    편집기   편집기                 │
                       모달    모달     모달                   │
                          │       │       │                  │
                          ▼       ▼       ▼                  │
                    RuleQuery  RuleSort  RuleQueryParam       │
                    (SQL 자동   저장      저장                 │
                     생성)                                    │
                          │                                  │
                          └──────────► 저장 완료 ────────────►│
                                                             ▼
                                                     Java 백엔드
                                                     dry-run 실행
                                                             │
                                                             ▼
                                                     시퀀스별 결과
                                                     건수 표시
                                                             │
                                                     ┌───────┴───────┐
                                                     ▼               ▼
                                               검증 성공         검증 실패
                                               → 즉시 적용       → 빌더 수정
                                                     │
                                                     ▼
                                             [모니터링 대시보드]
                                             ← WebSocket/SSE
                                             ← RuleRunningResult
                                             → 실시간 로그 표시
                                             → 통계 차트 렌더링
```

### 4.3 MCS ↔ RTD 통합 연동 흐름

```
┌──────────────────┐                              ┌──────────────────┐
│    RTD 모듈      │                              │    MCS 모듈      │
│                  │                              │                  │
│  룰 실행 엔진    │                              │  반송 제어       │
│  (디스패칭 결과  │  ──── REST API ──────────►   │                  │
│   생성)          │  POST /api/mcs/dispatch      │  MacroCommand    │
│                  │  {lotId, destEquipment,       │  자동 생성       │
│  RTD F010       │   priority}                   │  MCS F009       │
│                  │                              │                  │
│                  │                              │  반송 완료       │
│  다음 디스패칭   │  ◄──── REST API ──────────   │  이벤트 발생     │
│  트리거          │  POST /api/rtd/complete       │                  │
│                  │  {commandId, result}          │                  │
└──────────────────┘                              └──────────────────┘

※ 단독 실행 시: 양쪽 REST API 호출 비활성 (환경 변수 기반)
   MCS 단독: MacroCommand 수동 생성 또는 시뮬레이션 자동 생성
   RTD 단독: 시뮬레이터(F007)로 룰 검증, MCS 연동 없이 독립 운영
```

---

## 5. 데이터베이스 스키마 관계도

### 5.1 MCS 데이터 모델 (Supabase PostgreSQL)

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Layout    │     │   Equipment      │     │  EquipmentUnit   │
├─────────────┤     ├──────────────────┤     ├──────────────────┤
│ id (PK)     │     │ id (PK)          │     │ id (PK)          │
│ design_id   │     │ equipment_id     │◄────│ equipment_id(FK) │
│ design_name │     │ equipment_type   │     │ equipment_unit_id│
│ version     │     │ ec_server_name   │     │ unit_type        │
│ json_data   │     │ inline_stocker   │     │ in_out_mode      │
│ site_id     │     │ state            │     │ transfer_state   │
│ created_at  │     └──────────────────┘     └────────┬─────────┘
└─────────────┘                                       │
                                                      │
                    ┌─────────────────────────────────┼─────────────────┐
                    │                                 │                 │
                    ▼                                 ▼                 ▼
          ┌──────────────────┐              ┌────────────────┐  ┌──────────────┐
          │ TransferRelation │              │  MacroCommand  │  │   Carrier    │
          ├──────────────────┤              ├────────────────┤  ├──────────────┤
          │ id (PK)          │              │ id (PK)        │  │ id (PK)      │
          │ departure_unit_id│◄─ FK ────────│ source_unit_id │  │ carrier_id   │
          │ arrival_unit_id  │◄─ FK ────────│ dest_unit_id   │  │ carrier_type │
          │ transport_eq_id  │              │ carrier_id(FK) │──│ material_type│
          │ weight           │              │ command_id     │  │ current_eq_id│
          └──────────────────┘              │ state          │  │ state        │
                                            │ priority       │  └──────────────┘
                                            └───────┬────────┘
                                                    │ 1:N
                                                    ▼
                                  ┌──────────────────────────────┐
                                  │       MicroCommand           │
                                  ├──────────────────────────────┤
                                  │ id (PK)                      │
                                  │ macro_command_id (FK)         │
                                  │ sequence                     │
                                  │ departure_unit_id            │
                                  │ arrival_unit_id              │
                                  │ state                        │
                                  └──────────────────────────────┘

          ┌──────────────────┐              ┌──────────────────┐
          │RouteFindingResult│              │  SimulationRun   │
          ├──────────────────┤              ├──────────────────┤
          │ id (PK)          │              │ id (PK)          │
          │ macro_command_id │              │ scenario_params  │
          │ algorithm        │              │ algorithms       │
          │ route            │              │ status           │
          │ total_cost       │              │ created_at       │
          └──────────────────┘              └────────┬─────────┘
                                                     │ 1:N
                                                     ▼
                                          ┌──────────────────────┐
                                          │  SimulationResult    │
                                          ├──────────────────────┤
                                          │ id (PK)              │
                                          │ simulation_run_id(FK)│
                                          │ algorithm            │
                                          │ avg_transfer_time    │
                                          │ throughput           │
                                          │ collision_count      │
                                          │ load_balance_std     │
                                          └──────────────────────┘
```

### 5.2 RTD 데이터 모델 (기존 Java/Spring DB)

```
┌──────────────────┐
│  RuleGroup       │
│  (DMS_RULE_      │
│   GROUP_DEF)     │
├──────────────────┤
│ ruleGroupId (PK) │◄──────────────────────────────────┐
│ ruleGroupName    │                                    │
│ ruleGroupType    │                                    │
│ isUsable         │                                    │
│ description      │                                    │
└────────┬─────────┘                                    │
         │ 1:N                                          │
         ▼                                              │
┌──────────────────┐     ┌──────────────────┐           │
│  RuleObject      │     │  RuleRelation    │           │
│  (DMS_RULE_      │     │  (DMS_RULE_      │           │
│   OBJECT)        │     │   RELATION)      │           │
├──────────────────┤     ├──────────────────┤           │
│ ruleObjectId(PK) │     │ ruleGroupId(PK)  │───────────┘
│ ruleEventId (PK) │     │ ruleId (PK)      │───► RuleDef
│ ruleGroupId (FK) │─────│ sequence (PK)    │
│ siteId (PK)      │     │ isMandatory      │
│ isUsable         │     │ filterSequence   │
└──────────────────┘     │ jumpNextSequence │
                         │ jumpNextSeqCond  │
                         │ ruleSortId (FK)  │───► RuleSort
                         └──────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  RuleDef         │     │  RuleClass       │     │  RuleQuery       │
│  (DMS_RULE_DEF)  │     │  (DMS_RULE_CLASS)│     │  (DMS_RULE_QUERY)│
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ ruleId (PK)      │     │ ruleClassId (PK) │     │ ruleQueryId (PK) │
│ ruleName         │     │ ruleClassName    │     │ ruleQueryVer(PK) │
│ ruleClassId (FK) │────►│ ruleClassType    │     │ ruleQueryString  │
│ ruleType         │     └──────────────────┘     │ ruleQueryType    │
│ ruleCondition    │                              └────────┬─────────┘
└──────────────────┘                                       │ 1:N
                                                           ▼
┌──────────────────┐     ┌──────────────────────────────────────────┐
│  RuleSort        │     │  RuleQueryParam (DMS_RULE_QUERY_PARAM)  │
│  (DMS_RULE_SORT) │     ├──────────────────────────────────────────┤
├──────────────────┤     │ ruleQueryId (PK, FK)                    │
│ ruleSortId (PK)  │     │ ruleQueryVersion (PK, FK)               │
│ sortColumn       │     │ paramKey (PK)                           │
│ weightValue      │     │ paramValue                              │
│ fromPercent      │     │ targetColumn                            │
│ toPercent        │     └──────────────────────────────────────────┘
│ orderBy          │
└──────────────────┘     ┌──────────────────────────────────────────┐
                         │  RuleRunningResult (DMS_RULE_RUNNING_*)  │
                         ├──────────────────────────────────────────┤
                         │ uuid (PK)                                │
                         │ lotId                                    │
                         │ ruleId (FK → RuleDef)                    │
                         │ sequence                                 │
                         │ count                                    │
                         │ startTime / endTime                      │
                         │ isDispatching                            │
                         └──────────────────────────────────────────┘
```

---

## 6. 기술 스택 총괄

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           프론트엔드 (공통)                               │
│                                                                          │
│  Next.js 15 (App Router) · React 19 · TypeScript 5.6+                   │
│  TailwindCSS v4 · shadcn/ui · Lucide React                              │
│  React Hook Form 7.x · Zod                                              │
└────────────┬─────────────────────────────────┬───────────────────────────┘
             │                                 │
┌────────────┴──────────────┐    ┌─────────────┴─────────────────┐
│     MCS 전용 스택          │    │     RTD 전용 스택              │
│                            │    │                               │
│  React Flow 12.x          │    │  React Flow 12.x              │
│  Zustand (Undo/Redo)      │    │  TanStack Query 5.x           │
│  framer-motion             │    │                               │
│  SVG React 심볼 컴포넌트   │    │                               │
│  Recharts                  │    │  Recharts                     │
│  WebSocket                 │    │  WebSocket / SSE              │
└────────────────────────────┘    └───────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                              백엔드                                      │
│                                                                          │
│  ┌─────────────────────┐  ┌─────────────────────────────────────┐       │
│  │  Supabase (BaaS)    │  │  기존 Java/Spring 백엔드 (RTD용)    │       │
│  │  • Auth             │  │  • DMS 엔티티 CRUD REST API         │       │
│  │  • PostgreSQL       │  │  • 룰 실행 엔진 (dry-run)           │       │
│  │  • Realtime (옵션)  │  │  • WebSocket/SSE Push              │       │
│  └─────────────────────┘  └─────────────────────────────────────┘       │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │  AI 엔진 (MCS 전용 — Python 서비스)                         │        │
│  │  Python 3.12+ · FastAPI · PyTorch 2.x                       │        │
│  │  Stable-Baselines3 (PPO) · NetworkX · SimPy                 │        │
│  └─────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                            인프라 & 배포                                  │
│                                                                          │
│  Turborepo (모노레포 빌드) · npm (패키지 관리)                            │
│  Vercel (Next.js 배포) · Railway/Fly.io (FastAPI 배포)                   │
│  GitHub Actions (CI/CD)                                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. 배포 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        GitHub Repository                     │
│                     (Turborepo Monorepo)                      │
└──────────┬──────────────────┬──────────────────┬─────────────┘
           │                  │                  │
     push/PR            push/PR            push/PR
           │                  │                  │
           ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  GitHub Actions  │ │  GitHub Actions  │ │  GitHub Actions  │
│  CI: apps/mcs    │ │  CI: apps/rtd    │ │  CI: ai-engine   │
│  lint+typecheck  │ │  lint+typecheck  │ │  lint+test       │
│  +build+test     │ │  +build+test     │ │                  │
└────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
         │                    │                     │
         ▼                    ▼                     ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   Vercel         │ │   Vercel         │ │ Railway/Fly.io   │
│   (apps/mcs)     │ │   (apps/rtd)     │ │ (apps/ai-engine) │
│                  │ │                  │ │                  │
│  mcs.vercel.app  │ │  rtd.vercel.app  │ │ ai.railway.app   │
└────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
         │                    │                     │
         └────────────┬───────┘                     │
                      │                             │
                      ▼                             │
              ┌──────────────────┐                  │
              │   Supabase       │◄─────────────────┘
              │   (Cloud)        │
              │                  │
              │  Auth + DB       │
              │  (공유 인스턴스)  │
              └──────────────────┘
```

---

## 8. 보안 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      인증 흐름 (FC001)                       │
│                                                              │
│  브라우저 ──► Next.js Middleware ──► Supabase Auth           │
│                    │                     │                    │
│              비인증 → /login       JWT 검증                   │
│              인증됨 → 요청 진행    세션 쿠키 발급             │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  @supabase/ssr                                      │    │
│  │  • 서버사이드 쿠키 기반 세션 관리                     │    │
│  │  • Next.js Middleware에서 자동 세션 갱신              │    │
│  │  • Route Group: (auth) = 공개, (app) = 보호          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    API 보안 레이어                            │
│                                                              │
│  • Supabase RLS (Row Level Security) — DB 접근 제어         │
│  • Next.js Server Actions — 서버사이드에서만 민감 로직 실행  │
│  • 환경 변수 분리 — SUPABASE_SERVICE_ROLE_KEY 서버 전용     │
│  • CORS 설정 — FastAPI AI 엔진 허용 Origin 제한             │
└─────────────────────────────────────────────────────────────┘
```
