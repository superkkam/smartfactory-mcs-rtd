# 2026년 KPI — 솔루션 AI 기술 접목

> 비중: 25% | 목표: 3건 | 목표 등급: E (최고)

---

## 1. 목표 항목 표

| 구분 | 목표 항목 | 비중(%) | '25년 실적 | '26년 목표 | 전년비 | 목표 달성 전략 |
|---|---|---|---|---|---|---|
| 전략목표 | 솔루션 AI 기술 접목 | 25% | — | **3건** | 신규 | ① AI 스마트 로깅 게이트 (Q2): DB 로그 부하 해소, ONNX 분류기 적용, DB INSERT 50%↓<br>② 메시지 스펙→Java 자동생성기 (Q3): Claude AI 코드 자동생성 사내 도구, 통합 시간 85%↓<br>③ LLM 자연어→DMS 룰 생성기 (Q4): 한국어 입력→룰 JSON 자동변환, 작성 시간 80%↓ |

---

## 2. 평가 등급 기준

| 구분 | E (100점) | A (80점) | M (60점) | NI (40점) | 평가 항목 |
|---|---|---|---|---|---|
| AI 기술 접목 건수 | **3건 이상** | 2건 | 1건 | 0건 | • 산출물: PoC 코드 + 정량지표 평가 보고서 완료 시 1건 인정<br>• 예) 결과 3건 / 목표 3건 = 100% → E |

---

## 3. 목표 달성 전략 상세

### ① AI 스마트 로깅 게이트 `Q2 산출`

- **현황**: DB 로그 2중 적재(Logback DBAppender + 비즈니스 로그)로 DB 부하 과다
- **방안**: ONNX/Tribuo 경량 분류기(Java 8 in-process)로 로그 저장 등급 4단계 자동 분류
  - `FULL_DB_FILE` — 에러·알람·이상 패턴
  - `SAMPLE_DB_FILE_FULL` — 정상 응답 (DB 10% 샘플링)
  - `FILE_ONLY` — 반복·헬스체크 (파일만)
  - `SKIP` — 노이즈
- **접목 위치**: `EventLogServiceFactoryImpl.execMCS()/execHOST()` 진입 게이트 + Logback 설정 변경
- **지표**
  - DB INSERT **≥50% 감축**
  - DB CPU/IO **≥30% 감소**
  - 에러·이상 로그 누락 **0건 (Recall 100%)**

---

### ② 메시지 스펙→Java 자동생성기 `Q3 산출`

- **현황**: 신규 메시지 통합 시 VO·파서·핸들러 수동 작성에 30분~2시간 소요
- **방안**: Claude AI + Tool Use로 스펙 입력 시 Java 코드 5종 자동 생성 (사내 개발 도구)
  - `XxxMessageVO.java` — Lombok + Jackson + Bean Validation
  - `XxxParser.java` — 역직렬화 + 필드 검증
  - `XxxHandler.java` — RabbitListener/KafkaListener 스켈레톤
  - `XxxHandlerTest.java` — 단위테스트 스켈레톤
  - `Xxx-integration-guide.md` — 필드 설명 + 다음 작업 가이드
- **지표**
  - 신규 메시지 통합 시간 **≥85% 단축** (30분~2h → 5분)
  - 컴파일 성공률 **≥95%**
  - 필드 매칭 정확도 **≥98%**

---

### ③ LLM 자연어→DMS 룰 생성기 `Q4 산출`

- **현황**: 운영자가 DMS 룰 수동 작성, JSON 구조 직접 입력 필요
- **방안**: Anthropic Java SDK(Java 8 호환)로 한국어 입력→룰 정의 JSON 자동 변환
  - `DmsRuleDefVO` / `DmsRuleQueryVO` / `DmsRuleSortVO` 자동 생성
  - 운영자 확인 후 저장하는 Human-in-the-loop 방식
- **지표**
  - 룰 작성 시간 **≥80% 단축**
  - 생성 정확도 **≥85%**
  - 운영자 만족도 **≥4.0 / 5.0**

---

## 4. 분기별 일정

| 분기 | 산출물 | KPI 누적 |
|---|---|---|
| Q1~Q2 ('26.1~6) | AI 스마트 로깅 게이트 PoC + Before/After 부하 측정 보고서 | **1건** (M) |
| Q2~Q3 ('26.4~9) | 메시지 스펙→Java 자동생성기 PoC + 통합 시간 측정 보고서 | **2건** (A) |
| Q3~Q4 ('26.7~12) | LLM 자연어→DMS 룰 생성기 PoC + 운영자 A/B 평가 보고서 | **3건** (**E**) |

> 매 분기 종료 시: PoC 코드 + 정량지표 보고서 + 사내 기술 발표 1회 패키지 제출

---

## 5. 공통 산출물 기준 (건수 인정 조건)

각 AI 접목 1건 인정 기준:

1. **PoC 코드** 1식 (Git 저장 또는 사내 서버 배포)
2. **정량지표 평가 보고서** 1부 (Before/After 비교 포함)
3. **사내 기술 발표** 1회

---

## 6. 기술 스택 요약

| 후보 | AI 기법 | Java 8 통합 방식 |
|---|---|---|
| AI 스마트 로깅 게이트 | ONNX Runtime Java / Tribuo 경량 분류기 | in-process (외부 호출 없음) |
| 메시지 스펙→Java 자동생성기 | Claude 3.5 Sonnet + Tool Use | 사내 Python 도구 (reference 본체 분리) |
| LLM 자연어→DMS 룰 생성기 | Anthropic Java SDK + Claude Tool Use | Java 8 in-process |

> Spring AI 미사용 (Java 17+ 필요, reference는 Java 1.8 + Spring Boot 2.3.4)
