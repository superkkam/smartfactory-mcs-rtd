# RTD 노코드 룰 빌더 플랫폼 개발 로드맵

반도체 공정 현장 엔지니어가 개발자 없이 디스패칭 룰을 직접 생성·수정·검증할 수 있는 SQL 자동 생성 기반 노코드 룰 빌더 플랫폼

## 개요

RTD 노코드 룰 빌더 플랫폼은 스마트팩토리 현장 엔지니어를 위한 노코드 디스패칭 룰 관리 시스템으로 다음 기능을 제공합니다:

- **룰 그룹 관리 (F001, F002)**: 트리 구조 CRUD, Fallback 계층 시각화, 장비-이벤트 매핑 설정
- **룰 플로우 빌더 (F003~F006)**: React Flow 기반 드래그앤드롭 시퀀스 편집, SQL 자동 생성 쿼리 빌더, 정렬·파라미터 편집기
- **룰 시뮬레이터 (F007)**: 배포 전 실제 DB 데이터 기반 테스트 실행 및 유효성 검증
- **실시간 모니터링 (F008, F009)**: WebSocket/SSE 기반 룰 실행 로그, 통계 및 성능 분석
- **MCS 연동 (F010)**: RTD 디스패칭 결과 → MCS 자동 전달 (통합 실행 시 활성)

## 기술 스택

- **프론트엔드**: Next.js 15 (App Router) + React 19 + TypeScript 5.6+
- **모노레포**: Turborepo (`apps/rtd`, `packages/ui`, `packages/auth`, `packages/types`)
- **UI**: TailwindCSS v4 + shadcn/ui + React Flow 12.x
- **상태 관리**: TanStack Query 5.x (서버 상태)
- **인증**: Supabase Auth (이메일/비밀번호)
- **백엔드**: Next.js Route Handlers (연구 목적 경량 구현)
  - 추후 확장 시 Java/Spring Boot로 교체 가능 (API 계약 동일, base URL만 변경)
- **데이터베이스**: Supabase (PostgreSQL + Auth + Realtime)
- **실시간**: SSE (Supabase Realtime 활용)
- **LLM 연동**: OpenAI API 또는 Anthropic API (자연어 → 룰 변환 프로토타입, Phase 5 확장)

## 개발 워크플로우

1. **작업 계획**
   - 현재 코드베이스를 파악하고 `ROADMAP_RTD.md` 업데이트
   - 우선순위 작업은 마지막 완료된 작업 다음에 삽입

2. **작업 생성**
   - `/tasks` 디렉토리에 새 작업 파일 생성
   - 명명 형식: `RTD-XXX-description.md` (예: `RTD-001-monorepo-setup.md`)

3. **작업 구현**
   - 작업 파일 명세서에 따라 구현
   - API 연동 및 비즈니스 로직 구현 시 Playwright MCP로 테스트 수행
   - 각 단계 완료 후 체크리스트 업데이트

4. **로드맵 업데이트**
   - 완료된 작업을 ✅로 표시

---

## 개발 단계

### Phase 1: 애플리케이션 골격 구축

- **Task 001: Turborepo 모노레포 초기 설정 및 라우팅 골격 구성** ✅ - 우선순위
  - `apps/rtd` Next.js 15 앱 생성 + `packages/ui`, `packages/auth`, `packages/types` 워크스페이스 구성
  - `turbo.json` 빌드 파이프라인 설정
  - App Router 전체 라우트 구조 생성: `/(auth)/login`, `/(auth)/register`, `/(app)/dashboard`, `/(app)/rule-groups`, `/(app)/rule-builder/[groupId]`, `/(app)/simulator/[groupId]`, `/(app)/monitoring`
  - 각 라우트에 빈 페이지 컴포넌트 (`page.tsx`) 생성
  - `.env.example` 환경 변수 템플릿 작성

- **Task 002: TypeScript 타입 정의 및 Zod 스키마 구성** ✅
  - `packages/types`에 9개 DMS 엔티티 인터페이스 정의: `RuleGroup`, `RuleObject`, `RuleRelation`, `RuleDef`, `RuleQuery`, `RuleSort`, `RuleQueryParam`, `RuleClass`, `RuleRunningResult`
  - API 응답 공통 타입 정의 (`ApiResponse<T>`, `PaginatedResponse<T>`)
  - Zod 스키마 정의 (폼 유효성 검사용)
  - 공통 상수 정의 (룰 타입, 이벤트 유형, 정렬 방향 등)

- **Task 003: 공통 레이아웃 골격 구현** ✅
  - 인증 보호 미들웨어 껍데기 (`middleware.ts`)
  - 앱 레이아웃 (`/(app)/layout.tsx`): 사이드바 + 헤더 네비게이션 골격
  - 사이드바 메뉴 구조: 대시보드, 룰 빌더(룰 그룹 관리/룰 플로우 빌더), 시뮬레이터, 모니터링
  - 인증 레이아웃 (`/(auth)/layout.tsx`): 로그인/회원가입 전용 레이아웃

---

### Phase 2: UI/UX 완성 (더미 데이터 활용)

- ✅ **Task 004: shadcn/ui 공통 컴포넌트 라이브러리 구현**
  - `packages/ui`에 공통 컴포넌트 구현: Button, Input, Select, Dialog, Table, Card, Badge, Tabs, TreeView, Toast
  - 더미 데이터 생성 유틸리티 (`lib/dummy/`): 룰 그룹, 실행 로그, 통계 데이터 목 데이터
  - 디자인 시스템 설정 (TailwindCSS v4 테마, 색상 팔레트)
  - 반응형 레이아웃 기준 정의

- ✅ **Task 005: 로그인/회원가입 페이지 UI 구현**
  - 로그인 페이지: 이메일/비밀번호 폼, React Hook Form + Zod 유효성 검사, 회원가입 링크
  - 회원가입 페이지: 이메일/비밀번호/비밀번호 확인 폼, 이메일 형식·비밀번호 강도 검사
  - 더미 인증 흐름 (로그인 버튼 클릭 → 대시보드로 이동)
  - 에러 메시지 표시 UI

- ✅ **Task 006: 대시보드 홈 UI 구현**
  - 요약 카드: 활성 룰 그룹 수, 총 시퀀스 수, 오늘 실행 건수 (더미)
  - 최근 실행 로그 상위 10건 미리보기 테이블 (더미)
  - RuleClassType별 평균 소요시간 요약 바 차트 (더미, Recharts)
  - 룰 빌더 / 시뮬레이터 / 모니터링 바로가기 버튼

- ✅ **Task 007: 룰 그룹 관리 페이지 UI 구현**
  - 룰 그룹 트리 뷰: 장비전용 → EQP_FULL/EQP_EMPTY → EQP_COMMON Fallback 계층 시각화 (더미)
  - 룰 그룹 생성/수정/삭제 폼 모달 (이름, 타입, 설명, 사용여부)
  - 우측 패널: 장비(ruleObjectId) + 이벤트(ruleEventId) → 룰그룹 매핑 설정 테이블 (더미)
  - 룰그룹 선택 → 플로우 빌더로 이동 버튼

- ✅ **Task 008: 룰 플로우 빌더 페이지 UI 구현 — React Flow 캔버스**
  - React Flow 12.x 캔버스 기본 설정 (줌/패닝, 미니맵, 배경 그리드)
  - 시퀀스 블록 커스텀 노드 컴포넌트: 룰 타입 표시, isMandatory 색상 배지(🔴Y/🟢N/🟡O), sequence 번호
  - 블록 간 연결선: filterSequence 참조 화살표, jumpNextSequence 조건 분기선 (COUNT>0/COUNT=0)
  - 블록 추가 버튼 + 룰 타입 선택 드롭다운 (Data/SubData/Filter/Join/Groupby/Sort/Method)
  - 더미 시퀀스 데이터로 플로우 렌더링 확인

- **Task 009: 노드 설정 사이드 패널 UI 구현** ✅
  - 룰 플로우 캔버스에서 노드 클릭 → 우측 사이드 패널 슬라이드 표시 (모달 방식 대신 인라인 패널)
  - 룰 타입별 분기 UI: Data/SubData — 기준 테이블 체크박스 + 문장형 조건 행 / Filter — "이전 룰 결과에서 필터" 배너 + 조건 / Sort — 정렬 컬럼·방향 인라인 편집
  - 문장형 조건 행: [컬럼] [연산자] [값] — 값 드롭다운을 직접입력 / 📡 MES 요청 파라미터 / 🔗 이전 룰 결과 3그룹으로 구분 (비개발자 친화적 파라미터 바인딩)
  - SQL 미리보기 토글 (기본 접힘, 개발자 전용)
  - 블록별 결과 미리보기 테이블 (더미 데이터)

- ✅ **Task 010: 정렬 조건 편집기 + 파라미터 바인딩 편집기 모달 UI 구현**
  - 정렬 편집기 모달: 컬럼 선택 + ASC/DESC 토글 + 가중치/백분율(from~to) 입력, 행 추가/삭제
  - 파라미터 바인딩 편집기 모달: 키-값-대상컬럼 3열 테이블, 행 추가/삭제
  - 룰 플로우 빌더 페이지에서 Sort/Filter 블록 클릭 시 각 모달 연동

- ✅ **Task 011: 룰 시뮬레이터 + 모니터링 대시보드 UI 구현**
  - 룰 시뮬레이터 페이지: 대상 룰그룹·이벤트 정보 표시, 테스트 입력값 폼(장비ID/이벤트 유형), 시퀀스별 결과 건수 테이블 (더미), 유효성 오류 알림 영역
  - 모니터링 대시보드 페이지: 실행 로그 테이블(LotID/Seq/RuleType/결과건수/적용여부/소요시간, 더미), 기간·룰그룹·장비 검색 필터, 히트율 순위 테이블, 일별 실행 건수 라인 차트, MCS 연동 상태 표시 영역

---

### Phase 3: 핵심 기능 구현 (백엔드 연동)

- ✅ **Task 012: Supabase Auth 실제 연동** - 우선순위
  - `@supabase/ssr` 기반 쿠키 세션 관리 구현
  - `signInWithPassword()`, `signUp()`, `signOut()` 실제 API 연동
  - `middleware.ts` 인증 보호 미들웨어 완성 (비로그인 시 `/login` 리디렉션)
  - `packages/auth` 공통 Supabase 클라이언트 모듈화
  - Playwright MCP로 로그인/로그아웃/회원가입 플로우 E2E 테스트

- ✅ **Task 013: Next.js Route Handlers + Supabase DB 연동 레이어 구성**
  - Supabase 클라이언트 서버/클라이언트 분리 설정 (`lib/supabase/server.ts`, `lib/supabase/client.ts`)
  - Next.js Route Handlers 기반 API 엔드포인트 구성 (`app/api/` 디렉토리)
  - TanStack Query 5.x 설정 (`QueryClient`, `QueryClientProvider`)
  - 공통 Query/Mutation 훅 패턴 정의 (`lib/api/hooks/`)
  - API 에러 타입 정의 및 토스트 알림 연동
  > **확장 참고**: 추후 Java/Spring Boot 도입 시 `lib/api/client.ts`의 base URL 변경만으로 교체 가능. 프론트엔드 훅 인터페이스는 동일하게 유지.

- ✅ **Task 014: 룰 그룹 CRUD + 장비-이벤트 매핑 API 연동**
  - 룰 그룹 목록/생성/수정/삭제 API 연동 (더미→실데이터 교체)
  - Fallback 계층 트리 데이터 API 연동
  - 장비-이벤트-룰그룹 매핑 조회/저장/삭제 API 연동
  - Playwright MCP로 룰 그룹 CRUD 플로우 테스트

- ✅ **Task 015: 룰 플로우 빌더 비즈니스 로직 구현**
  - 시퀀스 블록 CRUD API 연동 (RuleRelation 저장/수정/삭제)
  - 블록 속성 편집 (isMandatory, filterSequence, jumpNextSequence) 저장 연동
  - React Flow 노드 순서 변경 → sequence 번호 자동 재계산
  - filterSequence 화살표 연결선 및 jumpNextSequence 분기선 실제 데이터 반영
  - 전체 저장 버튼 → RuleRelation 배치 저장 API 호출
  - Playwright MCP로 시퀀스 추가/편집/순서변경/저장 플로우 테스트

- ✅ **Task 016: 쿼리 빌더 SQL 자동 생성 + 정렬/파라미터 저장 API 연동**
  - 테이블/조건/컬럼 선택 → SQL 자동 생성 로직 구현 (클라이언트 사이드)
  - RuleQuery(SQL 문자열) 저장 API 연동
  - RuleSort(정렬 조건) 저장 API 연동
  - RuleQueryParam(파라미터 바인딩) 저장 API 연동
  - Playwright MCP로 쿼리 빌더 → SQL 생성 → 저장 플로우 테스트

- ✅ **Task 017: 룰 시뮬레이터 실행 엔진 연동**
  - Next.js Route Handler dry-run API 구현 (Supabase DB 기반, 디스패칭 미수행)
  - 시퀀스별 중간 결과 건수 실데이터 렌더링
  - 유효성 검증 결과 표시 (순환 참조, 잘못된 filterSequence)
  - 즉시 적용 버튼 → 룰 활성화 API 연동
  - Playwright MCP로 시뮬레이터 실행 → 결과 확인 플로우 테스트

- ✅ **Task 018: Phase 3 통합 테스트**
  - Playwright MCP를 사용한 전체 사용자 플로우 E2E 테스트
  - 로그인 → 룰 그룹 생성 → 플로우 빌더 편집 → 쿼리 빌더 → 시뮬레이터 실행 전체 흐름 검증
  - 에러 핸들링 및 엣지 케이스 테스트 (빈 시퀀스, 순환 참조, API 오류)

---

### Phase 4: 실시간 모니터링 + MCS 연동 + 배포

- ✅ **Task 019: WebSocket/SSE 실시간 룰 실행 로그 연동**
  - Supabase Realtime `postgres_changes` 구독 훅 (`useRealtimeSubscription`)
  - 모니터링 대시보드 실시간 로그 테이블 실데이터 바인딩 (더미→실데이터 교체)
  - Lot ID / 룰 ID 검색 필터 + debounce 연동
  - 지수 백오프 자동 재연결 처리 (1s→2s→4s, max 30s)
  - 대시보드 최근 실행 로그 5건 서버 컴포넌트 조회

- ✅ **Task 020: 실행 통계 집계 API 연동 + 차트 실데이터 바인딩**
  - 최근 500건 조회 후 JS 집계 (`useRunningStats` 훅)
  - 일별 실행 건수 추이 (최근 7일, 빈 날짜 0으로 표시)
  - 룰 클래스별 평균 소요시간 (ruleClassId 기반)
  - 룰 히트율 순위 (isDispatching=Y 비율, rule_def ruleName 매핑)

- **Task 021: MCS-RTD 이벤트 전송 인터페이스 구현** ✅ (실데이터 기반 디스패칭 전환 포함)
  - MCS API 연결 상태 표시 (통합 실행 시에만 활성)
  - 디스패칭 결과 → MCS API 전송 로직 구현
  - MCS 반송 완료 이벤트 수신 → 다음 디스패칭 트리거
  - 단독 실행 시 F010 인터페이스 비활성 처리 (환경 변수 기반)
  - **실데이터 기반 디스패칭 전환 (migration 004)**:
    - `mcs_carrier` 에 lot_id, lot_state, priority, due_time, process_step 추가
    - `mcs_equipment` 에 availability, current_load, capacity, recipe_type, last_heartbeat_at 추가
    - `mcs_equipment_unit` 에 current_carrier_id, reserved_by_command_id, queue_length, last_state_changed_at 추가
    - `rtd_exec_readonly` RPC 함수 — SELECT-only 안전 실행
    - `apps/rtd/lib/rule-engine/engine.ts` — 실 룰 실행 엔진 (파라미터 바인딩, filterSequence 체인, jumpNextSequence 분기)
    - `apps/rtd/lib/rule-engine/mcs-schema-catalog.ts` — 쿼리 빌더/엔진 공용 MCS 테이블·컬럼 카탈로그
    - 쿼리 빌더(`query-builder-modal.tsx`): DMS_* 더미 → mcs_* 실테이블 전환, 컬럼 드롭다운 연동
    - 시뮬레이터(`/api/simulate`): rule_running_result 재사용 → 실 엔진 dry-run 실행
    - 메시지 라우트(`/api/message`): TODO 더미 → rule_object 매핑 조회 + 실 엔진 실행

- **Task 022: 성능 최적화 + Vercel 배포 + CI/CD 구성**
  - Next.js 이미지 최적화, 번들 크기 분석
  - TanStack Query 캐싱 전략 최적화
  - Vercel 프로젝트 설정 (`apps/rtd` 독립 배포)
  - GitHub Actions CI/CD 파이프라인 구성 (lint, type-check, build)
  - 환경 변수 관리 (`.env.production` 설정)

- ✅ **Task 026: RTD 매핑 UI — MCS 포트 드롭다운 연동** — 완료
  - `apps/mcs/app/api/equipment-units/ports/route.ts`: 최신 레이아웃 기준 Port 타입 유닛만 반환
  - `apps/rtd/lib/api/mcs-ports.ts`: `useMcsPorts()` 훅 — MCS API 호출
  - `apps/rtd/lib/api/rule-objects.ts`: `useCreateRuleObject`, `useDeleteRuleObject` 뮤테이션 추가
  - `apps/rtd/components/rule-groups/equipment-mapping-panel.tsx`: 매핑 추가/삭제 UI — MCS 포트 드롭다운(Port만 노출) + 이벤트 유형 선택 + 중복 방지
  - `apps/rtd/app/(app)/rule-groups/page.tsx`: 기존 정적 매핑 카드 → `EquipmentMappingPanel` 교체

- **Task 025: LoadRequest → 캐리어 선택 → MCS 전달 End-to-End 플로우 완성** — 우선순위
  - `/api/message` 완성: 포트 ID → `rule_object` 매핑 조회 → 룰 실행 → 1순위 캐리어 선택
  - 선택된 캐리어의 `location_id` → 출발지 unit, 요청 포트 → 목적지 unit 패키징
  - MCS `/api/dispatch` 호출: MacroCommand 생성 요청 전송
  - MCS 반송 완료 콜백 수신 → `rule_running_result` 완료 상태 업데이트
  - RTD 모니터링 대시보드에 디스패칭 결과 실시간 표시 (캐리어 ID / 출발지 / 목적지 / 상태)
  - Playwright E2E 검증: LoadRequest 전송 → 룰 실행 로그 등장 → MCS 전달 확인

---

### Phase 5: LLM 자연어 룰 생성 보조 기능 (프로토타입)

> **목표**: 논문 실험용 프로토타입 탐색 — "자연어 입력만으로 룰 플로우를 자동 생성할 수 있는가"의 가능성 검증.
> 전체 구현이 아닌 few-shot 기반 샘플 시나리오 수준으로 구현.
> 참고 연구: Xia et al., IEEE ETFA 2025 Best Paper (자연어 기반 산업 자동화 제어)

- **Task 023: LLM 자연어 → 룰 플로우 변환 프로토타입** 🚧 (구현 완료, E2E 검증 대기)
  - ✅ 자연어 입력 UI: `LlmPromptPanel` 컴포넌트 분리 (`components/rule-builder/llm-prompt-panel.tsx`)
  - ✅ `@anthropic-ai/sdk` Claude 3.5 Sonnet Tool Use 연동 (`app/api/llm/generate-rules/route.ts`)
  - ✅ Zod 스키마 + 불변성 검증(순환 참조, ruleId 유효성) + 1회 자동 재시도 (`lib/llm/rule-schema.ts`)
  - ✅ few-shot 예시 3개 (긴급Lot우선 / 동일레시피 부하분산 / Idle+heartbeat 이중조건) (`lib/llm/few-shot-examples.ts`)
  - ✅ 시스템 프롬프트 + 런타임 RuleDef 컨텍스트 주입 (`lib/llm/prompt-builder.ts`)
  - ✅ 미리보기 모달 (시퀀스 카드 + reasoning 표시 + 교체/이어붙이기 선택) (`components/rule-builder/llm-preview-modal.tsx`)
  - ✅ 생성된 룰 플로우 일괄 저장 → 기존 React Flow 캔버스 자동 렌더링
  - ⬜ `ANTHROPIC_API_KEY` 설정 후 Playwright MCP E2E 테스트

- **Task 024: LLM 룰 생성 결과 검증 및 논문 실험 데이터 수집**
  - 자연어 입력 → 생성된 룰 vs 수동 작성 룰 비교 실험
  - 정확도·편의성 정량 평가 (논문 실험 섹션용)
  - 제한사항 및 향후 확장 방안 정리

---

## 진행 현황 요약

| Phase | 상태 | Task 수 | 완료 |
|-------|------|---------|------|
| Phase 1: 애플리케이션 골격 구축 | ✅ 완료 | 3 | 3/3 |
| Phase 2: UI/UX 완성 (더미 데이터) | ✅ 완료 | 8 | 8/8 |
| Phase 3: 핵심 기능 구현 | ✅ 완료 | 7 | 7/7 |
| Phase 4: 실시간 모니터링 + 배포 | 진행 중 | 6 | 4/6 |
| Phase 5: LLM 자연어 룰 생성 (프로토타입) | 진행 중 | 2 | 0/2 |
| **합계** | | **25** | **21/25** |

---

## 확장 가능성 안내

> **현재 백엔드 구현 방식**: 연구 목적으로 **Next.js Route Handlers + Supabase**로 경량 구현.
> 논문 게재 이후 실제 공장 배포 시 아래와 같이 확장 가능:
>
> - **백엔드 교체**: Java/Spring Boot로 교체 시 `lib/api/client.ts`의 base URL만 변경하면 됨. 프론트엔드 훅·컴포넌트 수정 불필요.
> - **인증 교체**: Supabase Auth → 자체 인증 서버로 마이그레이션 필요 (JWT 토큰 방식 동일하게 유지 권장).
> - **DB 교체**: Supabase (PostgreSQL) → Oracle/MSSQL 등 현장 DB 마이그레이션 필요.
> - **UI/백엔드 분리 배포**: 현재 모노레포 내 Next.js 앱으로 통합 관리하나, 추후 프론트엔드와 백엔드를 별도 서버로 분리 배포 가능.
