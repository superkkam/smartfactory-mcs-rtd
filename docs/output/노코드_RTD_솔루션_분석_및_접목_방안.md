# 노코드 RTD 솔루션 분석 및 자사 솔루션 접목 방안

> 작성일: 2026-03-27
> 프로젝트: 노코드 디스패칭 룰 빌더와 AI 경로 최적화를 적용한 스마트팩토리 MCS-RTD 통합 제어 플랫폼 개발
> 참여기업: LS티라유텍

---

## 목차

1. [연구 프로젝트 개요](#1-연구-프로젝트-개요)
2. [자사 RTD 솔루션 분석 (Dms 엔티티 구조)](#2-자사-rtd-솔루션-분석-dms-엔티티-구조)
3. [getBestLotList / getBestDataByRule 메서드 상세 분석](#3-getbestlotlist--getbestdatabyrule-메서드-상세-분석)
4. [노코드 RTD 접목 방안](#4-노코드-rtd-접목-방안)
5. [구현 로드맵](#5-구현-로드맵)

---

## 1. 연구 프로젝트 개요

### 1.1 프로젝트명
**노코드 디스패칭 룰 빌더와 AI 경로 최적화를 적용한 스마트팩토리 MCS-RTD 통합 제어 플랫폼 개발**

### 1.2 배경 및 필요성
반도체 제조 공정에서 OHT(Overhead Hoist Transport) 등 물류 자동화 장비의 디스패칭(Dispatching) 룰은 현재 **개발자가 직접 코드를 수정**해야만 변경 가능한 구조이다. 이로 인해:
- 현장 엔지니어가 룰 변경 시마다 개발팀에 의존
- 룰 검증 및 배포까지 수일~수주 소요
- 긴급 상황 대응 불가

### 1.3 3대 핵심 개발 모듈

| 모듈 | 명칭 | 주요 기능 |
|------|------|-----------|
| Module 1 | **RTD 노코드 룰 빌더** | UI 기반 디스패칭 룰 생성·수정·시뮬레이션 |
| Module 2 | **MCS 반송 제어 + AI 경로 최적화** | 반송 명령 생성 및 AI 기반 최적 경로 결정 |
| Module 3 | **통합 모니터링** | 실시간 룰 실행 현황 및 성능 지표 대시보드 |

### 1.4 정량적 목표

| 지표 | 목표치 |
|------|--------|
| 룰 생성 시간 단축 | 50% 이상 감소 |
| 반송 효율 개선 | 20% 이상 향상 |
| 룰 변경 배포 시간 | 수일 → 즉시 적용 |

---

## 2. 자사 RTD 솔루션 분석 (Dms 엔티티 구조)

### 2.1 전체 엔티티 계층 관계도

```
[이벤트 발생]
      │
      ▼
DmsRuleObjectVO          ← 장비(ruleObjectId) + 이벤트(ruleEventId) → 룰그룹(ruleGroupId) 매핑
      │
      ▼
DmsRuleGroupDefVO        ← 룰 그룹 정의 (FIFO, Priority, EQP_FULL, EQP_EMPTY 등)
      │
      ▼
DmsRuleRelationVO        ← 룰 실행 순서(sequence), 제어 흐름 (isMandatory, jumpNextSequence, filterSequence)
      │
      ▼
DmsRuleDefVO             ← 개별 룰 정의 (ruleType, ruleCondition)
      │
      ▼
DmsRuleClassVO           ← 룰 타입 분류 (Data / SubData / Filter / Join / Groupby / Sort / Method)
      │
    ┌─┴─────────────────────┐
    ▼                       ▼
DmsRuleQueryVO          DmsRuleSortVO
(SQL 쿼리 문자열)        (정렬 기준: 컬럼, 가중치, 백분율)
    │
    ▼
DmsRuleQueryParamVO      ← 쿼리 바인딩 파라미터 (value, targetColumn)

[실행 후 이력 저장]
DmsRuleRunningResultVO   ← 실행 결과 로그 (lotId, portId, sequence, priority, result, startTime, endTime)
```

### 2.2 엔티티별 상세 분석

#### 2.2.1 DmsRuleObjectVO (테이블: DMS_RULE_OBJECT)
장비와 이벤트를 특정 룰 그룹에 연결하는 **진입점(Entry Point)** 역할

| 필드 | 컬럼 | 설명 |
|------|------|------|
| `ruleObjectId` | RULE_OBJECT_ID (PK) | 장비 단위 ID (예: 특정 OHT 포트) |
| `ruleEventId` | RULE_EVENT_ID (PK) | 이벤트 유형 ID (예: LOAD_REQUEST, UNLOAD_REQUEST) |
| `ruleGroupId` | RULE_GROUP_ID | 연결된 룰 그룹 ID |
| `siteId` | SITE_ID (PK) | 사이트 식별자 |
| `isUsable` | IS_USABLE | 사용 여부 (Usable/UnUsable) |

> **노코드 접목 포인트**: 이벤트-장비-룰그룹 매핑을 UI에서 드래그앤드롭으로 구성 가능

---

#### 2.2.2 DmsRuleGroupDefVO (테이블: DMS_RULE_GROUP_DEF)
여러 룰을 묶는 **룰 그룹 컨테이너**

| 필드 | 컬럼 | 설명 |
|------|------|------|
| `ruleGroupId` | RULE_GROUP_ID (PK) | 룰 그룹 고유 ID |
| `ruleGroupName` | RULE_GROUP_NAME | 룰 그룹 이름 (사람이 읽기 좋은 이름) |
| `ruleGroupType` | RULE_GROUP_TYPE | 그룹 유형 (예: DISPATCHING, ROUTING) |
| `isUsable` | IS_USABLE | 사용 여부 |
| `description` | DESCRIPTION | 설명 |

> **특수 예약 그룹**: `EQP_FULL`, `EQP_EMPTY`, `EQP_COMMON` — 장비별 전용 룰이 없을 때 Fallback으로 사용

---

#### 2.2.3 DmsRuleRelationVO (테이블: DMS_RULE_RELATION)
룰 그룹 내에서 **룰 실행 순서와 제어 흐름**을 정의하는 핵심 엔티티

| 필드 | 컬럼 | 설명 |
|------|------|------|
| `ruleGroupId` | RULE_GROUP_ID (PK) | 속한 룰 그룹 |
| `ruleId` | RULE_ID (PK) | 실행할 룰 |
| `sequence` | SEQUENCE (PK) | 실행 순서 번호 |
| `ruleQueryId` | RULE_QUERY_ID | 연결된 쿼리 ID |
| `ruleQueryClassId` | RULE_QUERY_CLASS_ID | 쿼리 클래스 |
| `ruleQueryVersion` | RULE_QUERY_VERSION | 쿼리 버전 |
| `isMandatory` | IS_MANDATORY | **필수 여부**: `Y`=필수, `N`=선택, `O`=조건부 |
| `isGroup` | IS_GROUP | 그룹 여부 |
| `filterSequence` | FILTER_SEQUENCE | 참조할 이전 시퀀스 번호 (데이터 복원용) |
| `jumpNextSequence` | JUMP_NEXT_SEQUENCE | 조건 만족 시 건너뛸 시퀀스 번호 |
| `jumpNextSequenceCondition` | JUMP_NEXT_SEQUENCE_CONDITION | 점프 조건 (`COUNT>0`, `COUNT=0`) |
| `ruleSortId` | RULE_SORT_ID | 연결된 정렬 ID |
| `ruleSortVersion` | RULE_SORT_VERSION | 정렬 버전 |

> **노코드 접목 포인트**: 이 엔티티의 모든 필드가 UI 빌더에서 시각적으로 편집되어야 할 핵심 속성들

---

#### 2.2.4 DmsRuleDefVO (테이블: DMS_RULE_DEF)
**개별 룰의 메타 정의**

| 필드 | 컬럼 | 설명 |
|------|------|------|
| `ruleId` | RULE_ID (PK) | 룰 고유 ID |
| `ruleName` | RULE_NAME | 룰 이름 |
| `ruleClassId` | RULE_CLASS_ID | 룰 클래스 분류 (FK → DmsRuleClassVO) |
| `ruleType` | RULE_TYPE | 룰 유형 |
| `ruleCondition` | RULE_CONDITION | 룰 적용 조건 |

---

#### 2.2.5 DmsRuleClassVO (테이블: DMS_RULE_CLASS)
**룰 타입 카탈로그** — 각 룰이 어떤 방식으로 동작하는지 분류

| 필드 | 컬럼 | 설명 |
|------|------|------|
| `ruleClassId` | RULE_CLASS_ID (PK) | 클래스 ID |
| `ruleClassName` | RULE_CLASS_NAME | 클래스 이름 |
| `ruleClassType` | RULE_CLASS_TYPE | **동작 유형**: Data / SubData / Filter / Join / Groupby / Sort / Method |

**ruleClassType 값 설명**:

| 타입 | 역할 |
|------|------|
| `Data` | 초기 데이터 조회 (SQL 실행 → 결과를 lstResult로 설정) |
| `SubData` | 분기점 마커 (데이터 저장/참조용 체크포인트) |
| `Filter` | 필터링 (SQL 결과와 lstResult 교집합) |
| `Join` | 두 시퀀스 결과를 JOIN하여 결합 |
| `Groupby` | 특정 컬럼 기준 그룹핑 및 COUNT 집계 |
| `Sort` | 최종 결과 정렬 |
| `Method` | 커스텀 Java 메서드 호출 (특수 로직) |

---

#### 2.2.6 DmsRuleQueryVO (테이블: DMS_RULE_QUERY)
**실행할 SQL 쿼리 저장소**

| 필드 | 컬럼 | 설명 |
|------|------|------|
| `ruleQueryId` | RULE_QUERY_ID (PK) | 쿼리 ID |
| `ruleQueryClassId` | RULE_QUERY_CLASS_ID (PK) | 쿼리 클래스 ID |
| `ruleQueryVersion` | RULE_QUERY_VERSION (PK) | 버전 (변경 이력 관리) |
| `ruleQueryType` | RULE_QUERY_TYPE | 쿼리 유형 |
| `ruleQueryString` | RULE_QUERY_STRING | **실제 SQL 쿼리 문자열** (최대 4000자) |

> **노코드 핵심 포인트**: `ruleQueryString` 필드가 현재는 개발자가 직접 SQL을 작성한다. 노코드 전환 시 이 필드를 UI 빌더가 자동 생성해야 함

---

#### 2.2.7 DmsRuleQueryParamVO (테이블: DMS_RULE_QUERY_PARAM)
**쿼리 실행 시 바인딩 파라미터**

| 필드 | 컬럼 | 설명 |
|------|------|------|
| `ruleQueryParamId` | RULE_QUERY_PARAM_ID (PK) | 파라미터 ID |
| `value` | VALUE | 파라미터 값 (동적 변수 참조 가능) |
| `targetColumn` | TARGET_COLUMN | 쿼리에서 매핑할 컬럼명 |

---

#### 2.2.8 DmsRuleSortVO (테이블: DMS_RULE_SORT)
**정렬 기준 정의** (단순 ORDER BY를 넘어선 가중치 기반 정렬 지원)

| 필드 | 컬럼 | 설명 |
|------|------|------|
| `ruleSortId` | RULE_SORT_ID (PK) | 정렬 ID |
| `ruleSortVersion` | RULE_SORT_VERSION (PK) | 버전 |
| `ruleSortType` | RULE_SORT_TYPE | 정렬 유형 |
| `sortColumn` | SORT_COLUMN | 정렬 컬럼명 |
| `fromPercent` | FROM_PERCENT | 적용 범위 시작 백분율 |
| `toPercent` | TO_PERCENT | 적용 범위 끝 백분율 |
| `standardValue` | STANDARD_VALUE | 기준값 |
| `weightValue` | WEIGHT_VALUE | 가중치 |
| `orderBy` | ORDER_BY | ASC / DESC |

---

#### 2.2.9 DmsRuleRunningResultVO (테이블: DMS_RULE_RUNNING_RESULT)
**룰 실행 이력 및 감사 로그**

| 필드 | 컬럼 | 설명 |
|------|------|------|
| `UUID` | UUID (PK) | 자동 생성 고유 키 |
| `lotId` | LOT_ID | 처리 대상 Lot ID |
| `portId` | PORT_ID | 포트 ID |
| `ruleId` | RULE_ID | 실행된 룰 ID |
| `sequence` | SEQUENCE | 실행 시퀀스 번호 |
| `priority` | PRIORITY | 우선순위 값 |
| `isMandatory` | IS_MANDATORY | 필수 여부 (실행 시점 값) |
| `result` | RESULT (LOB) | **실행 결과 JSON/XML** |
| `isDispatching` | IS_DISPATCHING | 디스패칭 적용 여부 |
| `count` | COUNT | 결과 건수 |
| `startTime` / `endTime` | START_TIME / END_TIME | 실행 시간 |
| `carrierId` | CARRIER_ID | 캐리어 ID |

> **노코드 접목 포인트**: 이 테이블 데이터를 시각화하면 "어떤 룰이 실제로 동작했는지" 실시간 모니터링 대시보드 구성 가능

---

## 3. getBestLotList / getBestDataByRule 메서드 상세 분석

### 3.1 getBestLotList 전체 흐름

```
getBestLotList(eventInfo, param, ruleEventId)
│
├── 1. 장비 단위 정보 조회
│     equipmentServiceFactory.getEquipmentUnit(...)
│     → TmsEquipmentUnitVO (장비의 fullEmptyType 포함)
│
├── 2. 룰 목록 탐색 (3단계 Fallback)
│     Step 1: equipmentUnitId 전용 룰 조회
│             getDispatchingRuleList(siteId, equipmentUnitId, ruleEventId)
│     Step 2: 없으면 FullEmptyType 기반 공통 룰 조회
│             - Full  → getDispatchingRuleList(siteId, "EQP_FULL", ruleEventId)
│             - Empty → getDispatchingRuleList(siteId, "EQP_EMPTY", ruleEventId)
│     Step 3: 그래도 없으면 → null 반환 (룰 미적용)
│
└── 3. 룰 실행
      getBestDataByRule(eventInfo, lstDispatchingRule, param, dmsEquipmentUnit)
```

> **노코드 접목 포인트**: 3단계 Fallback 구조(`장비전용 → EQP_FULL/EMPTY → EQP_COMMON`)는 노코드 UI에서 **룰 적용 범위(scope)** 설정으로 표현 가능

---

### 3.2 getBestDataByRule 핵심 로직 분석

핵심 메서드 위치: `DispatchingServiceFactoryImpl.java:742`

#### 3.2.1 상태 관리 변수

```java
// 시퀀스별 중간 결과 저장 맵
Map<Integer, List<Map<String, Object>>> dataSaveMap       // sequence → 해당 시점 결과
Map<Integer, List<Map<String, Object>>> beforFilterDataSaveMap  // Filter 적용 직전 결과 저장

int stordJumpSequence = 0;  // 조건부 점프 목적지 (0이면 점프 없음)
List<String> lstOrderBy;    // Sort 룰 누적 정렬 조건
```

#### 3.2.2 룰 타입별 처리 로직 상세

**① Data 타입** (초기 데이터 조회)
```
SQL 실행 → lstResult 초기화
dataSaveMap[sequence] = lstResult
INNER_JOIN 옵션: ruleProcessKey 컬럼으로 기존 lstResult와 조인 후 설정
```

**② SubData 타입** (체크포인트 마커)
```
stordJumpSequence == sequence 이면 stordJumpSequence 초기화
dataSaveMap[sequence] = 현재 lstResult (저장만, 변경 없음)
→ Jump 목적지의 "랜딩 포인트" 역할
```

**③ Filter 타입** (핵심 필터링 로직)
```
[점프 상태 처리]
  stordJumpSequence != 0 AND sequence != stordJumpSequence → 해당 시퀀스 스킵
  stordJumpSequence == sequence → 점프 해제

[비활성 처리]
  isUsable == "UnUsable" → continue (스킵)

[데이터 참조점 복원]
  filterSequence != 0 → lstResult = dataSaveMap[filterSequence]
  (이전 시퀀스의 결과를 기준으로 필터링)

[필터 실행]
  lstFilterData = SQL 실행
  lstFilterResult = lstResult ∩ lstFilterData (교집합)
  beforFilterDataSaveMap[sequence] = 필터 적용 전 lstResult

[isMandatory 처리]
  "Y" → 반드시 lstResult = lstFilterResult (비어있어도 덮어씀)
  "N" → lstFilterResult가 비어있으면 lstResult 그대로 유지
  "O" → lstFilterResult가 비어있으면 "N"처럼, 있으면 "Y"처럼 동작

[점프 처리]
  jumpNextSequence > 0 이면 조건 체크:
  - "COUNT>0" + 결과 있음 → stordJumpSequence = jumpNextSequence
  - "COUNT=0" + 결과 없음 → stordJumpSequence = jumpNextSequence

dataSaveMap[sequence] = lstFilterResult
```

**④ Join 타입** (두 시퀀스 결과 결합)
```
filterSequence = "seq1,seq2" (CSV)
  data[0] = dataSaveMap[seq1]
  data[1] = dataSaveMap[seq2]
  ruleQueryString = "JOIN_KEY1,JOIN_KEY2" (조인 키 컬럼)
  lstJoinData = data[0] JOIN data[1] on joinKeyList

isMandatory 처리 (Filter와 동일)

Mandatory=N AND lstJoinData 비어있음 → lstResult = beforFilterDataSaveMap[seq1]
  (Join 실패 시 Join 전 상태로 롤백)

dataSaveMap[sequence] = lstJoinData
점프 처리 (Filter와 동일)
```

**⑤ Groupby 타입** (집계)
```
ruleProcessKey = "COL1,COL2" (그룹핑 기준 컬럼)
lstResult를 groupByColumns 기준으로 Stream.groupingBy
각 그룹: {COL1:val, COL2:val, COUNT:n}
lstResult = 집계 결과 리스트
```

**⑥ Sort 타입** (정렬)
```
ruleSortColumn이 비어있으면:
  ruleQueryString을 lstOrderBy에 누적
  마지막 시퀀스에 도달하면 → getRuleSortData(lstResult, lstOrderBy) 실행
  중간 시퀀스면 → 누적만 하고 break
```

#### 3.2.3 실행 흐름 예시 (Priority Dispatching)

```
Sequence 1: Data    → "현재 가용 Lot 전체 조회"         → lstResult = [100개]
Sequence 2: Filter  → "금지 Lot 제외 (isMandatory=N)"   → lstResult = [95개]
Sequence 3: SubData → (체크포인트, seq3에 저장)          → dataSaveMap[3] = [95개]
Sequence 4: Filter  → "Priority A 필터 (filterSequence=3, jumpNextSequence=6, COUNT>0)"
                      결과 있음 → stordJumpSequence = 6 → lstResult = [20개]
Sequence 5: Filter  → (스킵: sequence 5 != stordJumpSequence 6)
Sequence 6: SubData → (점프 목적지 도착, stordJumpSequence = 0)  → dataSaveMap[6] = [20개]
Sequence 7: Sort    → "우선순위 컬럼 내림차순 정렬"       → lstResult = [정렬된 20개]
→ 최종 반환: 상위 Lot 리스트
```

---

### 3.3 현재 하드코딩 요소 vs 노코드 전환 대상

| 구분 | 현재 구현 방식 | 노코드 전환 방안 |
|------|--------------|----------------|
| SQL 쿼리 작성 | 개발자가 `ruleQueryString` 직접 입력 | UI 쿼리 빌더로 조건 설정 → SQL 자동 생성 |
| 룰 실행 순서 | DB 레코드 수동 입력 | 드래그앤드롭 순서 편집 UI |
| isMandatory 설정 | DB 레코드 직접 수정 | 토글/드롭다운으로 Y/N/O 선택 |
| filterSequence 참조 | 시퀀스 번호 직접 입력 | 화살표 연결로 시각적 참조 |
| jumpNextSequence 조건 | 시퀀스 번호 + 조건 직접 입력 | 조건 블록 + 분기 화살표 UI |
| Fallback 룰 그룹 | EQP_FULL/EQP_EMPTY/EQP_COMMON 하드코딩 | 룰 그룹 계층 트리 편집기 |
| 정렬 기준 | `sortColumn`, `orderBy` 직접 입력 | 컬럼 선택 + 오름차순/내림차순 UI |
| 파라미터 바인딩 | `targetColumn`, `value` 직접 입력 | 파라미터 키-값 편집기 |

---

## 4. 노코드 RTD 접목 방안

### 4.1 노코드 룰 빌더 아키텍처 설계

```
┌─────────────────────────────────────────────────────────────────┐
│                    노코드 RTD 룰 빌더 UI                         │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────────┐   │
│  │ 룰 그룹 관리  │   │  룰 시퀀스    │   │  쿼리/정렬 편집기  │   │
│  │  (트리 뷰)   │──▶│  (플로우 차트) │──▶│  (조건 빌더)      │   │
│  └─────────────┘   └──────────────┘   └───────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    시뮬레이터                             │   │
│  │         (룰 저장 전 테스트 실행 및 결과 미리보기)           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (저장 시 엔티티 생성/수정)
┌─────────────────────────────────────────────────────────────────┐
│              자사 기존 RTD 엔티티 레이어 (재사용)                  │
│                                                                 │
│  DmsRuleObjectVO → DmsRuleGroupDefVO → DmsRuleRelationVO        │
│  → DmsRuleDefVO → DmsRuleClassVO → DmsRuleQueryVO               │
│  → DmsRuleQueryParamVO / DmsRuleSortVO                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (실행 엔진 재사용)
┌─────────────────────────────────────────────────────────────────┐
│         기존 DispatchingServiceFactoryImpl 실행 엔진 (재사용)      │
│                                                                 │
│   getBestLotList() → getDispatchingRuleList() → getBestDataByRule()│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              DmsRuleRunningResultVO (실행 이력 저장)               │
│                  → 실시간 모니터링 대시보드                          │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 핵심 설계 원칙: 기존 엔티티 구조 완전 재사용

자사 솔루션의 엔티티 구조는 이미 상당히 유연하게 설계되어 있어 **DB 스키마 변경 없이** 노코드 빌더를 구현할 수 있다.

| 기존 엔티티 | 노코드 UI 매핑 |
|------------|--------------|
| `DmsRuleGroupDefVO` | 룰 그룹 생성 폼 (이름, 타입, 설명) |
| `DmsRuleObjectVO` | 장비-이벤트-룰그룹 매핑 설정 패널 |
| `DmsRuleRelationVO` | 플로우 차트의 **노드(Node)** — 각 박스가 하나의 Relation 레코드 |
| `DmsRuleDefVO` | 룰 이름·타입 입력 폼 |
| `DmsRuleClassVO` | 노드 타입 선택 드롭다운 (Data/Filter/Sort...) |
| `DmsRuleQueryVO.ruleQueryString` | **쿼리 빌더가 자동 생성하는 SQL** |
| `DmsRuleQueryParamVO` | 파라미터 바인딩 편집 테이블 |
| `DmsRuleSortVO` | 정렬 조건 추가/삭제 UI |
| `DmsRuleRunningResultVO` | 실시간 실행 로그 테이블 및 차트 |

### 4.3 UI 구성 요소별 접목 방안

#### 4.3.1 룰 플로우 빌더 (핵심 화면)

**현재 DmsRuleRelationVO 필드 → UI 컴포넌트 매핑**

```
시퀀스 블록 하나 = DmsRuleRelationVO 레코드 하나

┌──────────────────────────────────────────┐
│  [Data] 가용 Lot 조회              [seq:1] │
│  isMandatory: [Y] [N] [O]                 │
│  isUsable: [Usable ▼]                     │
│  ──────────────────────────────────────── │
│  [쿼리 빌더 열기]  [파라미터 편집]           │
└──────────────────────────────────────────┘
           │
           │  (화살표 = filterSequence 참조)
           ▼
┌──────────────────────────────────────────┐
│  [Filter] 금지 Lot 제외            [seq:2] │
│  isMandatory: [N]                         │
│  jumpNextSequence: [6] 조건: [COUNT>0 ▼] │
│  filterSequence: [1 ▼]                    │
└──────────────────────────────────────────┘
           │
          (조건 분기 화살표)
           ├──────────────────→ seq 6 (조건 만족 시)
           ▼
         seq 3...
```

#### 4.3.2 쿼리 빌더 (SQL 자동 생성)

**목표**: 개발자가 아닌 엔지니어도 조건을 설정하면 `DmsRuleQueryVO.ruleQueryString`에 저장될 SQL을 자동 생성

```
┌──────────────────────────────────────────────┐
│ 쿼리 빌더                                      │
├──────────────────────────────────────────────┤
│ 기준 테이블: [LOT_MASTER ▼]                    │
│                                              │
│ 조건 추가:                                    │
│  + [LOT_PRIORITY ▼] [= ▼] ['A' ▼]           │
│  + [HOLD_FLAG ▼] [= ▼] ['N' ▼]              │
│                                              │
│ 반환 컬럼: [LOT_ID ☑] [PRIORITY ☑] [EQP ☑] │
│                                              │
│ [미리보기 SQL]                                │
│  SELECT LOT_ID, PRIORITY, EQP_ID             │
│  FROM LOT_MASTER                             │
│  WHERE LOT_PRIORITY = 'A'                    │
│    AND HOLD_FLAG = 'N'                       │
└──────────────────────────────────────────────┘
```

생성된 SQL은 `DmsRuleQueryVO.ruleQueryString` 필드에 저장

#### 4.3.3 isMandatory 시각화

`DmsRuleRelationVO.isMandatory` 값의 의미를 엔지니어가 직관적으로 이해할 수 있도록:

| 코드 값 | UI 표시 | 의미 설명 |
|---------|---------|-----------|
| `Y` | 🔴 **필수 적용** | 결과가 비어도 강제 적용 (이전 데이터 삭제됨) |
| `N` | 🟢 **선택 적용** | 결과가 있을 때만 적용, 없으면 이전 결과 유지 |
| `O` | 🟡 **자동 결정** | 결과 있으면 Y, 없으면 N으로 동적 결정 |

#### 4.3.4 조건부 분기 (jumpNextSequence) 시각화

```
Filter 블록에서:
  [jumpNextSequence 활성화 ☑]
  조건: [COUNT > 0 ▼]
  점프 대상: [seq 6 ▼]

→ 플로우 차트에서 점선 화살표로 시각화
→ 엔지니어가 "결과 있으면 seq 6으로 건너뛰기" 직관적 이해
```

저장 시 `DmsRuleRelationVO.jumpNextSequence = 6`, `jumpNextSequenceCondition = "COUNT>0"` 자동 설정

#### 4.3.5 실시간 모니터링 (DmsRuleRunningResultVO 활용)

```
DmsRuleRunningResultVO 데이터 → 모니터링 대시보드

┌────────────────────────────────────────────────────┐
│ 현재 실행 중인 디스패칭 룰                             │
├────────────────────────────────────────────────────┤
│ LotID │ Seq │ RuleType │ 결과건수 │ 적용여부 │ 소요시간 │
│ L001  │  1  │ Data     │   100   │   -     │  12ms  │
│ L001  │  2  │ Filter   │   95    │   Y     │   8ms  │
│ L001  │  4  │ Filter   │   20    │   Y     │  15ms  │
│ L001  │  7  │ Sort     │   20    │   -     │   5ms  │
├────────────────────────────────────────────────────┤
│ 최종 선택 Lot: L001-SUB003 (Priority: A, Score: 95) │
└────────────────────────────────────────────────────┘
```

### 4.4 노코드 룰 엔진 실행 흐름 (신규 vs 기존 비교)

```
[현재 방식]
개발자 → DB 직접 수정(SQL) → 재배포 없이 적용 → getBestDataByRule() 실행
                              (단, SQL 작성은 개발 역량 필요)

[노코드 방식]
현장 엔지니어 → 노코드 UI 빌더 사용
  → 조건 블록 구성
  → 쿼리 빌더에서 SQL 자동 생성
  → DmsRuleQueryVO.ruleQueryString 자동 저장
  → DmsRuleRelationVO 레코드 자동 생성
  → 시뮬레이터로 검증
  → 즉시 적용 (재배포 불필요)
  → 기존 getBestDataByRule() 그대로 실행
```

**핵심**: 실행 엔진(`getBestDataByRule`)은 **전혀 수정하지 않음**. 오직 DB 레코드를 자동으로 생성해주는 UI 레이어만 추가.

---

## 5. 구현 로드맵

### Phase 1: 기반 분석 및 설계 (2~3주)

| 태스크 | 내용 |
|--------|------|
| 1-1 | 기존 `getDispatchingRuleList()` SQL 분석 — 어떤 테이블에서 어떤 컬럼 조인하는지 파악 |
| 1-2 | RTDConstants.RTD.RuleClassType 열거값 전체 목록 확인 |
| 1-3 | 현재 운영 중인 룰 DB 데이터 샘플 수집 및 패턴 분류 |
| 1-4 | 노코드 UI 와이어프레임 설계 (룰 플로우 빌더, 쿼리 빌더) |

### Phase 2: 노코드 룰 빌더 백엔드 API 개발 (3~4주)

| 태스크 | 내용 |
|--------|------|
| 2-1 | 룰 그룹 CRUD REST API (DmsRuleGroupDefVO) |
| 2-2 | 룰 시퀀스 CRUD REST API (DmsRuleRelationVO) |
| 2-3 | 쿼리 자동 생성 API (조건 → SQL 변환 로직) |
| 2-4 | 룰 유효성 검증 API (순환 참조, 잘못된 filterSequence 등) |
| 2-5 | 룰 시뮬레이션 API (실제 데이터로 테스트 실행) |

### Phase 3: 노코드 UI 개발 (4~5주)

| 태스크 | 내용 |
|--------|------|
| 3-1 | 룰 그룹 관리 화면 (트리 구조, Fallback 계층 시각화) |
| 3-2 | 룰 플로우 빌더 화면 (드래그앤드롭 시퀀스 편집) |
| 3-3 | 쿼리 빌더 UI (조건 설정 → SQL 자동 생성) |
| 3-4 | isMandatory / jumpNextSequence 시각적 편집 UI |
| 3-5 | 시뮬레이션 결과 화면 |

### Phase 4: 실시간 모니터링 대시보드 (2~3주)

| 태스크 | 내용 |
|--------|------|
| 4-1 | DmsRuleRunningResultVO 기반 실시간 로그 조회 API |
| 4-2 | 룰 실행 통계 집계 (RuleClassType별 평균 소요시간, 히트율) |
| 4-3 | 실시간 대시보드 화면 (시퀀스별 결과 건수 변화 시각화) |
| 4-4 | 룰 성능 분석 화면 (어떤 Filter룰이 가장 효과적인지) |

### Phase 5: 검증 및 최적화 (2주)

| 태스크 | 내용 |
|--------|------|
| 5-1 | 실제 운영 룰을 노코드 UI로 재현하여 동일 결과 검증 |
| 5-2 | 엔지니어 사용자 테스트 (비개발자가 룰 생성 가능한지 검증) |
| 5-3 | 룰 생성 시간 측정 (기존 대비 50% 단축 목표 검증) |
| 5-4 | 성능 테스트 (노코드 생성 룰 vs 기존 룰 실행 속도 비교) |

### 최종 목표 상태

```
Before (현재):
  엔지니어 → [개발팀 요청] → 개발자 SQL 작성 → DB 반영 → 수일 소요

After (노코드 도입 후):
  엔지니어 → [노코드 UI 빌더] → 조건 설정 → 즉시 적용 → 수분 소요
                                    ↓
                     기존 getBestDataByRule() 엔진 그대로 동작
                     기존 DmsRuleRunningResultVO 이력 그대로 저장
```

---

## 부록: 주요 파일 경로 참조

| 역할 | 경로 |
|------|------|
| RTD 엔티티 디렉토리 | `reference/sgas/samsung-gas-core/thirautech-service-mcs/src/main/java/com/thirautech/service/mcs/entity/` |
| 디스패칭 핵심 로직 | `reference/sgas/.../factory/impl/DispatchingServiceFactoryImpl.java` |
| RTD 상수 정의 | `reference/sgas/.../constant/RTDConstants.java` (RuleClassType 등) |
| 룰 쿼리 서비스 | `reference/sgas/.../DmsRuleQueryService.java` |
| 커스텀 룰 서비스 | `reference/sgas/.../DmsRuleCustomService.java` (readDispatchingRuleList) |
