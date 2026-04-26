# Phase 4 통합 테스트 리포트 — Task 022 RTD-MCS 통합 인터페이스

**검증 일시**: 2026-04-20  
**담당**: Claude Code (자동화 Playwright 검증)

---

## 검증 범위

Task 022 — RTD-MCS 통합 인터페이스 구현의 기능 검증  
검증 시나리오: RTD 비활성 수동 모드 (NEXT_PUBLIC_RTD_ENABLED=false)

---

## 검증 항목 및 결과

### 1. 스키마 마이그레이션 (004-rtd-integration.sql)

| 항목 | 결과 |
|------|------|
| `mcs_macro_command.rtd_command_id` 컬럼 존재 | ✅ |
| `mcs_macro_command.correlation_id` 컬럼 존재 | ✅ |
| `mcs_macro_command.source_system` 컬럼 존재 | ✅ |
| `mcs_macro_command.algorithm` 컬럼 존재 | ✅ |
| `mcs_macro_command.source_equipment_id` 컬럼 존재 | ✅ |
| `mcs_macro_command.dest_equipment_id` 컬럼 존재 | ✅ |

PostgREST OpenAPI 스키마(`/rest/v1/`)로 6개 신규 컬럼 모두 존재 확인.

---

### 2. RTD 비연동 배지 및 수동 트리거 비활성화

**스크린샷**: `verification-022-01-rtd-badge-disconnected.png`

| 항목 | 결과 |
|------|------|
| `/transfer-control` 접근 | ✅ |
| "RTD 비연동" 배지 표시 (회색/Unplug 아이콘) | ✅ |
| "수동 트리거" 버튼 disabled 속성 | ✅ |
| `/api/rtd/health` → `{enabled:false, reachable:false}` | ✅ |

---

### 3. 경로 탐색 (A* + AI PPO 하이브리드)

**스크린샷**: `verification-022-05-route-result.png`

| 항목 | 결과 |
|------|------|
| 출발 유닛 선택: PORT-S1O (Out) | ✅ |
| 목적 유닛 선택: PORT-PROC-001-I (In) | ✅ |
| A* 경로 탐색 완료 | ✅ |
| 경로 길이: 7.5m, 4구간 (PORT-S1O→ND-024→ND-020→ND-016→PORT-PROC-001-I) | ✅ |
| AI 경로: PPO 미학습 → A* 폴백 표시 | ✅ |
| 하이브리드 선택: AI 폴백이므로 ASTAR 채택 | ✅ |

---

### 4. 반송 명령 실행 — MacroCommand + MicroCommand 생성

**스크린샷**: `verification-022-07-manual-command-created.png`

**생성된 MacroCommand**:
```json
{
  "command_id": "CMD-MO78FJPO-YG5J",
  "source_system": "MANUAL",
  "algorithm": "ASTAR",
  "state": "Pending",
  "carrier_id": "8b5f08f7-c766-4748-a45a-a5c9cfd1bd11"
}
```

| 항목 | 결과 |
|------|------|
| `source_system = 'MANUAL'` | ✅ |
| `algorithm ∈ {'ASTAR','AI_PPO'}` | ✅ (ASTAR) |
| MacroCommand 생성 | ✅ |
| MicroCommand 4건 생성 | ✅ |
| micro sequence 1: PORT-S1O → ND-024 | ✅ |
| micro sequence 2: ND-024 → ND-020 | ✅ |
| micro sequence 3: ND-020 → ND-016 | ✅ |
| micro sequence 4: ND-016 → PORT-PROC-001-I | ✅ |

---

### 5. ACS 대시보드 명령 표시 및 tick-loop 동작

**스크린샷**: `verification-022-08-acs-dashboard.png`, `verification-022-09-acs-running.png`

| 항목 | 결과 |
|------|------|
| ACS `/acs` 페이지 MacroCommand 현황 표시 | ✅ |
| "ACS 시작" 후 tick-loop 동작 (Tick #56) | ✅ |
| tick-loop 캐리어 상태(PROCESSING) 확인 후 취소 | ✅ (정상 ACS 로직) |
| "반송 명령 현황 — 대기 중인 명령 없음" 전환 | ✅ |

> **비고**: MacroCommand가 Cancelled 상태로 전환된 것은 할당된 캐리어(LOT-A003)가 이미 PROCESSING 상태이기 때문입니다. ACS tick-loop의 정상적인 캐리어 상태 검증 동작이며, Task 022 RTD-MCS 인터페이스 구현 결함이 아닙니다.

---

### 6. RTD Health API 엔드포인트

| 엔드포인트 | 결과 |
|------------|------|
| `GET /api/rtd/health` → `{enabled,reachable,latencyMs}` | ✅ |
| `NEXT_PUBLIC_RTD_ENABLED=false` → `{enabled:false,reachable:false}` | ✅ |

---

## 신규 생성/수정 파일 요약

### 신규 파일
| 파일 | 설명 |
|------|------|
| `docs/migrations/004-rtd-integration.sql` | mcs_macro_command 컬럼 6개 추가 마이그레이션 |
| `apps/mcs/app/api/commands/create/route.ts` | 수동 MacroCommand+MicroCommand 생성 API |
| `apps/mcs/app/api/rtd/health/route.ts` | RTD 연결 상태 폴링 API |
| `apps/mcs/app/api/rtd/notify/route.ts` | TRANSPORT_COMPLETE 서버사이드 프록시 |
| `apps/mcs/app/api/rtd/trigger/route.ts` | MES 역할 LOAD_REQUEST 시뮬레이션 API |

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `packages/types/src/mcs.ts` | MacroCommand 인터페이스에 RTD 추적 필드 추가 |
| `apps/mcs/lib/api/macro-commands.ts` | toEntity/toRow에 신규 컬럼 매핑 |
| `apps/mcs/app/api/message/route.ts` | DISPATCH_RESULT 처리 — micro 분해, 하이브리드 선택 |
| `apps/mcs/lib/api/rtd-client.ts` | sendTransportComplete correlationId 파라미터 추가 |
| `apps/mcs/lib/acs/tick-loop.ts` | Completed 전이 시 notifyRtdComplete 콜백 연결 |
| `apps/mcs/components/transfer-control/rtd-status-badge.tsx` | 동적 RTD 상태 폴링 및 트리거 버튼 |
| `apps/mcs/app/(app)/transfer-control/page.tsx` | handleExecute 실데이터 연동 |
| `apps/rtd/app/api/message/route.ts` | emitDispatchResult → MCS 아웃바운드 추가 |
| `apps/mcs/lib/api/sync-layout-to-db.ts` | implicit any 타입 오류 수정 |

---

## 미검증 항목 (RTD 활성 모드)

RTD 서버가 현재 기동되지 않아 아래 항목은 검증되지 않았습니다:

- RTD 활성 시나리오 (`NEXT_PUBLIC_RTD_ENABLED=true`): 수동 트리거 → LOAD_REQUEST 전송 → DISPATCH_RESULT 수신 → MacroCommand RTD 원천 생성
- TRANSPORT_COMPLETE 콜백: tick-loop → `/api/rtd/notify` → RTD `rule_running_result.end_time` 갱신
- `correlation_id` 매칭 검증
- 하이브리드 선택 — AI_PPO 채택 케이스 (PPO 학습 후)

이 항목들은 RTD 서버(`apps/rtd`) 기동 및 `.env.local` 설정 후 수동 검증 가능합니다.

---

## 결론

Task 022 RTD-MCS 통합 인터페이스의 핵심 기능(스키마 확장, 하이브리드 경로 선택, 수동 명령 생성, RTD 연결 상태 표시)은 모두 정상 동작 확인됩니다. RTD 서버 연동 시나리오는 서버 기동 후 추가 검증이 필요합니다.
