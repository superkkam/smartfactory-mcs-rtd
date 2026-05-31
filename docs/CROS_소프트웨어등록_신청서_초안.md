# 프로그램 저작권 등록 신청서 초안
> 한국저작권위원회 CROS (copy.or.kr) 제출용  
> 작성일: 2026-05-19  
> ※ `[미정]` 항목은 교수님 확인 후 기입

---

## 1. 프로그램 기본 정보

| 항목 | 내용 |
|------|------|
| **프로그램명 (한글)** | 스마트팩토리 MCS-RTD 통합 제어 플랫폼 |
| **프로그램명 (영문)** | Smart Factory MCS-RTD Integrated Control Platform |
| **프로그램 종류** | 응용프로그램 |
| **기술 분야** | 인공지능 / 스마트팩토리 / 제조·생산 자동화 |
| **창작 완성일** | 2026년 05월 19일 |
| **공표 여부** | 미공표 |
| **버전** | v1.0 |
| **개발 기간** | 2025년 ~ 2026년 05월 |

---

## 2. 저작자 정보

| 항목 | 내용 |
|------|------|
| **저작자 성명** | 김경호 외 [미정 - 팀원 전원 기재] |
| **국적** | 대한민국 |
| **소속** | [미정 - 학교명 / 학과명] |
| **창작 기여** | 공동 창작 |

---

## 3. 저작권자 정보

| 항목 | 내용 |
|------|------|
| **저작권자 명칭** | [미정 - 학교명 또는 팀 대표자] |
| **주소** | [미정] |
| **연락처** | superkkam20@gmail.com |
| **연구과제 번호** | [미정 - 교수님 확인 필요] |
| **지원 기관** | [미정 - 학교/캡스톤디자인 과제 주관기관] |

---

## 4. 프로그램 설명

### 4.1 개발 배경 및 목적

스마트팩토리 환경에서 물류 반송 제어(MCS)와 디스패칭 룰 관리(RTD)는 제조 효율화의 핵심 요소이나, 기존 시스템은 개발자 의존적 룰 수정과 정적 경로 탐색 알고리즘의 한계를 지닌다. 본 소프트웨어는 현장 엔지니어가 코드 없이 디스패칭 룰을 직접 생성·검증할 수 있는 노코드 RTD 플랫폼과, AI 기반 다중 AGV 경로 최적화를 통합하여 기존 A* 알고리즘 대비 반송 효율 20% 이상 개선을 목표로 개발된 스마트팩토리 통합 연구 플랫폼이다.

### 4.2 주요 기능

#### [MCS 모듈] 물류 모델링 및 AI 경로 최적화

| 기능 | 설명 |
|------|------|
| 공장 레이아웃 모델러 | React Flow 기반 드래그앤드롭 장비 배치, AGV 경로 개별/일괄 생성, JSON 저장·버전관리 |
| 반송 명령 생성 및 경로 탐색 | MacroCommand → MicroCommand 분해, A* / PPO / CBS-TS / CACTUS 알고리즘 선택 경로 탐색 |
| AI 기반 경로 최적화 시뮬레이션 | A* vs AI 알고리즘 비교 실험, 반송 시간·처리량·충돌·부하균형 성과 지표 분석 및 CSV 내보내기 |
| 실시간 물류 모니터링 | 레이아웃 위 장비 상태 오버레이, AGV·캐리어 이동 애니메이션, WebSocket 실시간 푸시 |
| RTD 연동 인터페이스 | RTD 디스패칭 결과 수신 후 MacroCommand 자동 생성 |

#### [RTD 모듈] 노코드 디스패칭 룰 빌더

| 기능 | 설명 |
|------|------|
| 룰 그룹 관리 | 트리 구조 CRUD, Fallback 계층 시각화, 장비-이벤트 매핑 설정 |
| 룰 플로우 빌더 | React Flow 기반 드래그앤드롭 시퀀스 편집, SQL 자동 생성 쿼리 빌더, 정렬·파라미터 편집기 |
| 룰 시뮬레이터 | 배포 전 실제 DB 데이터 기반 테스트 실행 및 유효성 검증 |
| 실시간 모니터링 | SSE 기반 룰 실행 로그, 통계 및 성능 분석 |
| LLM 자연어 룰 생성 | 한국어 자연어 입력 → Claude AI (Tool Use) → 룰 플로우 자동 생성, few-shot 예시 기반 JSON 변환, Zod 불변성 검증 후 캔버스 자동 렌더링 |
| MCS-RTD 이벤트 통합 | MCS 반송 완료 이벤트 수신 → 다음 디스패칭 룰 자동 트리거 |

#### [AI 엔진] 경로 최적화 알고리즘

| 알고리즘 | 출처 | 설명 |
|----------|------|------|
| A* (베이스라인) | Hart et al., 1968 | 단일 AMR 정적 최단 경로 탐색 (Dijkstra 동등, 가중 그래프) |
| PPO (강화학습) | Schulman et al., 2017 | Gymnasium 환경 기반 단일 AGV 정책 학습, Stable-Baselines3 |
| CBS-TS | arXiv:2510.21738 | 이종 AMR 다중 에이전트 충돌 회피 탐색 (MLA* + MILP 작업 배분) |
| CACTUS (Baseline 4) | Phan et al., AAMAS 2024 | QMIX Hypernetwork 기반 협력적 다중 AGV 경로 최적화, Reverse Curriculum 학습 |
| **H-CACTUS (본 연구 제안)** | **본 연구** | **MILP(L1) + CACTUS 분산 정책(L2) + CBS Conflict Repair(L3) + Confidence Gate(L4) 4계층 하이브리드** |

### 4.3 기술적 특징 및 독창성

1. **노코드 룰 빌더**: SQL을 모르는 현장 엔지니어가 시각적 플로우 편집만으로 디스패칭 룰을 생성·수정하며, 백엔드에서 SQL 자동 변환 (RTD Phase 1~3 전체 완료)
2. **LLM 자연어 룰 생성**: 한국어 자연어 입력 → Claude AI Tool Use → 룰 플로우 JSON 자동 변환, Zod 불변성 검증(순환 참조·ruleId 유효성) + 1회 자동 재시도 (RTD Task 023 구현 완료)
3. **5중 경로 탐색 전략**: A* / PPO(강화학습) / CBS-TS(다중 에이전트 충돌 회피) / CACTUS(QMIX 협력 최적화) / **H-CACTUS(본 연구 제안 하이브리드)** 5가지 전략을 단일 Strategy Registry API로 런타임 전환
4. **H-CACTUS 하이브리드 알고리즘 (본 연구 제안 독창성)**: CBS-TS의 MILP Task Scheduling(L1) + CACTUS(Phan, AAMAS 2024) 분산 정책(L2) + Localized CBS Conflict Repair(L3) + Confidence Gate(L4)를 계층적으로 결합. 기존 LNS2+RL/PRIMAL/EPH 대비 MILP+MARL+CBS 3중 결합은 본 연구 최초 보고
5. **MCS-RTD 실시간 통합**: 반송 완료 이벤트 → RTD 트리거 REST API 자동 전송, Supabase Realtime + framer-motion 기반 AGV 위치 보간 애니메이션 (Task 020~022 완료)
6. **Turborepo 통합 모노레포**: MCS / RTD / AI-Engine 3개 앱과 공유 패키지(`ui`, `types`, `auth`) 통합 운용

---

## 5. 개발 환경 및 기술 스택

### 프론트엔드
- **언어/프레임워크**: TypeScript 5.6+, Next.js 15 (App Router), React 19
- **빌드 시스템**: Turborepo (모노레포)
- **UI**: TailwindCSS v4, shadcn/ui, React Flow 12.x
- **상태 관리**: Zustand (Undo/Redo), TanStack Query 5.x
- **시각화**: Recharts, framer-motion 11

### 백엔드 (AI 엔진)
- **언어/프레임워크**: Python 3.12+, FastAPI
- **AI/ML**: PyTorch 2.x, Stable-Baselines3 (PPO), PettingZoo (멀티에이전트 환경)
- **알고리즘**: NetworkX (그래프), SimPy (시뮬레이션), PuLP (MILP)

### AI / LLM
- **LLM**: Anthropic Claude 3.5 Sonnet (`@anthropic-ai/sdk`, Tool Use)
- **RL 프레임워크**: PyTorch 2.x, Stable-Baselines3 (PPO), PettingZoo (멀티에이전트)
- **스키마 검증**: Zod (룰 불변성 검증, 순환 참조·ruleId 유효성)

### 인프라 / 데이터
- **데이터베이스**: Supabase (PostgreSQL)
- **인증**: Supabase Auth
- **실시간 통신**: WebSocket, SSE (Server-Sent Events)

### 개발 도구
- **운영체제**: macOS / Linux
- **형상관리**: Git

---

## 6. 첨부 파일 목록 (CROS 제출 시 필요)

| 파일 | 내용 | 비고 |
|------|------|------|
| 소스코드 (발췌본) | 핵심 모듈 소스코드 25~50페이지 | PDF 변환 후 제출 |
| 프로그램 설명서 | 본 신청서 기반 기능 설명 문서 | 본 문서 활용 가능 |
| 창작 완성 증빙 | Git 커밋 히스토리 또는 개발 일지 | 스크린샷 첨부 |

---

## 7. 체크리스트

- [ ] 캡스톤디자인 과제 번호 확인 (교수님)
- [ ] 팀원 전원 성명·소속 확정
- [ ] 저작권자 명의 확정 (개인 vs 학교)
- [ ] 소스코드 발췌본 PDF 준비 (핵심 파일 선별)
- [ ] CROS 회원가입 및 공동저작자 등록
- [ ] 교수님 최종 검토 및 서명
- [ ] GLS 별도 신청 (CROS 완료 후)

---

> **참고**: CROS 등록 완료 후 등록번호를 GLS 신청 시 반드시 기재  
> **예상 소요 기간**: 약 3주 (수수료 납부일 기준)
