# 스마트팩토리 MCS 물류 모델링·AI 경로 최적화 플랫폼 MVP PRD

> **공통 요소 참조**: 인증, User 모델, 공통 기술 스택, 모듈 아키텍처 → [`prd-common.md`](./prd-common.md)
> **독립 실행 가능**: MCS 모듈은 RTD 없이 단독으로 실행할 수 있습니다.
> **자사 솔루션 참조**: THiRA-TB Modeler 분석 → [`노코드_Modeler_솔루션_분석_및_접목_방안.md`](../../docs/output/노코드_Modeler_솔루션_분석_및_접목_방안.md)

---

## 🎯 핵심 정보

**목적**: 공장 물류 레이아웃 모델링·실시간 모니터링과 AI 경로 최적화를 통합하여, 기존 A* 알고리즘 대비 반송 효율 20% 이상 개선하는 MCS 연구 플랫폼 구축
**사용자**: 스마트팩토리 MCS 연구원 및 현장 엔지니어 — 공장 레이아웃을 시각적으로 구성하고, 반송 경로 최적화 알고리즘을 설계·학습·검증하는 사용자

---

## 🔌 모듈 독립 실행

MCS 모듈은 RTD 모듈 없이 독립적으로 실행 가능합니다.

| 실행 모드 | RTD 연동 상태 | 영향받는 기능 |
|----------|-------------|------------|
| **MCS 단독 실행** | 비활성 | F010(RTD-MCS 통합 인터페이스)만 비활성. 나머지 전체 기능 정상 동작 |
| **MCS + RTD 통합 실행** | 활성 | F010 활성화. RTD 디스패칭 결과가 MacroCommand로 자동 생성됨 |

> 단독 실행 시 MacroCommand는 수동으로 직접 생성하거나 시뮬레이션 요청 생성기를 통해 생성합니다.

---

## 🚶 사용자 여정

```
1. 로그인 페이지 (→ prd-common.md FC001)
   ↓ 로그인 성공

2. 대시보드 (홈)
   ↓ 저장된 레이아웃 위에 실시간 캐리어 이동 및 장비 상태 확인

   [레이아웃 모델러 클릭] → 레이아웃 모델러 페이지
   [반송 제어 클릭] → 반송 제어 페이지
   [시뮬레이션 클릭] → 시뮬레이션 페이지
   ↓

3. 레이아웃 모델러 페이지 (공장 기준정보 구성)
   ↓ 심볼 팔레트에서 장비 드래그앤드롭 → 기준정보 입력 → 경로 연결선 설정

   [저장] → 레이아웃 JSON DB 저장 → 대시보드 모니터링에 즉시 반영
   ↓

4. 반송 제어 페이지
   ↓ 매크로 명령 생성 → 마이크로 명령 분해 → 경로 탐색 선택

   [A* 경로 탐색] → 기존 Baseline 경로 산출
   [AI 경로 탐색] → PPO/MAPPO 모델 추론 결과 산출
   ↓

5. 시뮬레이션 페이지
   ↓ 시나리오 설정 → 시뮬레이션 실행

6. 시뮬레이션 결과 페이지
   ↓ A* vs AI 성과 지표 비교 → 결과 내보내기
```

---

## ⚡ 기능 명세

> 인증 기능은 공통(FC001)으로 위임. 아래는 MCS 모듈 전용 기능입니다.

### 1. MVP 핵심 기능

| ID | 기능명 | 설명 | MVP 필수 이유 | 관련 페이지 |
|----|--------|------|-------------|------------|
| **F001** | 공장 레이아웃 모델러 | 심볼 팔레트(Stocker/Conveyor/Port/LHT/AGV 등)에서 드래그앤드롭으로 장비 배치, 기준정보(EQUIPMENT_ID, EQUIPMENT_UNIT_ID, EC_SERVER_NAME) 입력, Port-to-Port 드래그로 AGV 경로 개별 생성, 복수 포트 선택 → 우클릭 컨텍스트 메뉴로 AGV 경로 일괄 생성, 경로 WEIGHT 가중치 설정, JSON 저장/로드/버전관리 | 모든 반송 제어·AI 경로 최적화의 기반 데이터 생성 | 레이아웃 모델러 페이지 |
| **F002** | 반송 명령 생성 및 실행 | MacroCommand(출발→목적지) 생성, MicroCommand(구간별 이동) 분해, 상태 머신 기반 순차 실행 | 연구과제 핵심 요구사항(Macro→Micro) | 반송 제어 페이지 |
| **F003** | A* 기반 경로 탐색 (Baseline) | 레이아웃 모델러에서 정의된 TransferRelation 그래프에서 GCOST/HCOST/FCOST 기반 최단 경로 산출, 성능 기준선 제공 | AI 비교를 위한 Baseline 필수 | 반송 제어 페이지 |
| **F004** | AI 경로 최적화 추론 | 학습된 PPO 모델 기반 실시간 경로 추론, 레이아웃 WEIGHT 및 동적 가중치(장비 상태, 트래픽) 반영. **MVP: PPO(단일 에이전트) 구현. MAPPO(다중 에이전트)는 확장 단계로 제외** | 연구과제 핵심 목표(AI 경로 최적화) | 반송 제어 페이지 |
| **F005** | 시뮬레이션 실행 엔진 | 가상 팩토리 시나리오 기반 반송 요청 자동 생성, A* vs AI 알고리즘 동시 실행 및 비교 | 정량 검증(효율 20% 개선) 필수 | 시뮬레이션 페이지 |
| **F006** | 성과 지표 분석 및 비교 | 반송 시간, 처리량, 충돌 횟수, 부하 균형 지표 자동 산출, A* vs AI 개선율 표시 및 CSV 내보내기 | 연구 결과 정량 검증 필수 | 시뮬레이션 결과 페이지 |

### 2. MVP 필수 지원 기능

| ID | 기능명 | 설명 | MVP 필수 이유 | 관련 페이지 |
|----|--------|------|-------------|------------|
| **F007** | 실시간 물류 모니터링 | 저장된 레이아웃 JSON을 읽기 전용으로 로드하여, 장비 실시간 상태(Online/Offline/Error) 오버레이, 캐리어 위치 및 이동 애니메이션(LHT/Stocker 크레인 Pick→Move→Place) WebSocket 기반 표시, 층별(Floor) 탭 전환 | 반송 현황 직관적 파악 — 레이아웃 기반 시각화는 MCS 고유 영역 | 대시보드 |
| **F008** | 반송 명령 현황 | 진행 중인 MacroCommand/MicroCommand 상태 목록, 알람 표시 | 실시간 제어 상태 파악 | 대시보드 |
| **F009** | RTD-MCS 통합 인터페이스 | RTD 디스패칭 결과 수신 → MacroCommand 자동 생성, MCS 반송 완료 이벤트 → RTD 트리거 REST API. **단독 실행 시 비활성** | RTD-MCS 통합 연구 요구사항 | 반송 제어 페이지 |

### 3. MVP 이후 기능 (제외)

- AI 모델 학습 파이프라인 UI (별도 Python 스크립트로 처리)
- **MAPPO(다중 에이전트 PPO)** 경로 최적화 — MVP에서는 PPO(단일 에이전트)만 구현
- 레이아웃 3D 뷰 (자사 솔루션의 3D_1F/2F/3F 뷰 — 2D 구현 후 확장)
- 멀티사이트(SITE_ID) 지원
- 고가용성(HA) 관리
- 상세 알람 히스토리 관리
- 소셜 로그인

---

## 📱 메뉴 구조

```
📱 MCS 물류 모델링·AI 경로 최적화 플랫폼 내비게이션

🏠 대시보드 (홈)
├── 기능: F007 (실시간 물류 모니터링 — 레이아웃 기반 장비 상태 + 캐리어 애니메이션)
└── 기능: F008 (반송 명령 현황)

🗺️ 레이아웃 모델러
└── 기능: F001 (공장 레이아웃 모델러 — 장비 배치·연결선·기준정보 입력·저장)

🚚 반송 제어
├── 기능: F002 (반송 명령 생성 및 실행)
├── 기능: F003 (A* 기반 경로 탐색)
├── 기능: F004 (AI 경로 최적화 추론)
└── 기능: F009 (RTD-MCS 통합 인터페이스) [통합 실행 시 활성]

🔬 시뮬레이션
└── 기능: F005 (시뮬레이션 실행 엔진)

📊 시뮬레이션 결과
└── 기능: F006 (성과 지표 분석 및 비교)

👤 인증 → prd-common.md 참조 (FC001)
```

---

## 📄 페이지별 상세 기능

### 대시보드 (홈)

> **구현 기능:** `F007`, `F008` | **메뉴 위치:** 홈

| 항목 | 내용 |
|------|------|
| **역할** | 저장된 공장 레이아웃 위에 실시간 물류 현황을 시각화하는 메인 모니터링 화면 |
| **진입 경로** | 로그인 성공 후 자동 리디렉션, 또는 헤더 홈 클릭 |
| **사용자 행동** | 레이아웃 위에서 장비 상태 및 캐리어 이동 실시간 확인, 진행 중인 반송 명령 목록 조회, 알람 확인 |
| **주요 기능** | • 저장된 레이아웃 JSON 로드 → 읽기 전용 2D 뷰어 (React Flow) (F007)<br>• 장비 상태 실시간 오버레이: Online(초록)/Offline(회색)/Error(빨강) 색상 표시 (WebSocket) (F007)<br>• 캐리어 이동 애니메이션: LHT 크레인 Pick→X축 이동→Place, Stocker 크레인 이동 (F007)<br>• 층별(Floor) 탭 전환 (1F/2F/3F 등) (F007)<br>• 진행 중인 MacroCommand/MicroCommand 상태 목록 (F008)<br>• 알람/이상 상황 배지 표시 (F008)<br>• **레이아웃 편집** 버튼, **반송 제어** 버튼, **시뮬레이션** 버튼 |
| **다음 이동** | 레이아웃 편집 → 레이아웃 모델러 페이지, 반송 제어 → 반송 제어 페이지, 시뮬레이션 → 시뮬레이션 페이지 |

---

---

### 레이아웃 모델러 페이지

> **구현 기능:** `F001` | **인증:** 로그인 필요

| 항목 | 내용 |
|------|------|
| **역할** | 공장 물류 레이아웃을 시각적으로 구성하고 기준정보를 입력하는 편집 화면 |
| **진입 경로** | 대시보드 "레이아웃 편집" 버튼 클릭, 또는 사이드바 "레이아웃 모델러" 메뉴 클릭 |
| **사용자 행동** | 좌측 심볼 팔레트에서 장비를 드래그앤드롭으로 캔버스에 배치, 우측 패널에서 기준정보 입력, 포트 간 연결선 생성, 저장 |
| **주요 기능** | • **심볼 팔레트 (좌측)**: Equipment(Stocker/Conveyor/Process), Unit(Port/Crane/AGV), System(ACS), 보조(TextBox/Shape) 분류별 탭 (F001)<br>• **React Flow 캔버스 (중앙)**: 드래그앤드롭 장비 배치, 캔버스 줌/패닝, 미니맵, Undo/Redo (F001)<br>• **기준정보 속성 패널 (우측)**: 선택 심볼의 EQUIPMENT_ID, EQUIPMENT_UNIT_ID, EC_SERVER_NAME, EQUIPMENT_TYPE, INLINE_STOCKER 입력 폼 (F001)<br>• **AGV 경로 개별 생성**: Port 노드 핸들에서 다른 Port 노드로 드래그하여 단일 방향 경로 생성. Port-to-Port 전용, 중복 방지, FIXED_IN_OUT_MODE(INPUT 포트는 출발 불가, OUTPUT 포트는 도착 불가) 적용 (F001)<br>• **AGV 경로 일괄 생성 (컨텍스트 메뉴)**: 복수 Port 선택 → 우클릭 → "경로 일괄 생성" → ACS 시스템 지정 + WEIGHT 입력 → 선택된 포트 간 완전 양방향 경로 자동 생성. Process 장비의 포트 그룹 ↔ 나머지 장비 포트 그룹 간 N×M 전체 연결도 지원 (F001)<br>• **경로 속성 자동 설정**: DEPARTURE_EQUIPMENT, DEPARTURE_EQUIPMENT_UNIT, ARRIVAL_EQUIPMENT, ARRIVAL_EQUIPMENT_UNIT 자동 매핑; TRANSPORT_EQUIPMENT(ACS), WEIGHT 설정 (F001)<br>• **경로 시각화**: 점선 화살표로 AGV 이동 방향 표시, 경로 선택 시 속성 패널에 WEIGHT·시스템 정보 표시 (F001)<br>• **저장/버전관리**: JSON 직렬화 → DB 저장, 레이아웃 버전 목록 조회/불러오기 (F001)<br>• **저장** 버튼 / **미리보기** 버튼 |
| **다음 이동** | 저장 성공 → 대시보드(모니터링 즉시 반영), 오류 → 인라인 오류 표시 |

---

### 반송 제어 페이지

> **구현 기능:** `F002`, `F003`, `F004`, `F009` | **인증:** 로그인 필요

| 항목 | 내용 |
|------|------|
| **역할** | 반송 명령 생성·실행·경로 탐색을 수행하는 핵심 제어 화면 |
| **진입 경로** | 대시보드에서 반송 제어 버튼 클릭, 또는 사이드바 메뉴 클릭 |
| **사용자 행동** | 출발지/목적지 선택 → MacroCommand 생성 → 경로 탐색 방식 선택(A*/AI) → MicroCommand 실행 확인 |
| **주요 기능** | • 출발지/목적지 Equipment.Unit 선택 폼<br>• MacroCommand 생성 및 MicroCommand 분해 결과 표시<br>• A* 경로 탐색 실행 및 경로 시각화 (GCOST/HCOST/FCOST 표시)<br>• AI 경로 추론 실행 및 동적 가중치 반영 경로 표시<br>• A* vs AI 경로 비교 뷰<br>• RTD 연동 상태 표시 및 수동 트리거 (통합 실행 시 활성)<br>• **명령 실행** 버튼 |
| **다음 이동** | 명령 실행 완료 → 대시보드 반송 현황 업데이트 |

---

### 시뮬레이션 페이지

> **구현 기능:** `F005` | **인증:** 로그인 필요

| 항목 | 내용 |
|------|------|
| **역할** | 가상 팩토리 시나리오를 설정하고 A* vs AI 알고리즘 비교 실험을 실행하는 화면 |
| **진입 경로** | 대시보드 시뮬레이션 버튼 클릭, 또는 사이드바 메뉴 클릭 |
| **사용자 행동** | 시나리오 파라미터 설정 → 알고리즘 선택 → 시뮬레이션 실행 → 결과 페이지로 이동 |
| **주요 기능** | • 시뮬레이션 시나리오 파라미터 설정 (캐리어 수, 반송 요청 수, 시뮬레이션 시간)<br>• 실행 알고리즘 선택 (A* 단독 / AI 단독 / 비교 실행)<br>• 반송 요청 자동 생성기 설정<br>• 시뮬레이션 진행 상태 표시 (진행률, 예상 완료 시간)<br>• **시뮬레이션 실행** 버튼 |
| **다음 이동** | 실행 완료 → 시뮬레이션 결과 페이지 자동 이동 |

---

### 시뮬레이션 결과 페이지

> **구현 기능:** `F006` | **인증:** 로그인 필요

| 항목 | 내용 |
|------|------|
| **역할** | A* vs AI 알고리즘 성과 지표를 분석하고 연구 목표 달성 여부를 검증하는 화면 |
| **진입 경로** | 시뮬레이션 완료 후 자동 이동, 또는 사이드바 메뉴 클릭 |
| **사용자 행동** | 지표 비교표 확인 → 개선율 산출 결과 확인 → 결과 CSV 내보내기 |
| **주요 기능** | • A* vs AI 성과 지표 비교 테이블 (반송 시간, 처리량, 충돌 횟수, 부하 균형)<br>• 개선율 자동 산출 및 20% 목표 달성 여부 표시<br>• 반송 시간 분포 차트 (히스토그램)<br>• 장비별 가동률 차트 (막대 그래프)<br>• **결과 CSV 내보내기** 버튼 |
| **다음 이동** | 내보내기 완료 → 동일 페이지 유지, 새 시뮬레이션 → 시뮬레이션 페이지 |

---

### 시뮬레이션 설정 페이지

> **구현 기능:** (시뮬레이션 파라미터 및 캐리어 관리 — F005 보조) | **인증:** 로그인 필요

| 항목 | 내용 |
|------|------|
| **역할** | 시뮬레이션 실행에 필요한 캐리어 마스터 데이터 및 시나리오 파라미터 관리 |
| **진입 경로** | 시뮬레이션 페이지에서 "설정" 버튼 클릭 |
| **사용자 행동** | 캐리어 목록 조회/추가/수정/삭제, 시뮬레이션 기본 파라미터 설정 |
| **주요 기능** | • Carrier 목록/추가/수정/삭제 (캐리어 ID, 자재 유형, 현재 위치)<br>• 시뮬레이션 기본 파라미터 저장 (캐리어 수, 반송 요청 수, 시뮬레이션 시간)<br>• **저장** 버튼 |
| **다음 이동** | 저장 완료 → 시뮬레이션 페이지로 이동 |

> **참고**: Equipment, EquipmentUnit, TransferRelation의 기준정보는 레이아웃 모델러 페이지(F001)에서 시각적으로 관리합니다. 별도 테이블 CRUD가 필요하지 않습니다.

---

## 🗄️ 데이터 모델

> User 모델은 공통(`prd-common.md`) 참조.
> Equipment, EquipmentUnit, TransferRelation은 레이아웃 모델러(F001)가 생성·관리하는 **기준정보 모델**이다.

### Layout (레이아웃 저장)
| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| id | 고유 식별자 | UUID |
| design_id | 레이아웃 ID | String |
| design_name | 레이아웃 이름 | String |
| version | 버전 번호 | Integer |
| json_data | React Flow 직렬화 JSON (노드/엣지 전체) | JSON |
| site_id | 사이트 식별자 | String |
| created_at | 생성 시각 | Timestamp |

### Equipment (장비 — 레이아웃 모델러에서 관리)
| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| id | 고유 식별자 | UUID |
| equipment_id | 장비 ID (예: B1STK101) | String |
| equipment_type | 장비 유형 (Stocker, Conveyor, OHT, AGV 등) | String |
| ec_server_name | 제어 서버 ID (CCS/ACS/OCS) | String |
| inline_stocker | 인라인 스토커 여부 | Boolean |
| state | 현재 상태 (Online, Offline, Error 등) — 실시간 갱신 | String |

### EquipmentUnit (장비 단위 — 레이아웃 모델러에서 관리)
| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| id | 고유 식별자 | UUID |
| equipment_unit_id | 유닛 ID (예: B1STK101_AI01) | String |
| equipment_id | 상위 장비 참조 | → Equipment.id |
| unit_type | 유닛 유형 (Port, Crane, AGV) | String |
| in_out_mode | 입출 모드 (In/Out/Both) | String |
| transfer_state | 반송 상태 | String |

### Carrier (캐리어/자재)
| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| id | 고유 식별자 | UUID |
| carrier_id | 캐리어 ID | String |
| carrier_type | 캐리어 유형 | String |
| material_type | 자재 유형 | String |
| current_equipment_id | 현재 위치 장비 | → Equipment.id |
| state | 상태 (Installed, Transferring, Stored 등) | String |

### TransferRelation (구간 연결 — 레이아웃 모델러에서 관리)
| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| id | 고유 식별자 | UUID |
| departure_unit_id | 구간 출발 유닛 | → EquipmentUnit.id |
| arrival_unit_id | 구간 도착 유닛 | → EquipmentUnit.id |
| transport_equipment_id | 반송을 담당하는 제어 서버 | → Equipment.id |
| weight | 정적 가중치 (레이아웃 모델러에서 입력, 경로 비용 기준) | Float |

### MacroCommand (매크로 반송 명령)
| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| id | 고유 식별자 | UUID |
| command_id | 명령 ID | String |
| carrier_id | 반송 대상 캐리어 | → Carrier.id |
| source_unit_id | 출발지 장비 단위 | → EquipmentUnit.id |
| dest_unit_id | 목적지 장비 단위 | → EquipmentUnit.id |
| state | 상태 (Pending, InProgress, Completed, Failed) | String |
| priority | 우선순위 | Integer |

### MicroCommand (마이크로 반송 명령 — 구간)
| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| id | 고유 식별자 | UUID |
| macro_command_id | 상위 매크로 명령 | → MacroCommand.id |
| sequence | 실행 순서 | Integer |
| departure_unit_id | 구간 출발 | → EquipmentUnit.id |
| arrival_unit_id | 구간 도착 | → EquipmentUnit.id |
| state | 상태 | String |

### RouteFindingResult (경로 탐색 결과 기록)
| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| id | 고유 식별자 | UUID |
| macro_command_id | 연관 반송 명령 | → MacroCommand.id |
| algorithm | 알고리즘 유형 (astar, ai_ppo) | String |
| route | 경로 경유지 문자열 | Text |
| total_cost | 총 경로 비용 | Float |

### SimulationRun (시뮬레이션 실행)
| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| id | 고유 식별자 | UUID |
| scenario_params | 시나리오 파라미터 (JSON) | JSON |
| algorithms | 실행 알고리즘 목록 | String |
| status | 상태 (Running, Completed, Failed) | String |
| created_at | 생성 시각 | Timestamp |

### SimulationResult (시뮬레이션 성과 지표)
| 필드 | 설명 | 타입/관계 |
|------|------|----------|
| id | 고유 식별자 | UUID |
| simulation_run_id | 연관 시뮬레이션 | → SimulationRun.id |
| algorithm | 알고리즘 유형 | String |
| avg_transfer_time | 평균 반송 시간 (초) | Float |
| throughput | 단위 시간당 처리 건수 | Float |
| collision_count | 충돌/대기 횟수 | Integer |
| load_balance_std | 부하 균형 표준편차 | Float |

---

## 🛠️ 기술 스택

> 공통 스택(`prd-common.md`) 기반에서 MCS 모듈 전용 스택을 추가합니다.

### 🗺️ MCS 전용 — 레이아웃 모델러 & 모니터링

- **React Flow 12.x** - 공장 레이아웃 모델러 캔버스 (드래그앤드롭, 커스텀 노드/엣지, 미니맵, Undo/Redo)
- **framer-motion** - 캐리어 이동 애니메이션 (LHT Pick→Move→Place, Stocker 크레인)
- **SVG React 컴포넌트** - 자사 symbols/sem/ 심볼 재구현 (Stocker/Conveyor/Port/LHT/AGV/Carrier 등)
- **Zustand** - 레이아웃 편집 상태 관리 (노드/엣지 + Undo/Redo 이력)

### 📊 MCS 전용 — 시각화

- **Recharts** - 성과 지표 차트 (히스토그램, 막대 그래프)

### 🗄️ MCS 전용 — 실시간 통신

- **WebSocket** - 실시간 물류 모니터링 (장비 상태 변경, 캐리어 이동 이벤트 Push)

### 🤖 AI 경로 최적화 엔진 (별도 Python 서비스)

- **Python 3.12+** - AI 엔진 런타임
- **FastAPI** - AI 추론 REST API 서버
- **PyTorch 2.x** - 강화학습 모델 프레임워크
- **Stable-Baselines3** - PPO/MAPPO 알고리즘 구현
- **NetworkX** - 팩토리 그래프 모델링 (레이아웃 모델러 저장 데이터 → 방향 가중 그래프 변환)
- **SimPy** - 시뮬레이션 이산 이벤트 엔진

### 📦 추가 패키지 관리

- **pip / uv** - 의존성 관리 (AI 엔진)
