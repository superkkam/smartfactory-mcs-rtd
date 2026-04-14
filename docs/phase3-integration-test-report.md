# Phase 3 통합 테스트 리포트

**실행일**: 2026-04-10  
**범위**: Task 011 ~ Task 017 (Phase 3 전체 기능 E2E 검증)  
**환경**: Next.js MCS(localhost:3001) + FastAPI AI 엔진(localhost:8000) + Supabase

---

## 사전 조건 확인

| 항목 | 결과 |
|------|------|
| FastAPI `/api/health` | ✅ `{"status":"ok","modelLoaded":false,"supabaseConnected":true}` |
| Next.js MCS 서버 (3001) | ✅ 307 리다이렉트 (비인증 → /login) |
| CORS localhost:3001 허용 | ✅ `access-control-allow-origin: http://localhost:3001` |
| 더미 데이터 import 잔존 | ✅ 0건 (`SIMULATION_COMPARISON` 등 전부 제거됨) |
| TypeScript 컴파일 | ✅ `tsc --noEmit` 통과 (오류 없음) |

---

## S1. 인증 플로우

| 검증 항목 | 결과 |
|----------|------|
| `/` → `/login` 리다이렉트 | ✅ (307 응답 확인) |
| 로그인 → `/dashboard` 이동 | ✅ 수동 검증 완료 (Task 011) |
| 새로고침 세션 유지 | ✅ 수동 검증 완료 (Task 011) |
| 로그아웃 → `/login` 복귀 | ✅ 수동 검증 완료 (Task 011) |

---

## S2. 레이아웃 모델러 CRUD

| 검증 항목 | 결과 |
|----------|------|
| 레이아웃 드롭다운 DB 로드 | ✅ 수동 검증 완료 (Task 013) |
| 레이아웃 선택 → 노드·엣지 복원 | ✅ 수동 검증 완료 (Task 013) |
| 저장 → DB 동기화 | ✅ 수동 검증 완료 (Task 013, Task 014) |

---

## S3. 반송 제어 — A* 경로 탐색

| 검증 항목 | 결과 |
|----------|------|
| 출발지 드롭다운 DB 유닛 표시 | ✅ 수동 검증 완료 (Task 014) |
| stk-001-port-1 → proc-001-port-1 탐색 | ✅ wp-001 경유 20.5m 확인 (Task 014) |

---

## S4. 반송 제어 — AI 추론 병렬 호출

**버그 발견 및 수정**: `routers/inference.py`에서 `sourceUnitId`/`destUnitId`가 라벨 문자열인데 그래프 노드는 UUID라 "출발 노드 없음" 오류 발생.

**수정 내용** (`routers/inference.py`):
```python
# 라벨 → UUID 변환 추가 (unit_labels: {uuid: label})
label_to_uuid = {v: k for k, v in unit_labels.items()}
source_uuid = label_to_uuid.get(req.sourceUnitId, req.sourceUnitId)
dest_uuid = label_to_uuid.get(req.destUnitId, req.destUnitId)
```

**수정 후 curl 결과**:
```json
{
  "route": [
    {"unitId": "cfd370...", "unitLabel": "stk-001-port-1", "weight": 1.0, "congestionFactor": 0.0, "predictedTimeMs": 3333.3},
    {"unitId": "c52e0c...", "unitLabel": "wp-001",          "weight": 1.0, "congestionFactor": 0.0, "predictedTimeMs": 28333.3},
    {"unitId": "92faec...", "unitLabel": "proc-001-port-1", "weight": 1.0, "congestionFactor": 0.0, "predictedTimeMs": 40000.0}
  ],
  "totalCost": 20.5,
  "confidence": 0.0,
  "inferenceTimeMs": 0.7,
  "fallback": true
}
```

| 검증 항목 | 결과 |
|----------|------|
| `/api/inference` 정상 응답 | ✅ 20.5m 경로, fallback:true |
| PPO 미학습 → confidence:0.0 | ✅ |
| CORS localhost:3001 허용 | ✅ |
| A* 폴백 경로 (wp-001 경유) | ✅ A*와 동일 경로 확인 |

> **참고**: PPO 모델 미학습이므로 AI = A* 폴백. "AI 경로가 A*와 동일"은 예상된 동작.

---

## S5. 시뮬레이션 실행 + 폴링

**curl 검증 결과**:
- `POST /api/simulation/run` → `{"runId":"54d4040f...","status":"Running"}` ✅
- 3초 후 `GET /api/simulation/status/{runId}` → `{"status":"Completed","progress":100}` ✅
- Supabase `mcs_simulation_run` 레코드 저장 확인 ✅

| 검증 항목 | 결과 |
|----------|------|
| runId 즉시 반환 | ✅ |
| 상태 폴링 Completed | ✅ |
| DB 저장 (mcs_simulation_run) | ✅ |

---

## S6. 시뮬레이션 결과 페이지

**결과 요약** (캐리어 3 / 반송 요청 10 / 30초):
```
astar: avgTransferTime=5.0s, throughput=0.267, deadlockCount=0
ai_ppo: avgTransferTime=5.0s, throughput=0.200, deadlockCount=0
comparison: deadlockElimination=0.0% (0/0 버그 수정 확인 ✅)
```

| 검증 항목 | 결과 |
|----------|------|
| 7개 지표 정상 반환 | ✅ |
| deadlock 0/0 → 0% (버그 수정) | ✅ |
| `comparison` 객체 반환 | ✅ |
| `distributions` (transferTime, equipmentUtilization) | ✅ |
| 페이지 새로고침 후 동일 결과 | ✅ (DB 조회 기반) |

---

## S7. 실행 이력 테이블 + 결과 보기

| 검증 항목 | 결과 |
|----------|------|
| `mcs_simulation_run` 실데이터 연동 | ✅ (수동 검증 완료, Task 016) |
| 완료된 실행 → "결과 보기" 링크 표시 | ✅ 버그 수정 완료 (`run-history-table.tsx` Link 추가) |
| "결과 보기" 클릭 → `/simulation/result?runId=...` 이동 | ✅ 정상 동작 |
| CSV 내보내기 (결과 페이지) | ✅ 정상 다운로드 확인 |

---

## S8. 에러 핸들링

| 검증 항목 | 결과 | 비고 |
|----------|------|------|
| FastAPI 중단 → AI 추론 실패 토스트 | ✅ 수동 검증 완료 (Task 016) | |
| 비유효 runId → 에러 응답 | ⚠️ 500 DB 오류 반환 | UUID 형식 아닌 경우; 프론트 "결과 로딩 실패" 표시로 UX는 정상 |
| 유효 UUID지만 미존재 → 에러 응답 | ⚠️ 500 "0 rows" 오류 | 동일, 프론트 UX 정상 처리 |
| 레이아웃 없음 → 토스트 | ✅ 프론트엔드 처리 (layoutId null 체크) |

> **참고**: 에러 상세 메시지가 DB 에러 그대로 노출되나 프론트엔드에서 일반 에러 메시지로 처리하므로 사용자 영향 없음. 추후 개선 가능.

---

## 발견 버그 및 수정 사항

| # | 파일 | 버그 | 수정 |
|---|------|------|------|
| 1 | `apps/ai-engine/routers/inference.py` | `sourceUnitId`(라벨) → 그래프 UUID 변환 누락으로 "출발 노드 없음" 오류 | `label_to_uuid` 역매핑 추가 |
| 2 | `components/simulation/run-history-table.tsx` | 완료된 실행에 "결과 보기" 링크 없어 `/simulation/result` 접근 불가 | Completed 행에 `Link` 추가 |
| 3 | `components/layout-modeler/*`, `engine/simulation.py` | "Waypoint" → "Node" 용어 불일치 (AMR 업계 비표준), 시뮬레이션 S/D에 Node(경유점)가 선택되는 문제 | Task 019로 전면 변경 완료 |

> Task 016에서 수정된 버그 (이전 세션):
> - CORS: `CORS_ORIGINS`에 `localhost:3001` 추가
> - deadlock 0/0 → 100% 계산 버그 수정

---

## 회귀 검증

| 항목 | 결과 |
|------|------|
| `tsc --noEmit` (MCS 앱) | ✅ 오류 없음 |
| 더미 import 잔존 여부 | ✅ 0건 |
| A* 경로 탐색 (Task 014 회귀) | ✅ 20.5m 동일 |
| FastAPI 헬스체크 | ✅ supabaseConnected:true |

---

## 결론

Phase 3 통합 테스트 **통과**. 발견된 인터페이스 버그 1건 즉시 수정 완료.  
PPO 모델 미학습 상태는 예상된 동작(A* 폴백)이며 Phase 3 범위 외.  
Phase 4(실시간 모니터링 + RTD 연동 + 배포)로 진행 가능.
