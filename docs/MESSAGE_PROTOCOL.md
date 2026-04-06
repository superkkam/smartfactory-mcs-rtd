# MES-RTD-MCS JSON 메시지 프로토콜 v1.0

> 스마트팩토리 시스템 간 REST API 기반 메시지 교환 포맷 정의
> 참조: prd-common.md, prd-rtd.md(F010), prd-mcs.md(F009)

---

## 1. 메시지 흐름 개요

```
                        ┌──────────┐
                        │ 가상 MES │
                        └────┬─────┘
                             │
            ① LoadRequest    │   ② UnloadRequest
            ③ TransferRequest│
                             ▼
                     ┌───────────────┐
                     │      RTD      │
                     │ (디스패칭 엔진) │
                     └───────┬───────┘
                             │
            ④ DispatchResult │
            (Lot 선정 결과)   │
                             ▼
                     ┌───────────────┐
                     │      MCS      │
                     │ (반송 제어)    │
                     └───────┬───────┘
                             │
            ⑤ TransportComplete
            ⑥ TransportFailed│
                             ▼
                     ┌───────────────┐
                     │   RTD / MES   │
                     └───────────────┘
```

---

## 2. 공통 메시지 봉투 (Envelope)

모든 메시지는 동일한 header + body 구조를 가집니다.

```json
{
  "header": {
    "messageId": "MSG-20260405-001",
    "messageType": "LOAD_REQUEST",
    "source": "MES",
    "target": "RTD",
    "timestamp": "2026-04-05T14:30:00.000Z",
    "correlationId": "COR-20260405-001",
    "siteId": "FAB1",
    "version": "1.0"
  },
  "body": { ... }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `messageId` | string | 메시지 고유 ID (발신 시스템에서 생성) |
| `messageType` | string | 메시지 유형 (3장 참조) |
| `source` | string | 발신 시스템: `MES`, `RTD`, `MCS` |
| `target` | string | 수신 시스템: `MES`, `RTD`, `MCS` |
| `timestamp` | string | ISO 8601 발신 시각 |
| `correlationId` | string | 요청-응답 추적 ID (동일 트랜잭션은 같은 값) |
| `siteId` | string | 공장 사이트 식별자 |
| `version` | string | 프로토콜 버전 |

---

## 3. 메시지 유형 목록

| 방향 | messageType | 설명 |
|------|------------|------|
| MES → RTD | `LOAD_REQUEST` | 장비에 Lot 적재 요청 (Stocker Full 등) |
| MES → RTD | `UNLOAD_REQUEST` | 장비에서 Lot 반출 요청 |
| MES → RTD | `TRANSFER_REQUEST` | 특정 Lot 이동 요청 |
| RTD → MES | `DISPATCH_ACKNOWLEDGE` | 디스패칭 처리 완료 응답 |
| RTD → MCS | `DISPATCH_RESULT` | 디스패칭 결과 (선정 Lot + 목적지) |
| MCS → RTD | `TRANSPORT_COMPLETE` | 반송 완료 알림 |
| MCS → RTD | `TRANSPORT_FAILED` | 반송 실패 알림 |

---

## 4. MES → RTD 메시지

### 4-1. LOAD_REQUEST

```json
{
  "header": { "messageType": "LOAD_REQUEST", "source": "MES", "target": "RTD", "..." : "..." },
  "body": {
    "eventType": "EVT_FULL",
    "equipmentId": "B1STK101",
    "equipmentUnitId": "B1STK101_AO01",
    "lotId": null,
    "carrierId": "FOUP_001",
    "priority": 50,
    "parameters": {
      "lotState": "WAIT",
      "processStep": "PHOTO_01",
      "productId": "PROD_A"
    }
  }
}
```

### 4-2. UNLOAD_REQUEST

```json
{
  "header": { "messageType": "UNLOAD_REQUEST", "source": "MES", "target": "RTD", "..." : "..." },
  "body": {
    "eventType": "EVT_EMPTY",
    "equipmentId": "B1PRC201",
    "equipmentUnitId": "B1PRC201_AI01",
    "requestedLotCount": 1,
    "processStep": "ETCH_01",
    "parameters": {
      "recipeId": "RCP_ETCH_A",
      "chamberState": "IDLE"
    }
  }
}
```

### 4-3. TRANSFER_REQUEST

```json
{
  "header": { "messageType": "TRANSFER_REQUEST", "source": "MES", "target": "RTD", "..." : "..." },
  "body": {
    "eventType": "EVT_MOVE",
    "lotId": "LOT_20260405_001",
    "carrierId": "FOUP_003",
    "sourceEquipmentId": "B1STK101",
    "sourceUnitId": "B1STK101_AO01",
    "destEquipmentId": "B1STK202",
    "destUnitId": "B1STK202_AI01",
    "priority": 80,
    "reason": "URGENT_MOVE",
    "parameters": {}
  }
}
```

---

## 5. RTD → MCS 메시지

### 5-1. DISPATCH_RESULT

```json
{
  "header": { "messageType": "DISPATCH_RESULT", "source": "RTD", "target": "MCS", "..." : "..." },
  "body": {
    "ruleGroupId": "RG001",
    "dispatchType": "DISPATCHING",
    "lots": [
      {
        "lotId": "LOT_20260405_001",
        "carrierId": "FOUP_001",
        "priority": 75,
        "sourceEquipmentId": "B1STK101",
        "sourceUnitId": "B1STK101_AO01",
        "destEquipmentId": "B1PRC201",
        "destUnitId": "B1PRC201_AI01"
      }
    ],
    "executionSummary": {
      "totalSequences": 4,
      "totalDuration": 45,
      "sequences": [
        { "sequence": 1, "ruleId": "R001", "ruleType": "Data",   "count": 12 },
        { "sequence": 2, "ruleId": "R002", "ruleType": "Filter", "count": 5  },
        { "sequence": 3, "ruleId": "R003", "ruleType": "Sort",   "count": 5  },
        { "sequence": 4, "ruleId": "R004", "ruleType": "Data",   "count": 1  }
      ]
    }
  }
}
```

---

## 6. MCS → RTD 메시지

### 6-1. TRANSPORT_COMPLETE

```json
{
  "header": { "messageType": "TRANSPORT_COMPLETE", "source": "MCS", "target": "RTD", "..." : "..." },
  "body": {
    "commandId": "CMD-20260405-001",
    "status": "COMPLETED",
    "lotId": "LOT_20260405_001",
    "carrierId": "FOUP_001",
    "sourceEquipmentId": "B1STK101",
    "sourceUnitId": "B1STK101_AO01",
    "destEquipmentId": "B1PRC201",
    "destUnitId": "B1PRC201_AI01",
    "startTime": "2026-04-05T14:30:01.000Z",
    "endTime": "2026-04-05T14:32:15.000Z",
    "transportDuration": 134000,
    "route": ["B1STK101_AO01", "B1CVY_01", "B1CVY_02", "B1PRC201_AI01"],
    "algorithm": "AI_PPO",
    "triggerNextDispatch": true
  }
}
```

### 6-2. TRANSPORT_FAILED

```json
{
  "header": { "messageType": "TRANSPORT_FAILED", "source": "MCS", "target": "RTD", "..." : "..." },
  "body": {
    "commandId": "CMD-20260405-001",
    "status": "FAILED",
    "lotId": "LOT_20260405_001",
    "carrierId": "FOUP_001",
    "failureReason": "EQUIPMENT_OFFLINE",
    "failedAtUnitId": "B1CVY_02",
    "retryable": true,
    "errorCode": "ERR_EQP_003"
  }
}
```

---

## 7. RTD → MES 메시지

### 7-1. DISPATCH_ACKNOWLEDGE

```json
{
  "header": { "messageType": "DISPATCH_ACKNOWLEDGE", "source": "RTD", "target": "MES", "..." : "..." },
  "body": {
    "status": "ACCEPTED",
    "ruleGroupId": "RG001",
    "selectedLotId": "LOT_20260405_001",
    "destEquipmentId": "B1PRC201",
    "reason": null
  }
}
```

| status 값 | 설명 |
|-----------|------|
| `ACCEPTED` | 정상 처리, Lot 선정 완료 |
| `NO_LOT` | 조건에 맞는 Lot 없음 |
| `RULE_ERROR` | 룰 실행 오류 |
| `REJECTED` | 요청 거부 (룰 그룹 비활성 등) |

---

## 8. 이벤트별 파라미터 매핑

| eventType | 설명 | 주요 파라미터 |
|-----------|------|-------------|
| `EVT_FULL` | Stocker Full | `equipmentId`, `siteId`, `lotState` |
| `EVT_EMPTY` | 장비 Empty | `equipmentId`, `processStep`, `recipeId` |
| `EVT_MOVE` | Lot 강제 이동 | `lotId`, `carrierId`, `sourceEquipmentId`, `destEquipmentId` |
| `EVT_PROCESS_COMPLETE` | 공정 완료 | `equipmentId`, `lotId`, `processStep` |

---

## 9. 에러 응답

```json
{
  "header": { "messageType": "ERROR", "source": "RTD", "target": "MES", "..." : "..." },
  "body": {
    "errorCode": "RTD_ERR_001",
    "errorMessage": "룰 그룹 RG999를 찾을 수 없습니다",
    "severity": "ERROR",
    "details": {}
  }
}
```

---

## 10. REST API 엔드포인트 매핑

| 수신 시스템 | 엔드포인트 | 수신 메시지 |
|------------|-----------|------------|
| **RTD** | `POST /api/message` | MES 요청, MCS 반송 완료/실패 |
| **MCS** | `POST /api/message` | RTD 디스패칭 결과 |
| **MES** | `POST /api/message` | RTD 응답, MCS 상태 보고 |

환경 변수:

```env
# RTD (.env)
MCS_API_URL=http://localhost:3001
MES_API_URL=http://localhost:3002

# MCS (.env)
RTD_API_URL=http://localhost:3000

# 미설정 시 연동 비활성 (단독 실행 모드)
```

---

## 11. 메시지 시퀀스

```
MES                     RTD                      MCS
 │                       │                        │
 │  LOAD_REQUEST         │                        │
 │──────────────────────>│                        │
 │                       │ (룰 체인 실행)          │
 │  DISPATCH_ACK         │                        │
 │<──────────────────────│                        │
 │                       │  DISPATCH_RESULT       │
 │                       │───────────────────────>│
 │                       │                        │ (MacroCmd → 경로 → 반송)
 │                       │  TRANSPORT_COMPLETE    │
 │                       │<───────────────────────│
 │                       │ (다음 디스패칭 트리거)   │
```
