# THiRA-TB Modeler 솔루션 분석 및 연구과제 접목 방안

> **작성일**: 2026-03-27
> **대상 솔루션**: THiRA-TB Modeler (MCS_UI/THiRA-TB.UI/webapp/Modeler/)
> **연구과제**: 노코드 디스패칭 룰 빌더와 AI 경로 최적화를 적용한 스마트팩토리 MCS-RTD 통합 제어 플랫폼 개발
> **참여기업**: LS티라유텍

---

## 목차

1. [분석 대상 요약](#1-분석-대상-요약)
2. [현재 솔루션 분석](#2-현재-솔루션-분석)
   - 2.1 전체 파일 구성 및 모듈 관계
   - 2.2 ModelerDesigner — 공장 레이아웃 편집기 핵심 분석
   - 2.3 FABMonitoring — 실시간 모니터링 분석
   - 2.4 심볼 라이브러리 구조 분석
   - 2.5 강점 및 한계
3. [연구 프로젝트 매핑](#3-연구-프로젝트-매핑)
   - 3.1 활용 가능한 구현 요소
   - 3.2 연구 목적에 맞게 개선할 부분
   - 3.3 신규 개발 필요 사항
4. [구현 방향 제안](#4-구현-방향-제안)
   - 4.1 핵심 아키텍처
   - 4.2 기술 스택 전환 방안
   - 4.3 단계별 구현 계획
   - 4.4 검증 방법
5. [핵심 고려사항](#5-핵심-고려사항)

---

## 1. 분석 대상 요약

**Modeler는 RTD 룰과 완전히 별개의 독립 시스템이다.**

Modeler의 역할은 다음 두 가지이다:

1. **공장 레이아웃 및 기준정보 구성 (Modeling)**
   - 공장 내 설비(Stocker, Conveyor, Process), 유닛(Port, Crane, AGV), 물류 시스템(OHT/LHT, 컨베이어 라인), 제어 시스템(CCS/ACS/OCS)을 2D 캔버스에 배치
   - 각 장비에 `EQUIPMENT_ID`, `EQUIPMENT_UNIT_ID`, `EC_SERVER_NAME`, 경로 가중치(`WEIGHT`) 등 **기준정보** 입력
   - 장비 간 연결선(Relation) 설정으로 물류 경로 정의
   - 완성된 레이아웃을 JSON으로 DB에 저장

2. **실시간 모니터링 (Monitoring)**
   - 저장된 레이아웃 위에 실시간 장비 상태 및 캐리어 이동을 오버레이
   - 층별(1F/3F/S1F/S2F/S3F) 화면으로 공장 전체 물류 흐름 시각화

> **RTD 룰(디스패칭 룰)은 별도 시스템이며, Modeler와 직접적으로 연결되지 않는다.**
> 두 시스템이 공유하는 것은 `EQUIPMENT_ID`/`EQUIPMENT_UNIT_ID` 같은 **기준정보(마스터 데이터)**뿐이다.

---

## 2. 현재 솔루션 분석

### 2.1 전체 파일 구성 및 모듈 관계

```
Modeler/
├── ModelerDesigner.js/html         ← [핵심] 공장 레이아웃 편집기
│     ├── 심볼 팔레트 (좌측 도구상자)
│     ├── HT GraphView 캔버스 (중앙)
│     ├── 속성 패널 (우측)
│     └── 툴바 (Undo/Redo, Grid, Zoom 등)
│
├── BSN_FABMonitoring_B5_*.js/html  ← 층별 실시간 모니터링 (읽기 전용)
│     ├── 1F, 3F, S1F, S2F, S3F (5개 층)
│     ├── 저장된 레이아웃 JSON 로드 → 화면 표시
│     ├── 폴링 방식 장비 상태 조회
│     └── LHT/Stocker 크레인 및 캐리어 애니메이션
│
├── ModelerProperty.js/html         ← 심볼별 표시 속성 관리
├── ModelerPropertyAssign.js/html   ← 심볼-표시 컬럼 매핑 설정
├── ModelerManagement.js/html       ← 레이아웃 관리 (iframe)
├── ModelerPreview.js/html          ← 레이아웃 미리보기
├── ModelerVersion.js/html          ← 레이아웃 버전 관리
├── ModelerExtValue.js/html         ← 확장 값 설정
│
└── symbols/sem/                    ← 공장 심볼 라이브러리 (80개)
      ├── STOCKER.json/png          (300x45, 벡터)
      ├── CONVEYOR*.json/png        (다양한 길이/각도: 4/8/16/32/90°)
      ├── PORT*.json/png            (2D/3D, TB/LR 방향)
      ├── LHT.json, LHT_line.json   (선형 호이스트 트랜스포트)
      ├── CRANE.json/png
      ├── AGV.json/png
      ├── Carrier.json/png          (반송 캐리어)
      ├── Lift_L/S/mini.json/png    (리프트 대/소/미니)
      ├── BOX.json/png
      ├── wall.json/png
      ├── MAZ.json                  (MAZ 장비)
      ├── BUFFER_Lift.json
      └── *_bg*.json/png            (층별 배경 레이아웃)
```

**모듈 간 데이터 흐름**:

```
[ModelerDesigner — 편집 도구]
     │
     │ 레이아웃 배치 + 기준정보 입력
     │ (EQUIPMENT_ID, 연결 경로, WEIGHT 등)
     │
     ▼ serialize() → JSON
[DB 저장: SetMdlDesign]
     │
     │ deserialize() ← JSON
     ▼
[BSN_FABMonitoring — 모니터링 뷰어]
     │
     ├── 레이아웃 표시 (읽기 전용)
     ├── 장비 상태 오버레이 (폴링)
     └── 캐리어 이동 애니메이션
```

---

### 2.2 ModelerDesigner — 공장 레이아웃 편집기 핵심 분석

#### 2.2.1 핵심 라이브러리

**HT for Web (ht.js)** — 산업용 상용 그래프/다이어그램 라이브러리

| HT 컴포넌트 | 용도 |
|-------------|------|
| `ht.graph.GraphView` | 2D 캔버스 (노드/엣지 렌더링, 줌/패닝) |
| `ht.DataModel` | 전체 그래프 데이터 모델 (serialize/deserialize) |
| `ht.Node` | 장비 심볼 노드 |
| `ht.Edge` | 장비 간 연결선 |
| `ht.widget.Toolbar` | 상단 도구 모음 |
| `ht.graph.Overview` | 미니맵 (전체 레이아웃 조감) |
| `ht.widget.SplitView` | 팔레트 / 캔버스 / 속성 패널 분할 |
| `HistoryManager` | Undo/Redo 이력 관리 |

#### 2.2.2 심볼 분류 체계

```javascript
const ARRAY_SYMBOL_EQ     = ["Stocker", "Conveyor", "Process"];      // 장비 본체
const ARRAY_SYMBOL_UNIT   = ["Port", "Crane", "AGV"];                 // 장비 단위 (입출구 포트 등)
const ARRAY_SYMBOL_RELATION = ["Relation"];                            // 장비 간 연결선
const ARRAY_SYMBOL_SYSTEM = ["CCS", "ACS", "OCS"];                   // 제어 시스템 서버
const ARRAY_SYMBOL_ETC    = ["TextBox", "Shape", "Progress", "Node"]; // 보조 요소
```

| 분류 | 심볼 예시 | 핵심 속성 | 의미 |
|------|-----------|-----------|------|
| Equipment | Stocker, Conveyor, Process | `EQUIPMENT_ID` | 물류 장비 본체 |
| Unit | Port, Crane, AGV | `EQUIPMENT_UNIT_ID` | 장비의 물리적 입출구·조작 단위 |
| System | CCS, ACS, OCS | `EC_SERVER_NAME` | 해당 구역의 장비 제어 서버 |
| Relation | Edge(연결선) | `DEPARTURE_EQUIPMENT`, `ARRIVAL_EQUIPMENT`, `TRANSPORT_EQUIPMENT`, `WEIGHT` | 장비 간 물류 경로 |

#### 2.2.3 기준정보 입력 구조

각 심볼 노드에 저장되는 **기준정보 속성**:

```
장비 노드 (Equipment)
├── EQUIPMENT_ID          ← 장비 고유 ID (예: B1STK101)
├── EQUIPMENT_TYPE        ← 장비 유형 (STOCKER, CONVEYOR 등)
└── INLINE_STOCKER        ← 인라인 스토커 여부 (Y/N)

유닛 노드 (Unit)
└── EQUIPMENT_UNIT_ID     ← 유닛 고유 ID (예: B1STK101_AI01)

제어 시스템 노드 (System)
└── EC_SERVER_NAME        ← 제어 서버 ID (ACS, CCS 등)

연결선 (Relation/Edge) — Port to Port만 허용
├── DEPARTURE_EQUIPMENT        ← 출발 장비 ID
├── DEPARTURE_EQUIPMENT_UNIT   ← 출발 유닛 ID
├── ARRIVAL_EQUIPMENT          ← 도착 장비 ID
├── ARRIVAL_EQUIPMENT_UNIT     ← 도착 유닛 ID
├── TRANSPORT_EQUIPMENT        ← 반송을 담당하는 제어 서버
└── WEIGHT                     ← 경로 가중치 (AI 경로 최적화에 활용)
```

#### 2.2.4 연결선(Relation) 생성 규칙

- **Port-to-Port 제한**: Port 심볼끼리만 연결 가능 (다른 심볼 간 연결 불가)
- **중복 연결 방지**: 동일 source→target Edge 중복 불가
- **Fixed InOut Mode**: 포트 방향 제한 (INPUT 포트는 출발점 불가, OUTPUT 포트는 도착점 불가)
- **Process Grouping Relation**: 여러 장비의 포트를 한 제어 시스템(CCS/ACS/OCS)에 묶어서 매핑 + 각 경로에 가중치(WEIGHT) 부여
- **Port Grouping Relation**: 포트 그룹 단위 연결 일괄 설정

#### 2.2.5 저장/로드 메커니즘

**저장** (`saveLayout()`):
```
1. 각 심볼의 Tag를 EQUIPMENT_ID / EQUIPMENT_UNIT_ID 등으로 설정
2. DataModel 경량화 (불필요한 Hidden Relation 제거, 검증 필수 컬럼만 유지)
3. dataModel.serialize() → JSON 직렬화
4. DB에 저장 (SetMdlDesign API): DESIGN_ID, VERSION, JSON, SITE_ID 포함
```

**로드** (`loadLayoutJsonFromDesignDB()`):
```
1. DB에서 JSON 조회 (getModelerJsonData API)
2. graphView.dm().deserialize(jsonData) → 캔버스 복원
3. dictDataModelLoaded에 스냅샷 저장 (변경 감지용)
```

---

### 2.3 FABMonitoring — 실시간 모니터링 분석

#### 2.3.1 전체 구조

FABMonitoring은 ModelerDesigner에서 저장한 레이아웃을 **읽기 전용**으로 불러와 실시간 장비 상태를 오버레이하는 뷰어다.

```
FABMonitoring.init()
├── design()         → HT GraphView + 컨테이너 마운트
├── loadMonitoring() → DB에서 레이아웃 JSON 로드 → deserialize → 화면 표시
└── event()          → 심볼 클릭 → 장비 상태 정보 팝업

timerFABData (2초 체크, 10초 주기)
└── getFABData(["EQP_STATE_INFO"])
    └── modelerUtil.getTransferResult() → modelerUtil.execMessage()

moveLHT(carrierId, fromId, toId, options)   ← LHT 크레인 이동 애니메이션
└── 4단계 체이닝:
    1. 크레인 X축 이동 → from 위치
    2. 캐리어 상승 (pick)
    3. 크레인+캐리어 X축 이동 → to 위치
    4. 캐리어 하강 (place)

moveStocker(carrierId, fromId, toId, options) ← 스토커 크레인 이동 애니메이션
```

#### 2.3.2 데이터 조회 타입

| 데이터 타입 | 설명 | 조회 시점 |
|------------|------|----------|
| `LAYOUT_INFO` | 레이아웃 JSON 정보 | 화면 진입 시 1회 |
| `TRANSFER_RESULT_INFO` | 반송 결과 및 이력 | 화면 활성화 시 |
| `STOCKER_INFO` | 스토커 내부 상태 | 화면 활성화 시 |
| `EQP_STATE_INFO` | 장비 실시간 상태 | 10초 주기 폴링 |

#### 2.3.3 경로 맵(Line Map) 구조

```javascript
var _lineMap = [
    {
        "LINE_ID": "LINE_1F_CONV_IN1",
        "MAPDATA": [
            "B1LHT101_AO01",   // LHT 출발 포트
            "B1CNV021_MI01",   // 컨베이어 1 진입
            "B1CNV022_MI01",   // 컨베이어 2 진입
            "B1CNV023_MI01",   // 컨베이어 3 진입
            "B1CNV023_MO01",   // 컨베이어 3 출구
            "B1STK101_AI03"    // Stocker 도착 포트
        ]
    }
];
```

캐리어가 실제로 이동하는 **유닛 ID 순서 목록**. 이 데이터가 AI 경로 최적화의 핵심 입력 데이터가 된다.

#### 2.3.4 WebSocket 코드 (현재 비활성)

```javascript
// 설계는 되어있으나 현재 폴링 방식으로 운영 중
var wsUri = "ws://" + location.hostname + ":" + location.port + "/" + _pageType;
// fabWebSocket.openSocket(); // 주석 처리 상태
```

---

### 2.4 심볼 라이브러리 구조 분석

#### 2.4.1 JSON 포맷 (HT for Web 전용 벡터 형식)

```json
// STOCKER.json 구조 예시 (width:300, height:45)
{
  "width": 300,
  "height": 45,
  "comps": [
    {
      "type": "shape",
      "background": "#ededed",
      "shadowColor": "#1ABC9C",
      "displayName": "stk_bg",
      "points": [...],   // 벡터 좌표 배열
      "segments": [...]  // 선 타입 지시자 (1=MoveTo, 2=LineTo, 3=CubicBezier)
    }
  ]
}
```

이 포맷은 **HT for Web 전용 독점 포맷**으로, 다른 라이브러리에서 직접 사용 불가.
React 기반으로 전환 시 SVG 또는 React 컴포넌트로 재구현이 필요하다.

#### 2.4.2 심볼 목록 및 용도

| 심볼 | 파일 | 크기 | 용도 |
|------|------|------|------|
| STOCKER | STOCKER.json/png | 300x45 | 스토커 장비 본체 |
| CONVEYOR | CONVEYOR*.json/png | 다양 | 직선/곡선 컨베이어 (4/8/16/32 길이, 90° 회전형) |
| PORT | PORT*.json/png | 9x9 | 장비 입출구 포트 (2D/3D, 방향별) |
| LHT | LHT.json, LHT_line.json | - | 선형 호이스트 트랜스포트 + 이동 경로 |
| CRANE | CRANE.json/png | - | 크레인 |
| AGV | AGV.json/png | - | 무인운반차 |
| Carrier | Carrier.json/png | - | 반송 캐리어 (이동 객체) |
| Lift | Lift_L/S/mini.json/png | - | 층간 리프트 (대/소/미니) |
| BUFFER_Lift | BUFFER_Lift.json | - | 버퍼 리프트 |
| BOX | BOX.json | - | 박스 표현 |
| wall | wall.json/png | - | 벽/경계선 |
| MAZ | MAZ.json | - | MAZ 장비 |
| 배경 | *_bg*.json/png | - | 층별 레이아웃 배경 (1F/Lift 등) |
| 3D 배경 | 3D_*.json/png | - | 3D 뷰 배경 (1F/2F/3F) |

---

### 2.5 강점 및 한계

#### 강점

| 항목 | 내용 |
|------|------|
| 완성도 높은 심볼 체계 | 반도체 공장 물류에 필요한 심볼이 모두 구비됨 (STOCKER/CONVEYOR/LHT/PORT 등) |
| 검증된 연결 규칙 | Port-to-Port 방향 검증, 중복 방지, Fixed InOut Mode 등 실제 운영에서 검증된 로직 |
| JSON 기반 저장 | 레이아웃 전체를 JSON으로 직렬화 → DB 저장/버전관리 용이 |
| 경로 가중치 설계 | WEIGHT 속성이 이미 설계되어 있어 AI 경로 최적화와 자연스럽게 연계 가능 |
| 애니메이션 구현 | LHT/Stocker 크레인의 물리 기반 4단계 이동 애니메이션 완성 |
| 층별 모니터링 | 5개 층 각각의 독립 모니터링 뷰 |

#### 한계

| 항목 | 내용 |
|------|------|
| HT for Web 종속성 | 상용 라이브러리 종속, 라이선스 비용 발생, 오픈소스 생태계 활용 불가 |
| 실시간성 부족 | WebSocket 미구현, 폴링(10초) 방식 — 실시간 반응성 한계 |
| jQuery + Vanilla JS | 현대적 컴포넌트 기반 개발 불가, 상태 관리 체계 없음 |
| 심볼 포맷 종속 | HT for Web 전용 JSON 포맷 — 타 라이브러리 재사용 불가 |
| 모바일/반응형 미지원 | 고정 레이아웃 구조 |
| 버전 관리 단순 | DB 기반 버전만 있고, Git/Diff 수준의 변경 추적 없음 |

---

## 3. 연구 프로젝트 매핑

### 3.1 활용 가능한 구현 요소

#### 3.1.1 심볼 분류 체계 (그대로 참고)

자사 솔루션의 심볼 분류 체계(Equipment / Unit / System / Relation)와 각 심볼의 **기준정보 속성 구조**는 연구 구현에 그대로 적용한다.

```
Equipment: EQUIPMENT_ID, EQUIPMENT_TYPE, INLINE_STOCKER
Unit:       EQUIPMENT_UNIT_ID
System:     EC_SERVER_NAME
Relation:   DEPARTURE_EQUIPMENT, ARRIVAL_EQUIPMENT, TRANSPORT_EQUIPMENT, WEIGHT
```

#### 3.1.2 연결 검증 로직 (참고 후 재구현)

Port-to-Port 제한, 중복 방지, 방향 제한(Fixed InOut Mode)은 연구 구현에서도 동일하게 적용. 로직 자체는 단순하므로 React 기반으로 재작성.

#### 3.1.3 Line Map 구조 (AI 경로 최적화 입력 형식)

```javascript
{ LINE_ID: "...", MAPDATA: ["유닛ID_1", "유닛ID_2", ..., "유닛ID_N"] }
```
캐리어 이동 경로를 표현하는 이 구조는 AI 경로 최적화 모듈의 입력 데이터 형식으로 그대로 채택한다.

#### 3.1.4 저장/로드 아키텍처 (설계 참고)

JSON 직렬화 → DB 저장 → JSON 역직렬화 → 화면 복원 방식을 그대로 사용. HT for Web의 `serialize()/deserialize()`를 React Flow의 상태 JSON으로 대체한다.

#### 3.1.5 WEIGHT 기반 경로 가중치 (그대로 채택)

각 Relation(연결선)에 `WEIGHT` 속성을 설정하는 방식은 연구 구현에도 그대로 유지. 이 값이 AI 경로 최적화 알고리즘의 엣지 가중치로 직접 사용된다.

#### 3.1.6 층별 모니터링 뷰 구조 (참고)

층(Floor)별 독립 뷰로 모니터링하는 구조를 그대로 채택. React 기반 탭/라우팅으로 구현.

---

### 3.2 연구 목적에 맞게 개선할 부분

#### 3.2.1 실시간성 개선: 폴링 → WebSocket

현재 솔루션의 폴링(10초 주기) 방식을 WebSocket 실시간 통신으로 교체.

```
현재: timerFABData → REST API 폴링 (10초)
개선: WebSocket 연결 유지 → 서버 Push 방식 (즉시 반응)
```

장비 상태 변경, 캐리어 이동 이벤트가 발생하면 서버가 즉시 클라이언트에 전송.

#### 3.2.2 심볼 포맷 전환: HT JSON → SVG React 컴포넌트

HT for Web 전용 JSON 포맷 → SVG 기반 React 컴포넌트로 재구현.

```
기존: symbols/sem/STOCKER.json (HT 전용 벡터 포맷)
전환: <StockerSymbol /> (SVG 기반 React 컴포넌트)
      → path, rect, circle 등 웹 표준 SVG 사용
      → 크기/색상/상태에 따른 동적 스타일 props 지원
```

#### 3.2.3 캐리어 애니메이션 개선

HT `startAnim()` 기반 수동 체이닝 → CSS 애니메이션 또는 `framer-motion` 기반 선언적 애니메이션으로 전환.

#### 3.2.4 버전 관리 강화

단순 DB 버전 번호 → **레이아웃 변경 이력 Diff** 저장 (변경된 심볼/연결선만 기록).

---

### 3.3 신규 개발 필요 사항

#### 3.3.1 AI 경로 최적화 연계 레이어

자사 솔루션에는 없는 기능. 레이아웃에서 추출한 그래프 데이터를 AI 경로 최적화 모듈로 전달하는 브리지 레이어가 필요하다.

```
[레이아웃 모델러 저장 데이터]
  Node: EQUIPMENT_UNIT_ID (포트/유닛)
  Edge: DEPARTURE → ARRIVAL, WEIGHT
         ↓
[그래프 변환기 (신규)]
  → 방향 가중 그래프 (Directed Weighted Graph)
  → 노드: 유닛 ID
  → 엣지: 연결 방향 + WEIGHT
         ↓
[AI 경로 최적화 모듈 (MCS 프로젝트 — 별도)]
  → 최적 경로 계산 (A*/Dijkstra/GNN 등)
  → 결과: 최적 MAPDATA 반환
         ↓
[모니터링 뷰]
  → 최적 경로를 레이아웃 위에 시각화 (경로 하이라이트 등)
```

#### 3.3.2 레이아웃 모델러 자체 (React 기반 신규 구현)

HT for Web 대신 **React Flow**를 사용하는 공장 레이아웃 모델러 신규 구현. 기능 범위는 자사 ModelerDesigner와 동일:
- 심볼 팔레트 (좌측)
- 드래그앤드롭 캔버스 (React Flow)
- 기준정보 속성 입력 패널 (우측)
- 연결선 생성 + 검증
- JSON 저장/로드

#### 3.3.3 실시간 모니터링 뷰 (신규)

저장된 레이아웃 위에 실시간 장비 상태와 캐리어 이동을 표시하는 읽기 전용 뷰어. WebSocket 기반으로 즉시 업데이트.

---

## 4. 구현 방향 제안

### 4.1 핵심 아키텍처

```
┌────────────────────────────────────────────────────────────────────┐
│                    공장 레이아웃 모델러 (신규)                        │
│                                                                    │
│  ┌──────────────┐   ┌────────────────────────┐   ┌─────────────┐  │
│  │ 심볼 팔레트   │   │  React Flow 캔버스      │   │ 속성 입력   │  │
│  │              │──▶│  (드래그앤드롭 배치)      │──▶│  패널      │  │
│  │ • Stocker    │   │                        │   │            │  │
│  │ • Conveyor   │   │  노드: 장비/유닛/시스템  │   │ EQUIPMENT  │  │
│  │ • Port       │   │  엣지: 물류 경로        │   │ _ID 등     │  │
│  │ • LHT/AGV    │   │  WEIGHT 설정            │   │ WEIGHT     │  │
│  └──────────────┘   └──────────┬─────────────┘   └─────────────┘  │
│                                │ JSON 저장/로드                     │
└────────────────────────────────┼───────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  DB (레이아웃 JSON 저장) │
                    │  버전별 이력 관리         │
                    └────────────┬────────────┘
                                 │
               ┌─────────────────┴──────────────────┐
               │                                    │
  ┌────────────▼─────────────┐       ┌──────────────▼────────────┐
  │  실시간 모니터링 뷰 (신규) │       │  그래프 변환기 (신규)       │
  │                          │       │                           │
  │  저장 레이아웃 로드 → 표시  │       │  Node/Edge + WEIGHT       │
  │  WebSocket 장비 상태 수신  │       │  → 방향 가중 그래프        │
  │  캐리어 이동 애니메이션     │       │                           │
  │  층별(1F/2F/3F) 탭        │       │       ↓                   │
  └──────────────────────────┘       │  AI 경로 최적화 모듈        │
                                     │  (MCS 프로젝트 — 별도)     │
                                     └───────────────────────────┘
```

> **RTD 룰 빌더**는 완전히 별개 모듈로, 위 아키텍처와 직접 연결되지 않는다.
> 공유 데이터는 `EQUIPMENT_ID` / `EQUIPMENT_UNIT_ID` 같은 기준정보(마스터 데이터)뿐이다.

---

### 4.2 기술 스택 전환 방안

#### HT for Web → React Flow

| 기존 (HT for Web) | 전환 (React 기반) |
|-------------------|-----------------|
| `ht.graph.GraphView` | `<ReactFlow />` |
| `ht.Node` | React Flow Custom Node |
| `ht.Edge` | React Flow Custom Edge |
| `ht.DataModel.serialize()` | Zustand 상태 → JSON 직렬화 |
| `ht.Default.setImage()` | SVG 기반 React 컴포넌트 |
| `ht.Default.startAnim()` | `framer-motion` 또는 CSS animation |
| `ht.widget.Toolbar` | shadcn/ui Toolbar |
| `ht.graph.Overview` | React Flow MiniMap |
| `HistoryManager` | Zustand + immer 기반 undo/redo |

#### 전체 기술 스택

```
프론트엔드 프레임워크
├── Next.js 15 (App Router)
├── React 19
└── TypeScript 5.6+

레이아웃 모델러 핵심
├── React Flow 12.x        ← HT for Web 대체 (드래그앤드롭 + 노드/엣지)
├── framer-motion          ← 캐리어 이동 애니메이션
└── SVG React 컴포넌트     ← 심볼 라이브러리 (HT JSON 심볼 재구현)

상태 관리
├── Zustand                ← 레이아웃 상태 (노드/엣지)
└── TanStack Query 5.x     ← 서버 데이터 (장비 상태, 레이아웃 조회)

실시간 통신
└── WebSocket (또는 SSE)   ← 장비 상태 실시간 수신 (폴링 대체)

UI 컴포넌트
├── TailwindCSS v4
└── shadcn/ui

백엔드 연동
└── 기존 Java/Spring REST API
```

---

### 4.3 단계별 구현 계획

#### Phase 1: 기반 구축 + 심볼 라이브러리 재구현 (2주)

| 태스크 | 내용 |
|--------|------|
| 1-1 | 자사 `symbols/sem/` 목록 전체 정리 — 필요 심볼 우선순위 선정 |
| 1-2 | 우선순위 심볼을 SVG React 컴포넌트로 재구현 (STOCKER, CONVEYOR, PORT, LHT, AGV, Carrier, Lift) |
| 1-3 | React Flow 프로젝트 셋업 + 커스텀 노드 기본 틀 구현 |
| 1-4 | 심볼 팔레트 UI 구현 (좌측 사이드바 — 분류별 심볼 목록) |

#### Phase 2: 레이아웃 편집기 구현 (3주)

| 태스크 | 내용 |
|--------|------|
| 2-1 | React Flow 캔버스에 커스텀 노드(심볼) 드래그앤드롭 배치 |
| 2-2 | 기준정보 속성 입력 패널 (우측) — EQUIPMENT_ID, EQUIPMENT_UNIT_ID, EC_SERVER_NAME 입력 폼 |
| 2-3 | 연결선(Edge) 생성 — Port-to-Port 제한, 방향 검증, 중복 방지 로직 구현 |
| 2-4 | WEIGHT 속성 편집 UI (연결선 클릭 → 가중치 입력) |
| 2-5 | Process/Port Grouping Relation — 그룹 매핑 및 가중치 일괄 설정 |
| 2-6 | JSON 저장/로드 API 연동 + 버전 관리 |
| 2-7 | Undo/Redo (Zustand + immer 기반) |

#### Phase 3: 실시간 모니터링 뷰 구현 (2주)

| 태스크 | 내용 |
|--------|------|
| 3-1 | 저장된 레이아웃 JSON 로드 → 읽기 전용 뷰어 구현 (편집 기능 비활성) |
| 3-2 | WebSocket 연결 + 장비 상태 수신 → 노드 색상/상태 아이콘 실시간 업데이트 |
| 3-3 | 캐리어 이동 애니메이션 구현 (framer-motion 기반 4단계: 이동→pick→이동→place) |
| 3-4 | 층별(Floor) 탭 전환 UI |
| 3-5 | 심볼 클릭 → 장비 상태 상세 팝업 |

#### Phase 4: AI 경로 최적화 연계 (MCS 프로젝트와 협의, 1주)

| 태스크 | 내용 |
|--------|------|
| 4-1 | 레이아웃 Node/Edge 데이터 → 방향 가중 그래프(adjacency list) 변환 API 설계 |
| 4-2 | MCS AI 경로 최적화 모듈에서 반환된 최적 경로를 레이아웃 위에 시각화 (경로 하이라이트) |

#### Phase 5: 검증 및 최적화 (1주)

| 태스크 | 내용 |
|--------|------|
| 5-1 | 자사 기존 레이아웃을 연구 모델러로 재현 → 동일성 검증 |
| 5-2 | WebSocket 실시간성 검증 (폴링 대비 지연 시간 비교) |
| 5-3 | 비개발자(엔지니어)가 레이아웃 작성 가능한지 사용성 테스트 |

---

### 4.4 검증 방법

| 검증 항목 | 측정 방법 | 목표 |
|-----------|-----------|------|
| 레이아웃 재현 정확도 | 자사 레이아웃 JSON과 연구 구현 JSON의 Node/Edge 동일성 비교 | 100% 동일 |
| 실시간 지연 시간 | WebSocket 이벤트 수신 → 화면 업데이트 지연 측정 | < 500ms |
| 레이아웃 저장/로드 | 복잡한 레이아웃 저장 후 재로드 정확성 | 동일 레이아웃 복원 |
| 기준정보 정합성 | 모델러 저장 EQUIPMENT_ID가 MCS/RTD 기준정보와 일치하는지 | 100% 일치 |
| 사용성 | 엔지니어가 레이아웃 신규 작성 소요 시간 측정 | 기존 대비 동등 이하 |

---

## 5. 핵심 고려사항

### 1. 모델러와 RTD 룰 빌더는 독립 모듈로 유지
두 시스템이 공유하는 것은 **기준정보(EQUIPMENT_ID, EQUIPMENT_UNIT_ID)**뿐이며, UI와 로직은 완전히 분리되어야 한다. 하나의 애플리케이션 내에 두 모듈을 탑재하더라도 상호 의존성 없이 독립 동작해야 한다.

### 2. HT for Web 심볼 재구현 범위 선정
자사 솔루션에는 80개의 심볼 파일이 있다. 연구 범위 내에서 필수 심볼(STOCKER, CONVEYOR, PORT, LHT, Carrier, Lift, AGV)에 집중하고, 나머지는 추후 확장으로 처리한다.

### 3. 실제 공장 기준정보와의 정합성
모델러에서 입력하는 `EQUIPMENT_ID`, `EQUIPMENT_UNIT_ID`는 실제 MCS 시스템의 기준정보와 일치해야 한다. 잘못된 ID 입력 시 반송 제어가 실패하므로, 입력 시 유효성 검증(ID 포맷, 중복 체크)이 필수다.

### 4. React Flow의 성능 한계
대형 공장 레이아웃은 수백 개의 노드/엣지가 필요할 수 있다. React Flow의 기본 성능으로는 200개 이상의 노드에서 렌더링 지연이 발생할 수 있으므로, **가상화(Virtualization)**와 **메모이제이션**이 필요하다.

### 5. 저장 JSON 포맷 설계
자사 솔루션의 HT JSON 포맷을 참고하되, 연구 구현에서는 **React Flow 호환 JSON 포맷**으로 설계한다. 향후 자사 시스템과의 데이터 교환을 위해 변환 레이어를 고려한다.

### 6. WebSocket 연결 관리
모니터링 뷰에서 WebSocket 연결이 끊겼을 때 자동 재연결 로직과 폴백(fallback) 폴링 방식이 필요하다.

---

## 부록: 주요 파일 경로 참조

| 역할 | 경로 |
|------|------|
| 레이아웃 편집기 | `reference/sgas/samsung-gas/MCS_UI/THiRA-TB.UI/webapp/Modeler/ModelerDesigner.js` |
| 층별 모니터링 (1F) | `reference/sgas/samsung-gas/MCS_UI/THiRA-TB.UI/webapp/Modeler/BSN_FABMonitoring_B5_1F.js` |
| 심볼 라이브러리 | `reference/sgas/samsung-gas/MCS_UI/THiRA-TB.UI/webapp/Modeler/symbols/sem/` |
| 속성 할당 | `reference/sgas/samsung-gas/MCS_UI/THiRA-TB.UI/webapp/Modeler/ModelerPropertyAssign.js` |
| 레이아웃 관리 | `reference/sgas/samsung-gas/MCS_UI/THiRA-TB.UI/webapp/Modeler/ModelerManagement.js` |
