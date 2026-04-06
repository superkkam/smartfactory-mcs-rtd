# MCS 솔루션 분석 및 연구과제 접목 방안

> **작성일**: 2026-03-27
> **대상 솔루션**: THiRA-MCS (thirautech-service-mcs)
> **연구과제**: 노코드 디스패칭 룰 빌더와 AI 경로 최적화를 적용한 스마트팩토리 MCS-RTD 통합 제어 플랫폼 개발

---

## 1. 분석 대상 요약

본 문서는 자사 MCS(Material Control System) 솔루션인 THiRA-MCS의 핵심 구현을 분석하고, 연구과제의 "MCS 반송 제어 및 AI 경로 최적화" 모듈에 어떻게 접목할 수 있는지 정리한다. RTD(노코드 룰 빌더)는 별도 세션에서 분석하므로 본 문서에서는 MCS 영역에 집중한다.

---

## 2. 연구과제 개요 (MCS 관련)

### 2.1 프로젝트 전체 목표
- **국문**: 노코드 디스패칭 룰 빌더와 AI 경로 최적화를 적용한 스마트팩토리 MCS-RTD 통합 제어 플랫폼 개발
- **영문**: Development of a Smart Factory Integrated MCS-RTD Control Platform with No-Code Dispatching Rule Builder and AI-Based Route Optimization

### 2.2 MCS 관련 핵심 요구사항

| 구분 | 내용 |
|------|------|
| **MCS 반송 제어** | 매크로 명령을 마이크로 명령으로 분해/실행하는 반송 제어 로직 구현 |
| **AI 경로 최적화** | 강화학습 기반 AI 모델을 적용하여 캐리어/AMR의 실시간 최적 경로 산출 |
| **통합 모니터링** | RTD의 디스패칭 상태와 MCS의 반송 현황을 실시간 연동하여 통합 대시보드 구현 |
| **시뮬레이션 검증** | 가상 팩토리 시나리오를 통한 경로 최적화 성능 정량 검증 |

### 2.3 정량적 목표
- 룰 생성 시간: 기존 대비 **50% 이상 단축**
- AI 경로 최적화: 기존 정적 알고리즘(Dijkstra 등) 대비 반송 효율 **20% 이상 개선**

### 2.4 참고 기술 근거
- **THiRA-MCS(자사 솔루션)**: MCS의 반송 제어 로직 및 경로 관리 구조 참고
- **강화학습 기반 경로 최적화 연구**: 멀티 에이전트 경로 탐색(MAPF) 관련 선행 연구
- **OpenTCS**: 오픈소스 MCS 구조 참고

---

## 3. 현재 MCS 솔루션 분석

### 3.1 전체 아키텍처

THiRA-MCS는 Spring Boot 기반의 Java 서비스로, 아래 레이어 구조를 가진다:

```
thirautech-service-mcs/
├── entity/          # JPA 엔티티 (DB 테이블 매핑)
├── repository/      # Spring Data JPA 리포지토리
├── impl/            # 서비스 구현체 (CRUD)
├── factory/         # 비즈니스 로직 팩토리 (핵심 로직)
├── execute/         # 실행기 (Host/UI/MIS/Base)
├── base/            # 도메인 모델 (TransferJob, TransferRoute 등)
├── constant/        # 상수 정의 (MCSConstants, RTDConstants)
├── utils/           # 유틸리티
└── cron/            # 배치 처리
```

### 3.2 핵심 엔티티 구조

#### 3.2.1 반송 명령 체계 (Transport Command)

MCS의 가장 핵심적인 구조는 **Macro-Micro 2단계 명령 체계**이다.

```
TMS_MACRO_COMMAND (매크로 명령)
├── COMMAND_ID (PK) - 반송 명령 고유 ID
├── WORK_ID - 작업 ID
├── CARRIER_ID - 반송 대상 캐리어
├── JOB_TYPE - 작업 유형
├── STATE / PREV_STATE - 현재/이전 상태
├── PRIORITY - 우선순위
├── SOURCE_TYPE / SOURCE_EQUIPMENT / SOURCE_EQUIPMENT_UNIT - 출발지
├── DEST_TYPE / DEST_EQUIPMENT / DEST_EQUIPMENT_UNIT - 목적지
├── CARRIER_TYPE - 캐리어 유형
├── JOB_ID - 호스트 명령 연계 ID
├── CYCLE_COMMAND_ID - 순환 테스트 연계
└── SITE_ID (PK)

    └── TMS_MICRO_COMMAND (마이크로 명령) [1:N]
        ├── MICRO_COMMAND_ID (PK) - 마이크로 명령 고유 ID
        ├── COMMAND_ID - 상위 매크로 명령 참조
        ├── SEQUENCE - 실행 순서
        ├── STATE / PREV_STATE - 현재/이전 상태
        ├── PRIORITY - 우선순위
        ├── DEPARTURE_TYPE / DEPARTURE_EQUIPMENT / DEPARTURE_EQUIPMENT_UNIT - 구간 출발지
        ├── ARRIVAL_TYPE / ARRIVAL_EQUIPMENT / ARRIVAL_EQUIPMENT_UNIT - 구간 도착지
        ├── SOURCE_EQUIPMENT / SOURCE_EQUIPMENT_UNIT - 최초 출발지
        ├── DEST_EQUIPMENT / DEST_EQUIPMENT_UNIT - 최종 목적지
        └── SITE_ID (PK)
```

**핵심 개념**: 하나의 Macro Command(출발지→목적지)가 여러 개의 Micro Command(구간별 이동)로 분해되어 순차 실행된다. 예를 들어 A→D 반송이 A→B, B→C, C→D 세 구간으로 분해될 수 있다.

#### 3.2.2 경로 정보 체계 (Transfer Route)

```
TMS_TRANSFER_RELATION (구간 연결 정보)
├── DEPARTURE_EQUIPMENT / DEPARTURE_EQUIPMENT_UNIT (PK) - 구간 출발
├── ARRIVAL_EQUIPMENT / ARRIVAL_EQUIPMENT_UNIT (PK) - 구간 도착
├── TRANSPORT_EQUIPMENT (PK) - 반송 장비(Conveyor, OHT, AGV 등)
├── PATH - 경로 식별자
├── WEIGHT - 가중치 (경로 비용 계산용)
├── PRIORITY - 우선순위
└── SITE_ID (PK)

TMS_TRANSFER_ROUTE (계산된 전체 경로)
├── ROUTE_ID (PK) - 경로 ID
├── SOURCE_EQUIPMENT / SOURCE_EQUIPMENT_UNIT (PK) - 전체 출발지
├── DEST_EQUIPMENT / DEST_EQUIPMENT_UNIT (PK) - 전체 목적지
├── PRIORITY (PK) - 경로 우선순위 (동일 출발-도착에 여러 경로 가능)
├── SEQUENCE - 구간 순서
├── DEPARTURE_EQUIPMENT / DEPARTURE_EQUIPMENT_UNIT - 구간 출발
├── ARRIVAL_EQUIPMENT / ARRIVAL_EQUIPMENT_UNIT - 구간 도착
├── TRANSPORT_EQUIPMENT - 구간 반송 장비
├── WEIGHT - 구간 가중치
├── IS_FIXED_ROUTE - 고정 경로 여부
└── SITE_ID (PK)

TMS_ROUTE_FINDING_RESULT (경로 탐색 결과 기록)
├── UUID (PK)
├── COMMAND_ID - 연관 반송 명령
├── CARRIER_ID - 캐리어
├── SOURCE/DEST_EQUIPMENT/UNIT - 출발/도착
├── ROUTE - 경로 문자열 (경로 경유지 기록)
└── REASON - 경로 선택 사유
```

#### 3.2.3 장비 계층 구조 (Equipment Hierarchy)

```
TMS_EQUIPMENT (장비)
├── EQUIPMENT_ID (PK) - 장비 ID
├── EQUIPMENT_TYPE - 장비 유형 (Stocker, Conveyor, OHT, AGV 등)
├── PARENT_ID - 상위 장비 (계층 구조)
├── EQUIPMENT_LEVEL - 계층 레벨
├── STATE / PREV_STATE - 현재/이전 상태
├── CONTROL_MODE - 제어 모드 (Online/Offline 등)
├── OPERATION_MODE - 운영 모드
├── PROCESS_STATE - 공정 상태
├── LOCATION / PREV_LOCATION - 위치
├── CAPABILITY / MAX_CAPACITY / MIN_CAPACITY - 용량 정보
├── X / Y / Z - 좌표 (레이아웃 위치)
├── MATERIAL_TYPE / MATERIAL_CODE - 자재 유형
├── FULL_STATE / DOOR_STATE - 상세 상태
├── IP / PORT - 통신 정보
├── PROHIBITED_AREA / INNER_AREA - 금지/내부 구역
└── SITE_ID (PK)

    └── TMS_EQUIPMENT_UNIT (장비 단위: 포트, 선반 등) [1:N]
        ├── EQUIPMENT_UNIT_ID (PK) - 유닛 ID
        ├── EQUIPMENT_ID (PK) - 상위 장비 참조
        ├── EQUIPMENT_UNIT_TYPE - 유닛 유형 (Port, Shelf, Zone 등)
        ├── STATE - 상태
        ├── SERVICE_TYPE - 서비스 유형
        ├── IN_OUT_MODE - 입출 모드 (In/Out/Both)
        ├── OPERATION_MODE - 운영 모드
        ├── TRANSFER_STATE - 반송 상태
        ├── LINKED_TRANSPORT_TYPE / ID - 연결 반송 장비
        ├── PORT_GROUP - 포트 그룹
        ├── ZONE_NAME - 존 이름
        ├── POSITION_X / POSITION_Y - 위치 좌표
        └── SITE_ID (PK)
```

#### 3.2.4 캐리어 관리 (Carrier)

```
TMS_CARRIER (캐리어/자재)
├── CARRIER_ID (PK) - 캐리어 ID (바코드 데이터 길이 대응, 80자)
├── CARRIER_CLASS_ID - 캐리어 분류
├── CARRIER_TYPE - 유형
├── MATERIAL_TYPE - 자재 유형
├── EQUIPMENT_ID - 현재 위치 장비
├── LOCATION / PREV_LOCATION - 현재/이전 위치
├── STATE / PREV_STATE - 상태 (Installed, WaitIn, WaitOut, Transferring, Completed, Stored 등)
├── LOAD_STATE - 적재 상태
├── LOT_ID / LOT_NUMBER / LOT_TYPE - Lot 정보
├── HOLD_STATE - 보류 상태
├── SERVICE_TYPE - 서비스 유형
├── STORED_TIME - 저장 시간
├── LIFE_TIME / DECOMP_TIME - 수명/분해 시간
└── SITE_ID (PK)
```

#### 3.2.5 디스패칭 룰 체계 (DMS Rule)

```
DMS_RULE_GROUP_DEF (룰 그룹 정의)
├── RULE_GROUP_ID (PK) - 룰 그룹 ID
├── RULE_GROUP_NAME - 룰 그룹명
├── RULE_GROUP_TYPE - 유형
└── SITE_ID (PK)

DMS_RULE_DEF (룰 정의)
├── RULE_ID (PK) - 룰 ID
├── RULE_NAME - 룰명
├── RULE_CLASS_ID - 룰 분류
├── RULE_TYPE - 유형
├── RULE_CONDITION - 조건
└── SITE_ID (PK)

DMS_RULE_RELATION (룰 그룹-룰 관계)
├── RULE_GROUP_ID (PK) - 룰 그룹 참조
├── RULE_ID (PK) - 룰 참조
├── SEQUENCE (PK) - 실행 순서
├── RULE_QUERY_ID / RULE_QUERY_CLASS_ID / RULE_QUERY_VERSION - 쿼리 참조
├── IS_MANDATORY - 필수 여부
├── IS_GROUP - 그룹 여부
├── FILTER_SEQUENCE - 필터 순서
├── JUMP_NEXT_SEQUENCE / JUMP_NEXT_SEQUENCE_CONDITION - 분기 조건
├── RULE_SORT_ID / RULE_SORT_VERSION - 정렬 룰 참조
└── SITE_ID (PK)

DMS_RULE_QUERY (쿼리 정의)
├── RULE_QUERY_ID (PK) - 쿼리 ID
├── RULE_QUERY_CLASS_ID (PK) - 분류
├── RULE_QUERY_VERSION (PK) - 버전
├── RULE_QUERY_TYPE - 유형
├── RULE_QUERY_STRING - SQL 쿼리 문자열 (최대 4000자)
└── SITE_ID (PK)

DMS_RULE_SORT (정렬 정의)
├── RULE_SORT_ID (PK)
├── RULE_SORT_VERSION (PK)
├── SORT_COLUMN - 정렬 컬럼
├── FROM_PERCENT / TO_PERCENT - 범위
├── STANDARD_VALUE / WEIGHT_VALUE - 기준/가중치
├── ORDER_BY - 정렬 방향
└── SITE_ID (PK)

DMS_RULE_OBJECT (룰 적용 대상)
├── RULE_OBJECT_ID (PK) - 대상 ID
├── RULE_EVENT_ID (PK) - 이벤트 ID
├── RULE_GROUP_ID - 룰 그룹 참조
└── SITE_ID (PK)
```

#### 3.2.6 기타 엔티티

| 엔티티 | 설명 |
|--------|------|
| **TmsAlarmVO** | 알람 관리 (알람 유형, 코드, 레벨, 리포터, 장비 연계) |
| **TmsStateVO / TmsStateClassVO / TmsStateTransitionVO** | 상태 머신 정의 및 전이 규칙 |
| **TmsPolicyVO / TmsPolicyObjectVO** | 정책 관리 (시스템 설정값) |
| **TmsCodeVO / TmsCodeClassVO** | 코드 마스터 |
| **TmsHostCommandVO** | 호스트(MES) 연계 명령 |
| **TmsCycleTestVO** | 순환 테스트 (반복 반송 테스트) |
| **TmsTransferBalancingVO / TmsTransferBalancingGroupVO** | 반송 부하 분산 |
| **TmsTransferPortGroupVO** | 포트 그룹 관리 |
| **TmsHaManagementVO** | HA(고가용성) 관리 |
| **TmsEventLogVO / McsEventLogVO** | 이벤트 로그 |
| **DmsRuleRunningResultVO** | 룰 실행 결과 기록 |
| **TmsWorkorderVO** | 작업 지시 (현재 미사용, 전체 주석 처리) |

### 3.3 핵심 비즈니스 로직 (Factory 패턴)

#### 3.3.1 TransportServiceFactory (반송 서비스)

MCS의 **가장 핵심적인 비즈니스 로직**이 집중된 팩토리이다.

**주요 기능**:
- **MacroCommand 생성/관리**: 반송 명령 생성, 상태 변경, 우선순위 조정
- **MicroCommand 분해/관리**: 매크로를 마이크로로 분해, 순차 실행 관리
- **TransferJob 생성**: MacroCommand + MicroCommand + 경로 정보를 통합한 작업 객체 생성
- **동적 경로 생성**: `createDynamicRoute()` - 실행 중 경로 재계산
- **대체 경로 처리**: `chkAlternateCommand()` - 다음 마이크로 도착지 불가 시 대안 경로
- **Best Shelf 탐색**: `getBestShelf()` - 자재 유형 및 거리를 고려한 최적 선반 탐색
- **존 용량 관리**: `getCurrentTransferCountZone()`, `getBestStoredZoneByStockerId()`

#### 3.3.2 RouteServiceFactory (경로 서비스)

**주요 기능**:
- **TransferRoute 조회**: 출발-도착 기준 가능한 경로 목록 조회
- **최적 경로 탐색**: `getBestRoute()` - commandId, carrierId, 출발/도착 정보, TransferRelation 맵을 기반으로 최적 경로 산출
- **경로 생성/삭제**: TransferRelation 데이터 기반으로 전체 경로 테이블 재생성
- **고정 경로 판단**: `isFixedRoute()` - 고정 경로 여부 확인
- **캐시 기반 조회**: `getTransferRouteListByCache()` - 경로 정보 캐시 활용

#### 3.3.3 DispatchingServiceFactory (디스패칭 서비스)

**주요 기능**:
- **디스패칭 룰 실행**: `getDispatchingRuleList()` - 룰 오브젝트/이벤트 기준 룰 목록 조회
- **룰 기반 최적 데이터 선정**: `getBestDataByRule()` - 룰 체인을 통해 최적 대상 선정
- **최적 포트 탐색**: `getBestPort()`, `getBestPortByRuleGroupId()` - 룰 기반 최적 포트 결정
- **최적 Lot 탐색**: `getBestLot()`, `getBestBundleLotList()` - 룰 기반 Lot 선정
- **Load/Unload 요청 조회**: 포트의 적재/하역 요청 관리

#### 3.3.4 EquipmentServiceFactory (장비 서비스)

**주요 기능**:
- 장비/유닛 CRUD 및 상태 관리
- 상태 변경 (State, ControlMode, OperationMode, ProcessState, FullState)
- 포트 상태 및 반송 상태 관리
- 빈 선반 탐색, 존 용량 확인, Stocker Full 확인
- 동적 검색 (Equal/Like)

#### 3.3.5 CarrierServiceFactory (캐리어 서비스)

**주요 기능**:
- 캐리어 CRUD 및 상태/위치 관리
- 자재 유형 검증 (`chkCarrierMaterialType()`)
- 캐리어 상태 검증 (`chkCarrierState()` - Hold, Prohibited 확인)
- UNK(Unknown)/DUP(Duplicate)/PHB(Prohibited)/EQP 캐리어 관리
- 이력 관리

### 3.4 경로 탐색 도메인 모델 (base 패키지)

```
TransferJob
├── MacroCommand 정보 (commandId, workId, 출발/도착 등)
├── MicroCommand 현재 정보
├── MicroCommand 목록
├── CarrierId, CarrierType
├── Sequence, Priority
└── 경유지 정보 (StopOver)

TransferRoute
├── 출발/도착 (Source/Dest Equipment.Unit)
├── Priority
├── Cost (비용)
└── TransferRouteItemList [순서대로 경유 구간]

TransferRouteItem
├── Departure/Arrival Equipment.Unit (구간 출발/도착)
├── Transport Equipment (반송 장비)
├── Weight, Priority, Sequence
├── Cost, JobCost, TotalCost (비용 정보)
├── GCOST, HCOST, FCOST (A* 알고리즘 비용: G=실제, H=휴리스틱, F=합계)
├── BalanceTransferCount / Priority (부하 분산)
└── Path (경로 이력)
```

**핵심 발견**: `TransferRouteItem`에 **GCOST, HCOST, FCOST** 필드가 존재하여, 현재 MCS가 **A* 알고리즘 기반**의 경로 탐색을 사용하고 있음을 확인할 수 있다.

### 3.5 상수 체계 (Constants)

#### MCSConstants 주요 상수
- **캐리어 상태**: Installed, WaitIn, WaitOut, Alternate, Transferring, Completed, Removed, Stored, Decompressed, Purging, Prohibited
- **반송 관련 플래그**: DynamicRouteConstantId, JobCostConstantId, TransferBalancingConstantId, PortPriorityFlagConstantId
- **시스템 설정**: 동적 경로 플래그, 저장 모드, 반송 비용 플래그

#### RTDConstants 주요 상수
- **에러 코드**: ERROR_DISP_MODE_IS_N, ERROR_PORT_ALREADY_RESERVED, ERROR_PORT_NOT_READY, ERROR_NO_SEARCH_LOT 등

### 3.6 강점 및 한계

#### 강점
| 항목 | 설명 |
|------|------|
| **Macro-Micro 구조** | 유연한 반송 명령 분해 구조로, 복잡한 경로도 구간별 관리 가능 |
| **A* 기반 경로 탐색** | GCOST/HCOST/FCOST 기반의 최적 경로 탐색 이미 구현 |
| **동적 경로** | 실행 중 경로 재계산 기능 존재 (`createDynamicRoute`) |
| **대체 경로** | 목적지 불가 시 대안 경로 자동 처리 |
| **부하 분산** | TransferBalancing 체계로 반송 장비 간 부하 분산 |
| **룰 엔진** | DMS 룰 체계로 디스패칭 로직의 데이터 기반 관리 |
| **이력 관리** | 모든 주요 엔티티에 Hist 테이블 존재 |
| **멀티사이트** | SITE_ID 기반 다중 공장 지원 |

#### 한계
| 항목 | 설명 |
|------|------|
| **정적 가중치** | TransferRelation의 WEIGHT가 정적으로, 실시간 상황 반영 어려움 |
| **A* 한계** | 단일 에이전트 최적 경로만 탐색, 다중 캐리어 간 충돌/경합 미고려 |
| **룰 설정 복잡** | DMS 룰 설정이 SQL 쿼리 문자열 기반으로, 비개발자 접근 어려움 |
| **실시간 최적화 부재** | 정적으로 계산된 경로를 사용하며, 실시간 환경 변화 반영 제한적 |
| **레거시 기술 스택** | javax.persistence(JPA 2.x) 사용, 최신 Jakarta EE 미적용 |

---

## 4. 연구 프로젝트 매핑

### 4.1 활용 가능한 구현 요소

#### 4.1.1 반송 명령 데이터 모델 (높은 재활용도)
- **대상**: `TmsMacroCommandVO`, `TmsMicroCommandVO`, `TransferJob`
- **활용 방안**: 연구 프로토타입의 반송 명령 데이터 구조로 그대로 참고. Macro→Micro 분해 구조는 연구과제의 "매크로 명령을 마이크로 명령으로 분해/실행" 요구사항과 직접 대응됨.
- **필요 수정**: 신규 프로젝트의 기술 스택(Python/FastAPI 또는 Next.js 등)에 맞게 스키마 정의만 변환

#### 4.1.2 경로 정보 체계 (높은 재활용도)
- **대상**: `TmsTransferRelationVO`, `TmsTransferRouteVO`, `TransferRoute`, `TransferRouteItem`
- **활용 방안**: 그래프 기반 경로 모델의 설계 참고. TransferRelation(노드 간 연결)을 그래프의 엣지로, Equipment/EquipmentUnit을 노드로 변환하여 AI 경로 최적화의 입력 데이터 구조로 활용
- **핵심 참고점**: WEIGHT(가중치), COST(비용), PRIORITY(우선순위) 필드 구조를 AI 보상 함수 설계에 활용

#### 4.1.3 장비/캐리어 마스터 구조 (중간 재활용도)
- **대상**: `TmsEquipmentVO`, `TmsEquipmentUnitVO`, `TmsCarrierVO`
- **활용 방안**: 시뮬레이션 환경 구성을 위한 마스터 데이터 스키마 참고. Equipment의 계층 구조(parentId, equipmentLevel)와 좌표(X, Y, Z) 정보를 디지털 트윈/시뮬레이션에 활용
- **필요 수정**: 시뮬레이션 목적에 맞게 일부 필드 경량화

#### 4.1.4 상태 머신 구조 (중간 재활용도)
- **대상**: `TmsStateVO`, `TmsStateClassVO`, `TmsStateTransitionVO`
- **활용 방안**: 캐리어/장비 상태 전이 모델의 설계 참고. 강화학습 환경(Environment)의 상태 공간(State Space) 정의에 활용

#### 4.1.5 디스패칭 룰 구조 (RTD 연계 참고)
- **대상**: `DmsRuleDef`, `DmsRuleGroupDef`, `DmsRuleRelation`, `DmsRuleQuery`, `DmsRuleSort`, `DmsRuleObject`
- **활용 방안**: 현재 코드 기반의 룰 구조를 이해하고, 이를 노코드 룰 빌더로 변환하기 위한 참고 모델로 활용 (RTD 세션에서 심화 분석)

### 4.2 연구 목적에 맞게 개선할 부분

#### 4.2.1 경로 탐색 알고리즘: A* → 강화학습 기반
- **현재**: A* 알고리즘 (GCOST, HCOST, FCOST 기반 정적 최단 경로)
- **개선**: 강화학습(DQN, PPO 등) 기반 동적 최적 경로
- **구체적 방향**:
  - 현재 TransferRelation의 WEIGHT를 정적 비용이 아닌, 실시간 상태(장비 가용성, 트래픽, 대기 시간)를 반영하는 **동적 비용**으로 전환
  - 단일 에이전트(A*) → **멀티 에이전트(MAPF)** 경로 탐색으로 확장
  - 강화학습 보상 함수 설계 시 기존 WEIGHT, PRIORITY, COST 구조를 기반으로 설계

#### 4.2.2 가중치/비용 모델: 정적 → 실시간 동적
- **현재**: TransferRelation.WEIGHT와 TransferRouteItem.COST가 정적 값
- **개선**: 실시간 팩토리 상태를 반영한 동적 가중치 모델
- **구체적 방향**:
  - Equipment의 STATE, PROCESS_STATE, FULL_STATE 실시간 반영
  - EquipmentUnit의 TRANSFER_STATE, 현재 반송 건수 반영
  - TransferBalancing의 CURRENT_COUNT / MAX_COUNT 비율 반영
  - 캐리어의 LIFE_TIME, DECOMP_TIME 등 시간 제약 반영

#### 4.2.3 통합 모니터링: DB 기반 → 실시간 이벤트 스트림
- **현재**: TmsEventLogVO에 이벤트를 DB 저장, UI에서 조회
- **개선**: 이벤트 스트리밍 기반 실시간 대시보드
- **구체적 방향**:
  - WebSocket/SSE 기반 실시간 상태 푸시
  - 반송 명령 상태 변경, 장비 상태 변경, 알람 발생 등을 실시간 스트리밍
  - 기존 EventLog 스키마를 참고하되, 시계열 DB(InfluxDB 등)나 메시지 큐(Redis Streams 등) 활용

### 4.3 신규 개발 필요 사항

#### 4.3.1 강화학습 기반 경로 최적화 엔진
- **개발 내용**: MAPF(Multi-Agent Path Finding) 문제를 강화학습으로 풀기 위한 엔진
- **핵심 구현**:
  - 팩토리 레이아웃 → 강화학습 환경(Environment) 변환 모듈
  - 상태 공간: 전체 장비/캐리어 위치, 장비 상태, 대기 명령 큐
  - 행동 공간: 각 캐리어의 다음 이동 구간 선택
  - 보상 함수: 반송 완료 시간, 충돌 회피, 부하 균형, 에너지 효율
  - 학습 알고리즘: PPO 또는 MAPPO (멀티 에이전트)
- **참고**: 기존 MCS의 TransferRelation 그래프를 Environment의 맵으로 직접 변환 가능

#### 4.3.2 시뮬레이션 환경
- **개발 내용**: 가상 팩토리 시나리오 기반 성능 검증 환경
- **핵심 구현**:
  - 기존 MCS의 Equipment/EquipmentUnit/Carrier 데이터로 시뮬레이션 맵 구성
  - 반송 요청 생성기 (MacroCommand 자동 생성)
  - 기존 A* 알고리즘 vs 강화학습 알고리즘 비교 평가
  - 성과 지표 자동 측정 (반송 시간, 처리량, 장비 가동률)

#### 4.3.3 RTD-MCS 통합 인터페이스
- **개발 내용**: RTD(룰 빌더)와 MCS(반송 제어) 간 실시간 데이터 연동
- **핵심 구현**:
  - RTD의 디스패칭 결과(목적지 결정) → MCS의 반송 명령 생성 연계
  - MCS의 반송 완료 이벤트 → RTD의 다음 디스패칭 트리거
  - 공통 이벤트 버스 (REST API 또는 메시지 큐 기반)

#### 4.3.4 통합 모니터링 대시보드 (프론트엔드)
- **개발 내용**: RTD 디스패칭 + MCS 반송 상태를 단일 화면에서 모니터링
- **핵심 구현**:
  - 팩토리 레이아웃 뷰 (Equipment 좌표 기반)
  - 반송 경로 시각화 (TransferRoute 기반 애니메이션)
  - 캐리어 추적 (위치/상태 실시간 업데이트)
  - 알람 및 이상 상황 표시

---

## 5. 구현 방향 제안

### 5.1 핵심 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                   통합 대시보드 (React/Next.js)           │
│   ┌──────────────────┐    ┌────────────────────────┐    │
│   │  RTD 룰 빌더 뷰   │    │  MCS 반송 모니터링 뷰    │    │
│   └────────┬─────────┘    └────────────┬───────────┘    │
└────────────┼───────────────────────────┼────────────────┘
             │ WebSocket/SSE             │
┌────────────┼───────────────────────────┼────────────────┐
│            │      통합 백엔드 (API)      │                │
│   ┌────────┴─────────┐    ┌────────────┴───────────┐    │
│   │  RTD 서비스       │    │  MCS 서비스              │    │
│   │  (룰 실행 엔진)   │◄──►│  (반송 제어 엔진)         │    │
│   └──────────────────┘    └────────────┬───────────┘    │
│                                        │                 │
│                           ┌────────────┴───────────┐    │
│                           │  AI 경로 최적화 엔진     │    │
│                           │  (강화학습 / Python)      │    │
│                           └────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
             │                           │
┌────────────┴───────────┐  ┌────────────┴───────────┐
│   DB (PostgreSQL 등)    │  │  시뮬레이션 환경          │
│  - 장비/캐리어 마스터    │  │  (가상 팩토리 시나리오)    │
│  - 반송 명령/이력       │  │  - 기존 A* vs AI 비교     │
│  - 경로 정보            │  │  - 성과 지표 측정          │
│  - 룰 정의              │  └────────────────────────┘
└────────────────────────┘
```

### 5.2 단계별 구현 계획

#### 1단계: 설계 (1~2주차)
| 항목 | 내용 |
|------|------|
| MCS 데이터 모델 설계 | 기존 THiRA-MCS 엔티티를 연구 프로토타입용으로 경량화/변환 |
| 그래프 모델 설계 | TransferRelation → 강화학습 환경 그래프 변환 구조 설계 |
| API 인터페이스 설계 | MCS-RTD 간 통합 API 스펙 정의 |
| 시뮬레이션 시나리오 설계 | 검증용 가상 팩토리 시나리오 구성 |

#### 2단계: 핵심 개발 - MCS 엔진 (3~5주차)
| 항목 | 내용 |
|------|------|
| MCS 반송 제어 엔진 | Macro→Micro 분해 로직, 명령 상태 머신 구현 (기존 TransportServiceFactory 참고) |
| 경로 탐색 기본 엔진 | 기존 A* 기반 경로 탐색 구현 (Baseline, TransferRouteItem의 GCOST/HCOST/FCOST 구조 참고) |
| 시뮬레이션 환경 구축 | Equipment/Carrier 기반 가상 팩토리 환경, 반송 요청 생성기 |

#### 3단계: 핵심 개발 - AI 경로 최적화 (5~8주차)
| 항목 | 내용 |
|------|------|
| 강화학습 환경 구현 | 팩토리 그래프 → OpenAI Gym 호환 환경 변환 |
| 보상 함수 설계/구현 | 기존 WEIGHT, COST, PRIORITY 구조 기반 보상 함수 |
| 학습 파이프라인 | PPO/MAPPO 기반 학습, 모델 저장/배포 |
| 추론 서비스 | 학습된 모델 기반 실시간 경로 추론 API |

#### 4단계: 통합 테스트 (9~12주차)
| 항목 | 내용 |
|------|------|
| RTD-MCS 통합 | 디스패칭 결과 → 반송 명령 생성 연계 테스트 |
| 통합 대시보드 | 반송 상태 실시간 모니터링, 경로 시각화 |
| 시나리오 테스트 | A* vs AI 비교, 정량 목표 검증 (반송 효율 20% 이상) |
| 성과 분석 | 결과 데이터 정리, 시각화, 보고서 작성 |

### 5.3 기술 스택 제안

| 구분 | 기술 | 이유 |
|------|------|------|
| **MCS 백엔드** | Python (FastAPI) 또는 Node.js | 프로토타입 빠른 개발, AI 엔진과 동일 언어 |
| **AI 경로 최적화** | Python, PyTorch, Stable-Baselines3 | 강화학습 생태계 활용 |
| **프론트엔드** | React (VS Code Extension 또는 웹) | 노코드 룰 빌더와 통합 (연구계획서 기준) |
| **시뮬레이션** | Python (NetworkX + Custom Gym Env) | 그래프 기반 팩토리 모델링 |
| **DB** | PostgreSQL 또는 SQLite | 프로토타입용 경량 DB |
| **실시간 통신** | WebSocket (Socket.IO) | 대시보드 실시간 업데이트 |

### 5.4 검증 방법

| 지표 | 측정 방법 | 목표 |
|------|----------|------|
| **반송 효율(처리량)** | 단위 시간당 완료 반송 건수 비교 (A* vs AI) | 20% 이상 개선 |
| **평균 반송 시간** | MacroCommand 생성~완료 시간 평균 | 기존 대비 단축 |
| **충돌/대기 횟수** | 경로 충돌 및 대기 발생 건수 | 감소 |
| **부하 균형** | 반송 장비별 사용률 표준편차 | 감소 |
| **통합 운영 안정성** | RTD-MCS 연동 중 오류 발생률 | 0.1% 이하 |

---

## 6. MCS 엔티티-연구과제 매핑 요약표

| 기존 MCS 엔티티 | 연구과제 활용 영역 | 활용 수준 |
|----------------|------------------|----------|
| TmsMacroCommandVO | MCS 반송 제어 - 매크로 명령 구조 | **직접 참고** |
| TmsMicroCommandVO | MCS 반송 제어 - 마이크로 명령 구조 | **직접 참고** |
| TmsEquipmentVO | 시뮬레이션 환경 - 장비 맵 구성 | **직접 참고** |
| TmsEquipmentUnitVO | 시뮬레이션 환경 - 포트/선반 구성 | **직접 참고** |
| TmsCarrierVO | 시뮬레이션 환경 - 캐리어 모델 | **직접 참고** |
| TmsTransferRelationVO | AI 경로 최적화 - 그래프 엣지 | **핵심 참고 + 확장** |
| TmsTransferRouteVO | AI 경로 최적화 - 경로 저장 구조 | **참고 + 개선** |
| TransferRouteItem (base) | AI 경로 최적화 - 비용 모델 | **핵심 참고 + 확장** |
| TransferJob (base) | MCS 반송 제어 - 작업 객체 | **직접 참고** |
| TransferRoute (base) | AI 경로 최적화 - 경로 모델 | **직접 참고** |
| DmsRuleDef/GroupDef | RTD 노코드 룰 빌더 - 룰 모델 (RTD 세션) | RTD 세션에서 분석 |
| DmsRuleRelation | RTD 노코드 룰 빌더 - 룰 체인 (RTD 세션) | RTD 세션에서 분석 |
| DmsRuleQuery | RTD 노코드 룰 빌더 - 쿼리 (RTD 세션) | RTD 세션에서 분석 |
| TmsAlarmVO | 통합 대시보드 - 알람 모니터링 | 참고 |
| TmsEventLogVO | 통합 대시보드 - 이벤트 로그 | 참고 |
| TmsStateVO/TransitionVO | AI 환경 - 상태 공간 정의 | 참고 |
| TmsTransferBalancingVO | AI 보상 함수 - 부하 균형 | 참고 |
| TmsPolicyVO | 시스템 설정 모델 | 경량 참고 |
| TmsRouteFindingResultVO | 경로 탐색 결과 기록/비교 | **직접 참고** |

---

## 7. 핵심 고려사항

### 7.1 기술적 고려사항
1. **A* → 강화학습 전환의 기준선 확보**: 기존 A* 알고리즘의 성능을 먼저 정확히 측정하여 비교 기준(Baseline)을 확보해야 한다. TransferRouteItem의 GCOST/HCOST/FCOST 구조를 그대로 구현하여 동일 조건에서 비교할 것.

2. **실시간성 보장**: 강화학습 추론이 실시간 반송 요청에 대응할 수 있도록 추론 시간이 충분히 짧아야 한다. 모델 경량화 또는 추론 캐시 전략 필요.

3. **멀티 에이전트 확장**: 단일 캐리어 최적 경로에서 시작하여, 점진적으로 다중 캐리어 동시 경로 계획(MAPF)으로 확장하는 전략 권장.

4. **데이터 변환 품질**: THiRA-MCS의 Samsung Gas 프로젝트 특화 필드(예: isCap, decompTime 등)와 범용 MCS 필드를 구분하여, 연구 프로토타입에는 범용 필드만 채택할 것.

### 7.2 프로젝트 관리 고려사항
1. **MCS와 RTD의 병렬 개발**: MCS 반송 엔진과 RTD 룰 빌더는 인터페이스 스펙만 합의하면 병렬 개발 가능. 통합 시점(9주차)까지 인터페이스 안정화 필수.

2. **시뮬레이션 데이터 준비**: 실제 Samsung Gas 데이터 사용이 어려울 수 있으므로, 공개 벤치마크(OpenTCS 시나리오 등)를 기반으로 가상 데이터셋 구성 필요.

3. **오픈소스 활용**: 연구계획서에 명시된 대로 OpenTCS 구조를 참고하되, 자사 MCS의 Macro-Micro 구조가 더 실무적이므로 이를 주 참고로 하고 OpenTCS는 보조 참고로 활용.

### 7.3 리스크
| 리스크 | 영향 | 대응 방안 |
|--------|------|----------|
| 강화학습 수렴 실패 | AI 경로 최적화 미달성 | 보상 함수 다변화, 기존 A* + 부분 AI 하이브리드 대안 |
| 실시간 추론 지연 | 반송 대기 시간 증가 | 모델 경량화, 추론 결과 캐싱, GPU 활용 |
| RTD-MCS 통합 지연 | 통합 테스트 기간 부족 | 인터페이스 조기 확정, 모의(Mock) 서비스 활용 |
| 시뮬레이션 신뢰성 부족 | 검증 결과의 실무 적용성 낮음 | 실제 MCS 데이터 구조 최대한 반영, 다양한 시나리오 |

---

## 부록: MCS 서비스 패키지 구조 상세

```
com.thirautech.service.mcs/
├── entity/                          # 100+ 엔티티 파일
│   ├── Tms*VO.java                 # MCS 핵심 엔티티 (Equipment, Carrier, Command 등)
│   ├── Tms*VO_PK.java             # 복합키 클래스
│   ├── Tms*HistVO.java            # 이력 테이블 엔티티
│   ├── Dms*VO.java                # 디스패칭 룰 엔티티
│   └── McsEventLogVO.java         # MCS 이벤트 로그
│
├── repository/                      # JPA 리포지토리
│   ├── Tms*Repository.java         # 기본 CRUD
│   ├── *ReadOnlyRepository.java   # 읽기 전용 (캐시 활용)
│   └── ReadOnlyRepository.java     # 읽기 전용 기본 클래스
│
├── impl/                           # 서비스 구현체 (CRUD 레이어)
│   └── Tms*ServiceImpl.java       # 각 엔티티별 서비스 구현
│
├── factory/                         # 비즈니스 로직 (핵심)
│   ├── TransportServiceFactory     # 반송 명령 관리
│   ├── RouteServiceFactory         # 경로 탐색
│   ├── DispatchingServiceFactory   # 디스패칭 룰 실행
│   ├── EquipmentServiceFactory     # 장비 관리
│   ├── CarrierServiceFactory       # 캐리어 관리
│   ├── AlarmServiceFactory         # 알람 관리
│   ├── HostServiceFactory          # 호스트(MES) 연계
│   ├── PolicyServiceFactory        # 정책 관리
│   ├── PortGroupServiceFactory     # 포트 그룹 관리
│   ├── StateServiceFactory         # 상태 관리
│   ├── TransferBalancingServiceFactory  # 부하 분산
│   ├── CustomColumnServiceFactory  # 커스텀 컬럼
│   ├── EventLogServiceFactory      # 이벤트 로그
│   └── impl/                       # 팩토리 구현체
│
├── base/                           # 도메인 모델
│   ├── TransferJob.java            # 반송 작업 통합 객체
│   ├── TransferRoute.java          # 경로 정보
│   ├── TransferRouteItem.java      # 경로 구간 (A* 비용 모델 포함)
│   ├── RuleQueryResult.java        # 룰 쿼리 결과
│   └── RuleQueryResultWrapper.java # 룰 쿼리 결과 래퍼
│
├── execute/                         # 실행기
│   ├── BaseExecuter.java           # 기본 실행기
│   ├── HostExecuter.java           # 호스트 명령 실행기
│   ├── UIExcuter.java              # UI 명령 실행기
│   └── MISExecuter.java            # MIS 연계 실행기
│
├── constant/                       # 상수
│   ├── MCSConstants.java           # MCS 상수 (상태, 이벤트, 플래그 등)
│   └── RTDConstants.java           # RTD 상수 (에러 코드 등)
│
├── utils/                          # 유틸리티
│   ├── BeanUtil.java
│   ├── MCSJsonUtils.java
│   ├── MCSUtiles.java
│   └── MESUtiles.java
│
├── cron/                           # 배치
│   └── DataSummaryBatch.java       # 데이터 집계 배치
│
└── TmsCarrierService.java          # 서비스 인터페이스 (예시)
```
