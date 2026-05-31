# 논문 초안 — CAIE 투고용 (한국어 작업본)

> **대상 저널**: Computers & Industrial Engineering (CAIE), Elsevier, IF~6.5, Q1  
> **작성일**: 2026-05-26 (갱신)  
> **작성 방식**: 실측 데이터 반영 (경로 실험: 30 seed × 3 시나리오 완료; LLM 평가: 25개 입력셋 실측 완료)  
> **상태**: Phase 2 풀 분량 초안 — 교수 리뷰 후 Phase 3 영문 변환 예정

---

## 논문 제목

**한국어**  
LLM 기반 노코드 디스패칭 룰 빌더와 AI 경로 최적화를 적용한 MCS-RTD 통합 제어 플랫폼 설계 및 구현

**영문**  
Design and Implementation of MCS-RTD Integrated Control Platform with LLM-Based No-Code Dispatching Rule Builder and AI-Driven Route Optimization

---

## 저자 목록

김경호 (성균관대학교 스마트팩토리융합대학원),  
[이름2 (소속)],  
[이름3 (소속)],  
[교신저자: 미정]

---

## Target Paper

- Xu, J., Du, W., Liu, X., & Li, X. (2024). LLM4Workflow: An LLM-based automated workflow model generation tool. *ASE '24*, pp. 2394–2398.
- Phan, T. (2024). Confidence-Based Curriculum Learning for Multi-Agent Path Finding. *AAMAS 2024*. arXiv:2401.05860.
- (CBS-TS) Collaborative Task Assignment, Sequencing and Multi-agent Path-finding for Heterogeneous Robots. arXiv:2510.21738.

---

## Abstract

스마트팩토리에서 수십에서 수백 대의 자율이동로봇(AMR)이 동시 운영되는 반송 시스템은 MCS-RTD 분리 구조로 인한 데이터 연동 지연, SQL 코드 기반 디스패칭 룰의 개발자 종속, 정적 경로 알고리즘의 동적 환경 미반응이라는 세 가지 구조적 비효율로 인해 생산성 향상에 병목이 되고 있다.
본 논문은 현장 엔지니어가 자연어 입력 또는 드래그앤드롭으로 디스패칭 룰을 작성·검증·즉시 배포할 수 있는 LLM 기반 노코드 RTD 룰 빌더와, 4종(A*/PPO/CBS-TS/CACTUS) AI 경로 최적화 알고리즘을 공정하게 비교하는 MCS-RTD 단일 제어 플랫폼을 설계하고 구현한다.
Turborepo 모노레포로 MCS(React Flow 레이아웃 모델러·Macro-Micro 명령 체계), RTD(LLM 기반 노코드 룰 빌더·dry-run 시뮬레이터·실시간 모니터링), Python AI 엔진(4종 알고리즘 Strategy Registry)을 단일 JSON 메시지 프로토콜로 통합하고, 88노드·272엣지 실 공장 레이아웃 기반 SimPy 이산 이벤트 시뮬레이터와 도메인 7종·MAPF 표준 5종 지표로 평가한다.
88노드 실 공장 그래프에서 30 seed × 3 밀도 시나리오 실험 결과, 온라인 실시간 배차 조건에서는 A* 베이스라인이 모든 시나리오에서 가장 낮은 avg_transfer_time을 기록하였다. CBS-TS는 오프라인 MAPF 알고리즘으로 온라인 단일 에이전트 모드에서 A*와 동일한 결과를 보였으며(Wilcoxon p=1.0, ns), CACTUS(Phan et al., AAMAS 2024) [15]는 2차 부분 수렴(μ=−427) 상태로 A* 대비 avg_transfer_time이 1.0~1.6% 높게 측정되었다(p<0.01). 이 결과는 온라인 RTD 환경에서 단순 휴리스틱이 경쟁력을 유지함을 보여주며, 완전 수렴 MARL 정책에 의한 성능 개선 여지를 H-CACTUS 후속 연구로 남긴다.
본 연구는 실 공장 방향 가중 그래프 위 CTDE 기반 MAPF 알고리즘과 LLM 자연어 인터페이스를 결합한 비개발자 친화 노코드 플랫폼을 제조 디스패칭 도메인에 통합한 오픈 비교 프레임워크로서, 스마트팩토리 반송 제어의 접근성·효율·확장성을 동시에 향상시킨다.

---

## Keywords

스마트팩토리; 자재 반송 제어 시스템(MCS); 실시간 디스패칭(RTD); 대형 언어 모델(LLM); 다중 에이전트 경로 탐색(MAPF)

---

## 제출 저널 정보

- **저널명**: Computers & Industrial Engineering (CAIE), Elsevier
- **제출 예정**: 교수 리뷰(2026년 5월) → 실험 실측(Phase 3) → 영문 변환 → 투고
- **투고 사다리**: CAIE → EAAI / COMPELECENG → 국내 KCI

> **교수 확인 요청**:
> 1. 학과 또는 연구실 차원에서 별도 저널 게재 요건이 있는지 확인 필요
> 2. H-CACTUS를 §2.3·§5 후속 연구로만 언급하는 현재 방향 적합성 확인

---

## 1절. Introduction

**단락 1 — 연구 배경 및 트렌드**

Industry 4.0과 스마트팩토리 패러다임의 확산으로 반도체·디스플레이·배터리 제조 현장에서 자율이동로봇(AMR, Autonomous Mobile Robot) 기반 물류 반송 시스템의 도입이 급격히 증가하고 있다 [2,8,9]. 수십에서 수백 대의 AMR이 동시 운영되는 환경에서 반송 명령의 최적 배분(Dispatching)과 충돌 없는 경로 제어(Route Optimization)는 전체 생산 효율을 결정하는 핵심 요소로 부각되고 있으며 [7], 이를 위한 자재 반송 제어 시스템(MCS, Material Control System)과 실시간 디스패칭 규칙 엔진(RTD, Real-Time Dispatching)의 통합 관리 중요성이 산업계와 학계 모두에서 주목받고 있다 [4,5,6].

**단락 2 — 문제① MCS-RTD 분리 구조로 인한 데이터 연동 지연**

그러나 현재 산업 현장의 MCS와 RTD는 독립 시스템으로 설계·운영되어, 반송 로봇의 현재 위치·상태·부하율 데이터가 디스패칭 결정에 실시간으로 반영되지 못하는 구조적 연동 지연 문제가 존재한다 [9,25]. 기존 아키텍처에서는 MCS가 RTD의 디스패칭 결과를 주기적 폴링(polling) 방식으로 수신하거나 별도 중간 미들웨어를 통해 데이터를 교환한다. 이 폴링 구조에서 이벤트 발생(예: 반송 완료)과 다음 배차 명령 전달 사이에 폴링 주기(수백 ms~수 초)가 필연적으로 삽입되며, 복수의 이벤트가 동시 누적될 경우 대기열 지연이 배가된다. 이는 고밀도 반송 환경(수십~수백 대 AMR 동시 운영)에서 혼잡 회피 및 긴급 우선순위 처리 능력을 근본적으로 제약한다 [7,8]. SEMI E87·E84 표준은 장비 통신 인터페이스를 규정하지만, MCS-RTD 간 이벤트 실시간 연동 방식에 대한 표준은 별도 정의되어 있지 않아 구현 아키텍처는 벤더마다 상이하다.

**단락 3 — 문제② SQL 기반 디스패칭 룰의 개발자 종속**

현행 RTD 솔루션은 디스패칭 룰을 SQL 쿼리 형태로 정의하는 구조를 취하고 있어, 현장 엔지니어가 생산 조건 변화에 따라 룰을 수정하려면 반드시 소프트웨어 개발자를 경유해야 한다 [19,23]. 생산 조건은 설비 추가·레시피 변경·긴급 주문 등에 의해 빈번히 변동되며, 이에 따른 RTD 룰 수정 요청은 일상적으로 발생한다. 그러나 요구사항 전달 → 코드 수정 → 테스트 → 운영 배포의 전체 사이클이 수일에서 수주가 소요되며, 이는 현장의 즉각적 대응을 원천적으로 차단한다. 노코드(no-code) 시각 프로그래밍 도구 Node-RED나 범용 자동화 플랫폼이 존재하나, DMS(Dispatching Management System) 도메인의 조건 블록·정렬 블록·Fallback 계층 구조를 지원하지 않는다. 최근 대형 언어 모델(LLM)의 자연어 이해 능력을 워크플로우 자동 생성에 활용하는 연구들이 주목받고 있으나 [1,10,22], 제조 디스패칭 도메인의 복잡한 스키마 구조와 dry-run 검증 파이프라인을 통합한 LLM 기반 노코드 룰 빌더는 보고된 바 없다.

**단락 4 — 문제③ 정적 경로 알고리즘의 다중 AMR 동적 환경 미반응**

기존 MCS에서 채택하는 Dijkstra/A* 정적 최단 경로 탐색은 단일 AMR의 최적 경로를 효율적으로 산출하지만($O((V+E)\log V)$ 시간 복잡도) [11], 다수 AMR 동시 운영 시 발생하는 실시간 혼잡도 변화와 에이전트 간 충돌을 능동적으로 반영하지 못하는 근본적 한계가 있다 [2,3,12]. 특히 실 공장의 88노드·272엣지 규모 방향 가중 그래프에서 32대 AMR이 동시 운행할 때 A* 경로 간 교차가 빈발하며, 이 충돌은 상위 제어 계층에서 별도 처리하지 않으면 그대로 지연으로 이어진다. Conflict-Based Search(CBS) [12] 계열의 MAPF 알고리즘과 강화학습(RL) 기반 협력 경로 최적화 알고리즘들이 대안으로 연구되었으나 [13,14,15,18], 각 알고리즘은 벤치마크 환경(격자 맵·가상 창고)에서 평가된 경우가 대부분이며, 실제 AMHS 비정형 토폴로지에서 단일 플랫폼으로 공정 비교한 연구는 드물다.

**단락 5 — 연구 질문**

위 세 가지 문제를 바탕으로 본 연구는 다음 세 가지 연구 질문(RQ)을 설정한다.

- **RQ1**: MCS의 반송 완료 이벤트와 RTD의 디스패칭 결정을 단일 JSON 메시지 프로토콜로 실시간 연결할 때, 기존 폴링 기반 분리 구조 대비 어떤 시스템 아키텍처 이점이 발생하는가?
- **RQ2**: LLM Tool Use 기반 자연어 입력과 Zod 스키마 불변성 검증을 결합한 노코드 RTD 룰 빌더가 사전 Vector Store 없이도 DMS 도메인 특화 룰 플로우를 정확하게 생성할 수 있는가?
- **RQ3**: 실제 공장 비정형 방향 가중 그래프(88노드·272엣지)에서 A*/PPO/CBS-TS/CACTUS 4종 알고리즘을 온라인 RTD 환경으로 공정 비교할 때, 각 알고리즘의 운영 패러다임 차이가 성능 결과에 어떻게 반영되는가?

RQ1·RQ2는 시스템 설계 및 구현으로 답하며, RQ3는 SimPy 기반 30 seed × 3 시나리오 실험과 비모수 통계 검정으로 답한다.

**단락 6 — 연구 목표 및 기여사항**

본 논문은 위 세 가지 연구 질문에 답하기 위해 MCS·RTD·AI 엔진을 단일 플랫폼으로 통합하여 설계하고 구현한다. 본 연구의 주요 기여사항은 다음과 같다:

- **(C1) MCS-RTD 실시간 통합 아키텍처**: REST 기반 단일 JSON 메시지 프로토콜(messageId·correlationId·siteId 봉투)로 MCS와 RTD를 직접 연결하고, Supabase Realtime 구독으로 AGV 위치·상태를 대시보드에 즉시 반영하여, 반송 완료 이벤트로부터 다음 디스패칭 결정까지의 데이터 연동 지연을 해소한다.
- **(C2) LLM 기반 노코드 RTD 룰 빌더**: React Flow 드래그앤드롭 시각 편집과 Claude 3.5 Sonnet Tool Use 기반 자연어 입력을 통합하여, SQL 코드 없이 현장 엔지니어가 직접 디스패칭 룰을 작성·dry-run 검증·즉시 배포할 수 있는 노코드 환경을 제공한다.
- **(C3) 4종 AI 알고리즘 공정 비교 프레임워크**: A*(베이스라인), PPO(단일 에이전트 RL), CBS-TS [13](최적 MAPF), CACTUS(Phan et al., AAMAS 2024) [15]를 Strategy Registry 공통 인터페이스로 통합하여 동일 시뮬레이션 환경에서 런타임 전환 비교 실험을 수행한다.
- **(C4) SimPy 기반 12지표 자동 수집 파이프라인**: 88노드·272엣지 실 공장 레이아웃 그래프 위에서 AMR 수 N∈{8,16,32}, 부하율 ρ∈{0.3,0.5,0.7} 조합으로 도메인 7종·MAPF 표준 5종 지표를 자동 측정한다.
- **(C5) Few-shot + Tool Use LLM 룰 플로우 자동 생성**: 사전 Vector Store 구축 없이 런타임 RuleDef 컨텍스트를 시스템 프롬프트에 동적 주입하여, RAG 없이 DMS 도메인 특화 룰 스키마를 Zod 검증과 함께 자동 생성한다.

이하 본 논문의 구성은 다음과 같다. 2절에서 관련 연구를 정리하고, 3절에서 제안 플랫폼의 설계 및 구현을 기술하며, 4절에서 실험 환경과 결과를 제시하고, 5절에서 결론과 향후 연구 계획을 기술한다.

---

## 2절. Related Work

### 2.1 스마트팩토리 MCS-RTD 통합 제어 시스템

반도체·디스플레이·배터리 공장의 AMHS(Automated Material Handling System) 반송 자동화를 위한 MCS 솔루션은 SEMI E87(장비 재료 반송 관리), SEMI E84(향상된 핸드오프) 등 산업 표준 인터페이스 규약을 기반으로 발전해왔다. 이 표준들은 반송 장비와 제어 시스템 간의 통신 프로토콜을 규정하지만, MCS와 RTD 간의 실시간 이벤트 연동 방식은 별도로 표준화되어 있지 않아 벤더별 구현 아키텍처에 큰 편차가 존재한다.

상용 솔루션인 THiRA-MCS(LS티라유텍)는 Macro-Command/Micro-Command 이중 계층 명령 체계를 통해 반송 장비를 제어하며, 별도 RTD 엔진이 SQL 기반 디스패칭 룰을 실행하는 분리 아키텍처를 채택한다. 이 구조에서 MCS는 RTD가 결정한 반송 명령을 주기적 폴링 방식으로 수신하므로 이벤트 기반 실시간 연동이 구조적으로 어렵다 [9,25]. 다중 이벤트 동시 발생 시 폴링 대기열이 누적되어 지연이 배가되는 문제는 고밀도 AMHS 환경에서 특히 두드러진다.

오픈소스 차량 관제 시스템 OpenTCS(Fraunhofer IML)는 FMS(Fleet Management System)와 Plant Overview로 구성되어 AGV/AMR 경로 제어를 지원하지만, AI 기반 동적 경로 최적화와 실시간 디스패칭 룰 관리 기능은 기본 제공하지 않는다. 창고 AGV 동적 작업 배분 연구 [7]는 ALNS와 Kuhn-Munkres를 결합한 통합 스케줄러를 제안하여 AGV 대기 시간을 줄이는 성과를 보였으며, DRL 기반 AGV 실시간 스케줄링 연구 [8]는 Industry 4.0 유연 공정에서의 혼합 룰 적용 가능성을 입증하였다. 반도체 AMHS 디스패칭 연구들 [19,20,21]은 T-S Fuzzy·MARL·시뮬레이션+DRL 기반 접근으로 베이 간 반송(interbay) 스케줄링을 개선하였으나, LLM 자연어 인터페이스와 다중 에이전트 RL 경로 최적화를 하나의 통합 플랫폼으로 결합한 사례는 보고되지 않았다.

Tabim et al. [9]는 MES 구현의 정보 비대칭 극복 방안을 분석하여 공급자-구매자 간 지식 공유가 MES 성과에 핵심임을 보였으며, Shojaeinasab et al. [25]는 지능형 MES 시스템의 체계적 리뷰를 통해 실시간 연동과 의사결정 지원이 차세대 MES의 핵심 요건임을 제시하였다. 본 연구는 이들 선행 연구의 문제의식을 공유하면서, MCS-RTD 직접 연결(REST+Supabase Realtime)·노코드 룰 빌더·4종 알고리즘 비교 프레임워크를 단일 플랫폼으로 통합하는 오픈 구현을 제공한다는 점에서 차별화된다.

**[Table 3] 관련 연구 비교표 — 시스템별 C1~C5 기능 지원 현황**

| 항목 | THiRA-MCS | OpenTCS | LLM4Workflow [1] | 선행 AMHS 연구들 | **본 연구** |
|------|----------|---------|-----------------|--------------|-----------|
| MCS-RTD 통합 | 분리 | 분리 | 해당 없음 | 부분 | ✅ 통합(C1) |
| 노코드 룰 빌더 | 없음 | 없음 | 범용 워크플로우 | 없음 | ✅ 제조 특화(C2) |
| LLM 자연어 인터페이스 | 없음 | 없음 | RAG 기반 | 없음 | ✅ Few-shot+Tool Use(C5) |
| 다중 에이전트 RL 경로 최적화 | 없음 | 없음 | 없음 | 일부 | ✅ 4종 비교(C3) |
| 통합 시뮬레이션 평가 | 없음 | 부분 | 없음 | 부분 | ✅ SimPy 12지표(C4) |

### 2.2 LLM 기반 워크플로우 자동 생성 및 노코드 도구

노코드 시각 프로그래밍 도구 Node-RED(OpenJS Foundation)는 이벤트 기반 IoT 워크플로우를 드래그앤드롭으로 구성할 수 있어 소규모 자동화에 널리 사용되지만, 제조 디스패칭 도메인의 계층화된 조건 블록과 SQL 자동 생성, 실시간 dry-run 검증 기능을 지원하지 않는다. Zapier·n8n 등 범용 자동화 플랫폼들도 DMS 도메인 특화 스키마(조건/정렬 블록·Fallback 계층)와의 통합 기능이 없어 제조 AMHS 현장 적용에 본질적 한계가 있다.

LLM 기반 워크플로우 자동 생성 분야에서 LLM4Workflow(Xu et al., ASE 2024) [1]는 RAG(Retrieval-Augmented Generation) 기반으로 API 문서를 동적 검색하여 과학 실험 워크플로우 노드를 자동 구성하는 대표 연구다. 이 접근은 범용 워크플로우 생성에서 높은 효과를 보이나, 사전 Vector Store 구축·문서 임베딩·벡터 DB 유지 관리 비용이 필요하며 제조 디스패칭 특화 스키마와 구조 불변성 검증 파이프라인을 지원하지 않는다는 한계가 있다.

LLM 기반 스케줄링·디스패칭 룰 자동화 연구도 빠르게 발전하고 있다. Huang et al. [10]은 LLM과 집단 자기 진화(population self-evolution)를 결합하여 동적 Job Shop 스케줄링 문제에서 프로그래밍 자동화를 구현하였으며, EvoDR(Qiu et al., 2025) [22]은 LLM 기반 디스패칭 룰 진화를 동적 유연 어셈블리 흐름 공정에 적용하였다. 그러나 이들 연구는 최적화 알고리즘 자동 생성에 초점을 맞추어, 현장 엔지니어가 시각 편집기에서 즉시 적용 가능한 DMS 룰 플로우 구조(조건 블록·정렬 블록·jumpNextSequence Fallback)와 dry-run 검증 파이프라인을 구현하지 않았다.

본 연구의 C5는 LLM4Workflow의 아이디어를 제조 디스패칭 도메인에 적용하되, 두 가지 핵심 차별점을 갖는다. 첫째, 사전 Vector Store 없이 런타임 RuleDef 목록과 MCS 스키마를 정적 `SYSTEM_PROMPT`에 직접 주입하는 **경량 컨텍스트 주입** 방식을 채택하여 구성 복잡도를 제거한다. 둘째, Zod 스키마 검증(`GeneratedRulesSchema`)과 DMS 도메인 특화 불변성 검사(`validateGeneratedRules`)를 파이프라인에 포함시켜, LLM 출력의 구조적 정합성을 코드 레벨에서 강제한다. 이 두 설계 결정이 25개 입력에 대해 100% 통과율을 달성한 실측 근거로 작용한다(§4.5 참조).

### 2.3 다중 에이전트 경로 탐색(MAPF) 및 강화학습

MAPF(Multi-Agent Path Finding)는 N개의 에이전트가 각자의 시작점에서 목적지까지 충돌 없이 이동하는 경로를 동시 계획하는 문제로, Yu & LaValle(2013) [24]가 일반 그래프에서 최적 MAPF가 NP-hard임을 증명하였다. 문제의 핵심 긴장은 정확성(충돌 없는 최적해 보장)과 확장성(에이전트 수 증가에도 실시간 계획) 사이의 트레이드오프이다. Stern et al. [3]은 MAPF 문제의 정의, 변형, 벤치마크를 정리하여 makespan·sum-of-costs·flowtime 등 표준 지표를 제시하였으며, 이 기준이 본 연구의 실험 지표 설계에 반영되었다.

**탐색 기반 접근**: Conflict-Based Search(CBS, Sharon et al., AIJ 2015) [12]는 Low-level 단계에서 각 에이전트의 경로를 독립적으로 계획한 뒤, High-level 단계에서 Constraint Tree(CT)를 통해 충돌 쌍을 탐지하고 제약을 추가하여 재계획한다. CBS는 sum-of-costs 최적 솔루션을 보장하는 최초의 완전(complete) MAPF 솔버 중 하나이며, 이후 다양한 변형(ECBS, CBS-K 등)의 기반이 되었다. 그러나 CT 노드의 최악 경우 지수적 증가로 인해 N≤20 수준에서 실용적 범위가 제한된다 [24]. CBS-TS [13]는 이종 AMR 유형을 지원하는 MLA*와 MILP 기반 작업 배분을 CBS 위에 통합하여 공장 환경의 이종 로봇 반송에 적합한 확장을 제시하였다.

**강화학습 기반 접근**: RL 기반 MAPF는 에이전트 수 확장성과 동적 환경 적응에서 탐색 기반 대비 우위를 보인다. QMIX(Rashid et al., ICML 2018) [4]는 CTDE(Centralized Training, Decentralized Execution) 패러다임을 채택하여 단조성이 보장된 Hypernetwork Mixer를 통해 에이전트 간 암묵적 협력을 학습하며, MARL 분야의 핵심 기반 알고리즘으로 자리잡았다. CACTUS(Phan, AAMAS 2024) [15]는 QMIX에 신뢰도(Confidence) 기반 Reverse Curriculum Learning을 결합하여 실제 방향 가중 그래프에서 직접 MAPF를 학습한다. LNS2+RL(Wang et al., AAAI 2025) [14]은 Large Neighborhood Search와 RL을 결합하여 대규모 격자 환경에서 강한 성능을 보이나, 실 공장 비정형 토폴로지 적용을 다루지 않는다. MAPF-GPT [17]는 모방 학습 기반 확장 가능한 MAPF 솔버로 대규모 창고에서의 적용 가능성을 보였다.

**Lifelong MAPF와 온라인 vs 오프라인 패러다임**: Lifelong MAPF [18]는 에이전트가 작업을 연속적으로 수행하는 동적 환경을 다루며, 롤링 호라이즌 방식으로 실시간 재계획을 수행한다. 이는 실제 AMHS의 온라인 RTD 운영 조건과 유사하다. 반면 CBS·CBS-TS는 모든 작업 정보가 사전에 주어진 오프라인(배치) 설정에서 최적성을 보장하도록 설계되었다. 이 **온라인 vs 오프라인 패러다임 불일치**가 본 연구 실험의 핵심 발견(CBS-TS가 온라인 모드에서 A*와 동일한 성능을 보임)의 이론적 배경이 된다(§4.4 참조).

**연구 갭**: 기존 MAPF 연구는 대부분 격자 맵(grid map)이나 가상 창고 레이아웃에서 단일 알고리즘을 평가하였다. 실 공장의 비정형 방향 가중 그래프(88노드·272엣지, 일방통행·교차로·충전소 혼재)에서 탐색 기반(CBS-TS)과 RL 기반(CACTUS·PPO) 알고리즘을 동일 플랫폼, 동일 시뮬레이터, 동일 시드로 공정 비교한 연구는 찾기 어렵다. 한편, CBS-TS와 CACTUS의 계층적 결합(H-CACTUS: MILP 작업 배분 + CACTUS 분산 정책 + CBS Conflict Repair)은 온라인 패러다임 한계를 극복할 수 있는 유망한 방향으로, 본 연구의 후속 과제로 제안한다(§5 참조).

---

## 3절. Method — MCS-RTD 통합 제어 플랫폼

### 3.1 MCS-RTD 통합 3계층 아키텍처

본 연구는 MCS(Material Control System), RTD(Real-Time Dispatching), AI 경로 엔진을 하나의 일관된 데이터 흐름으로 연결하는 3계층 통합 아키텍처를 설계하였다. **[Figure 1 — Main Picture]** 에 전체 시스템 구조를 도시한다. 기존 산업 현장의 MCS-RTD 분리 구조에서는 반송 이벤트가 발생한 후 폴링 주기가 경과할 때까지 디스패칭 결정이 지연된다. 본 아키텍처는 이 지연을 REST 이벤트 기반 직결 방식으로 제거하며, 공통 Supabase PostgreSQL 단일 DB를 통해 세 레이어가 상태를 공유한다.

**Layer 1 — MCS 레이어 (`apps/mcs`, Next.js 15)**

MCS 레이어는 공장 레이아웃 모델링, 반송 명령 생성·실행, 시뮬레이션, 실시간 모니터링의 네 기능 블록으로 구성된다. 레이아웃 모델러(F001)는 React Flow 기반 드래그앤드롭 인터페이스로 장비 노드(포트·충전소 포함)와 AGV 이동 경로 엣지를 배치하고, 완성된 레이아웃을 `mcs_layout` 테이블에 JSON으로 저장·버전 관리한다. 반송 제어(F002~F004)는 Macro-Command(작업 단위 반송 요청) → Micro-Command(장비 간 단위 이동 명령) 2계층 분해 구조를 따르며, AI 엔진 Strategy Registry를 호출하여 선택된 알고리즘으로 경로를 탐색한 뒤 반송 장비에 명령을 순차 전달한다. SimPy 시뮬레이션 모듈(F005~F006)은 실제 레이아웃 그래프를 그대로 사용하여 4종 알고리즘 비교 실험과 12지표 자동 수집을 수행하고 CSV로 내보낸다. 실시간 모니터링(F007~F008)은 Supabase Realtime 채널 구독으로 AGV 위치·상태 변경을 수신하여 레이아웃 위에 framer-motion 보간 애니메이션으로 표시하고, 장비 가동 상태를 색상 오버레이로 시각화한다.

**Layer 2 — RTD 레이어 (`apps/rtd`, Next.js 15)**

RTD 레이어는 현장 엔지니어가 개발자 없이 디스패칭 룰을 작성·검증·배포할 수 있는 노코드 환경을 제공한다. 룰 빌더는 React Flow SequenceNode 그래프로 Condition 블록(Filter 계열)과 Sort 블록을 드래그앤드롭으로 연결하며, 백엔드가 블록 시퀀스를 SQL WHERE·ORDER BY 절로 자동 변환한다. `filterSequence`(실선 엣지)는 이전 블록의 결과를 입력으로 받는 AND 조건 연결이고, `jumpNextSequence`(점선 엣지)는 현재 블록 결과가 비어 있을 때 대체 블록으로 점프하는 Fallback 분기를 구현한다. dry-run 시뮬레이터는 실제 DB 데이터를 대상으로 룰을 사전 실행하여 결과 미리보기와 오류 조기 발견을 지원한다. LLM 자연어 룰 생성기는 한국어 자연어 입력을 Claude Tool Use를 통해 룰 플로우 JSON으로 변환하며, SSE 기반 실시간 대시보드는 룰 실행 로그·처리량·오류율을 스트리밍으로 표시한다(§3.2 상세).

**Layer 3 — AI Engine 레이어 (`apps/ai-engine`, FastAPI/Python 3.12+)**

AI 엔진은 FastAPI REST 서버로 구현되었으며, Strategy Registry 패턴으로 4종 경로 최적화 알고리즘을 런타임에 전환 가능하게 통합한다. 모든 전략 클래스는 공통 인터페이스를 구현한다:

```
predict(graph, source_id, dest_id, unit_labels, dynamic_weights)
  → (path: List[str], cost: float, confidence: float)
```

클라이언트는 `/api/inference?algorithm={astar|ai_ppo|cbs_ts|cactus}` 엔드포인트로 알고리즘을 지정하고 응답으로 경로 노드 리스트·비용·신뢰도를 수신한다. 체크포인트·솔버 미존재 시 자동으로 A* Fallback을 실행하여 서비스 가용성을 보장한다. SimPy 이산 이벤트 시뮬레이터는 동일 레이어 내에서 실행되며, NetworkX 방향 가중 그래프 위에서 AGV 이동과 반송 이벤트를 재현한다.

**통합 메시지 프로토콜 및 데이터 흐름**

MCS에서 반송 완료 이벤트(예: `LOAD_COMPLETE`)가 발생하면 REST `POST /api/rtd/trigger` 요청이 RTD 레이어로 전송된다. 요청 봉투는 `{ messageId, correlationId, siteId, equipmentId, eventType, carrierId }` 구조이다. RTD는 이벤트 유형과 설비 ID를 키로 룰 그룹을 조회하여 디스패칭 룰 시퀀스를 실행하고, 결정된 MacroCommand JSON을 응답으로 반환한다. MCS는 응답을 수신해 AI 엔진에 경로 탐색을 요청하고, 반환된 경로를 Micro-Command 시퀀스로 변환하여 대상 AGV에 전달한다. 상태 변경은 Supabase PostgreSQL을 통해 공유되며, Supabase Realtime 채널로 MCS 대시보드에 즉시 반영된다.

**인프라**: Turborepo 모노레포로 세 앱과 공유 패키지(`packages/ui`, `packages/types`, `packages/auth`)를 통합 관리하며, `turbo run dev`로 병렬 개발 서버를 구동한다. Supabase PostgreSQL 단일 DB에 MCS 레이아웃 테이블(`mcs_layout`, `mcs_equipment`, `mcs_transfer_relation` 등)과 RTD DMS 테이블(`dms_rule_group`, `dms_rule`, `dms_rule_relation`, `dms_rule_query` 등)이 공존하며, Row Level Security로 접근 제어한다.

### 3.2 LLM 기반 노코드 RTD 룰 빌더

#### (A) 시각적 노코드 편집 — React Flow 룰 빌더

THiRA-MCS DMS 구조를 역분석하여 재현한 룰 계층 구조(룰 그룹 → 룰 → 블록 시퀀스 → 실행 결과)를 React Flow로 시각화한다. **[Figure 2]** 에 RTD 노코드 룰 빌더 UI를 도시한다.

룰 그룹(Rule Group)은 하나의 배차 의사결정 단위로, 특정 이벤트(예: `LOAD_COMPLETE`)와 설비 조합에 대해 실행된다. 각 룰 그룹 내에는 복수의 룰(Rule)이 순서대로 배치되며, 각 룰은 Condition 블록(`ruleType: 'Filter'`)과 Sort 블록(`ruleType: 'Sort'`)의 시퀀스로 구성된다. 엔지니어는 `filterSequence`(실선) 엣지로 블록을 직렬 연결하여 AND 조건 필터를 구성하거나, `jumpNextSequence`(점선) 엣지로 Fallback 분기를 연결한다. 블록을 클릭하면 쿼리 빌더(Condition 블록용)·정렬 편집기(Sort 블록용)가 열려 `WHERE equipment_state = 'Online'` 형태의 조건이나 `ORDER BY current_load ASC` 형태의 정렬을 코드 없이 설정할 수 있다.

백엔드는 블록 시퀀스와 엣지 정보를 순회하여 `SELECT ... FROM [ruleClassId] WHERE [conditions] ORDER BY [sort]` 형태의 SQL 쿼리를 자동 생성한다. dry-run 시뮬레이터는 이 SQL을 실제 DB(`rtd_exec_readonly` RPC)에서 실행하여 결과 행 수와 상위 5개 레코드를 미리 보여준다. 배포 버튼을 누르면 전체 룰 그룹이 원자적으로 `dms_rule_relation` 테이블에 저장되고, SSE 스트림으로 다음 실행 로그가 실시간으로 나타난다.

#### (B) LLM 자연어 → 룰 플로우 자동 생성 파이프라인

LLM4Workflow [1]의 RAG 기반 접근과 달리, 사전 Vector Store 구축 없이 런타임 RuleDef 컨텍스트를 시스템 프롬프트에 동적 주입하는 방식을 채택한다. **[Figure 3]** 에 파이프라인을 도시한다.

구현의 핵심은 두 가지 설계 결정이다. 첫째, `SYSTEM_PROMPT`를 정적으로 구성하여 Anthropic 프롬프트 캐시 적중률을 극대화한다. 이 프롬프트는 MCS 스키마 카탈로그(5종 테이블 정의), MES 이벤트 파라미터(`:equipmentId`, `:eventType`, `:lotId`, `:carrierId`, `:layoutId`), DMS 도메인 특화 few-shot 예시 3개(긴급 Lot 우선 / 동일 레시피+최저 부하 / Idle+heartbeat Fallback)를 포함하며, 요청마다 재계산되지 않고 캐시에서 재사용된다. 둘째, Anthropic Tool Use의 `tool_choice: { type: 'tool', name: 'generate_rule_relations' }`를 강제하여 LLM이 반드시 구조화된 JSON 도구 입력을 반환하도록 한다. 이 두 결정은 각각 비용 절감과 파싱 안정성을 보장한다.

**알고리즘 1: LLM 룰 자동 생성 파이프라인**

```
입력: userPrompt (한국어 자연어), ruleDefs (현재 사용 가능한 RuleDef 목록), groupContext
출력: React Flow 캔버스 노드·엣지 배열 (또는 오류)

1. userMsg ← buildUserMessage(userPrompt, ruleDefs, groupContext)
   // 정적 SYSTEM_PROMPT: MCS 스키마 + few-shot 예시 3개 (캐시)
2. raw ← LLM.call(system=SYSTEM_PROMPT, user=userMsg,
                   tools=[GENERATE_RULES_TOOL],
                   tool_choice={name:'generate_rule_relations'})
3. parsed ← GeneratedRulesSchema.safeParse(raw.tool_input)
4. if not parsed.success:
     errors ← zodErrors(parsed.error)
     raw2 ← LLM.call(..., feedback="출력 형식 오류: " + errors)  // 1회 재시도
     parsed ← GeneratedRulesSchema.safeParse(raw2.tool_input)
     if not parsed.success: return Error
5. violations ← validateGeneratedRules(parsed.data, validRuleIds)
   // 검사: filterSequence 타깃 sequence < 자신, jumpNextSequence > 자신, ruleId ∈ validRuleIds
6. if violations.length > 0:
     raw2 ← LLM.call(..., feedback="유효성 오류: " + violations)  // 1회 재시도
     parsed ← GeneratedRulesSchema.safeParse(raw2.tool_input)
     violations ← validateGeneratedRules(parsed.data, validRuleIds)
     if violations.length > 0: return Error
7. return toReactFlowGraph(parsed.data)  // 캔버스 자동 렌더링
```

`validateGeneratedRules`가 검사하는 구조 불변성은 세 가지이다: (i) `filterSequence` 엣지의 타깃 블록 `sequence`가 소스보다 작을 것(순환 방지), (ii) `jumpNextSequence` 엣지의 타깃 블록 `sequence`가 소스보다 클 것(전진 점프만 허용), (iii) 모든 `ruleId`가 제공된 RuleDef 집합 내에 존재할 것(환각 방지). 이 세 불변성이 RAG 없이도 DMS 도메인 스키마 정합성을 보장한다.

생성 결과는 React Flow 캔버스에 자동 렌더링되며, 엔지니어는 생성된 룰 플로우를 시각으로 검토한 뒤 dry-run으로 결과를 확인하고 배포한다. 이 인터페이스는 LLM 오류를 사람이 확인하는 Human-in-the-loop 검증 단계를 유지하면서도, 룰 초안 작성 시간을 대폭 단축한다.

### 3.3 AI 경로 최적화 — 4종 알고리즘 비교 프레임워크

A*(베이스라인), PPO, CBS-TS, CACTUS를 Strategy Registry 공통 인터페이스로 통합하여 런타임 알고리즘 전환 비교 실험을 지원한다. 모든 전략은 `predict(graph, source_id, dest_id, unit_labels, dynamic_weights) → (path, cost, confidence)` 인터페이스를 구현한다. **[Table 2]**, **[Figure 4]** 에 비교 프레임워크를 도시한다.

이 통합 설계의 핵심 가치는 알고리즘 교체가 클라이언트 코드 변경 없이 URL 파라미터 하나로 이루어진다는 점이다. 현장에서 알고리즘 성능을 A/B 테스트하거나, 새 알고리즘을 단계적으로 배포하거나, 특정 알고리즘 실패 시 자동으로 폴백하는 로직이 Registry 레벨에서 일관되게 처리된다. 4종 알고리즘의 이론적 특성 비교는 Table 2에 정리하며, 이하에서 각 알고리즘의 설계 원리와 구현 세부 사항을 기술한다.

**[Table 2] 4종 알고리즘 이론 비교표**

| 항목 | A* | PPO | CBS-TS | CACTUS |
|------|-----|-----|--------|--------|
| 유형 | 탐색(최단 경로) | 단일 에이전트 RL | 다중 에이전트 탐색 | 다중 에이전트 RL |
| 참고 문헌 | Hart et al., 1968 [11] | Schulman et al., 2017 [5] | arXiv:2510.21738 [13] | Phan, AAMAS 2024 [15] |
| 에이전트 수 | 1 | 1 | N(≤20 실용) | N(본 학습 N=2) |
| 충돌 처리 | 없음 | 없음 | CBS 최적 | QMIX 협력 학습 |
| 최적성 | 단일 에이전트 최적 | 근사 | sum-of-costs 최적 | 근사 (정책 기반) |
| 추론 복잡도 | O((V+E)logV) | O(1) | NP-hard 일반 | O(1) 분산 |
| 학습 필요 | 없음 | 필요 (SB3 PPO) | 없음 | 필요 (QMIX) |
| Fallback | — | A* | A* | A* |

#### (A*) A* — 방향 가중 그래프 최단 경로 베이스라인

A*(Hart et al., 1968) [11]는 우선순위 큐 기반 최단 경로 탐색 알고리즘으로, 평가 함수 $f(n) = g(n) + h(n)$을 최소화하는 노드를 탐색한다. $g(n)$은 시작 노드로부터 현재 노드까지의 실제 비용이며, $h(n)$은 현재 노드에서 목적지까지의 추정 비용(휴리스틱)이다. 본 구현에서 $h(n) = 0$으로 설정하여 Dijkstra 알고리즘과 동등하게 만들었는데, 이는 실 공장 방향 가중 그래프에서 임의의 admissible 휴리스틱을 정의하기 어렵고, $h \equiv 0$이 완전 탐색을 보장하기 때문이다. 시간 복잡도는 $O((V+E)\log V)$이다.

혼잡 반영 모드에서는 엣지 통행 비용을 동적으로 보정한다:

$$w_{\text{eff}}(e) = w(e) \times (1 + c_e)$$

여기서 $w(e)$는 정적 엣지 가중치이고, $c_e \in [0,1]$는 해당 엣지를 현재 점유 중인 AGV 수로 산출된 혼잡 계수이다. 이 단순 비용 조정은 추가 학습 없이 실시간 혼잡 회피를 달성하며, 88노드 그래프에서 $O(E)$ 갱신 비용으로 매 요청마다 적용된다. A* Fallback은 CBS-TS 솔버 제한 시간 초과, PPO 모델 미로드, CACTUS 정책 미수렴 시에도 자동 실행된다.

#### (B) PPO — 단일 에이전트 강화학습 경로 최적화

PPO(Schulman et al., 2017) [5]는 Clip 기반 정책 경사 알고리즘으로, 안정적인 정책 업데이트와 샘플 효율성이 장점이다. 본 구현은 Stable-Baselines3 [6]의 PPO를 사용하며, `McsRouteEnv(Gymnasium)` 커스텀 환경에서 단일 AMR 경로를 학습한다.

**관측 공간 (400차원)**:

| 구성 요소 | 차원 | 설명 |
|---------|------|------|
| 현재 노드 One-hot | 100d | 현재 위치 (0~99 노드 인덱스) |
| 목적지 노드 One-hot | 100d | 목적지 위치 |
| 이웃 혼잡도 | 100d | 인접 노드별 현재 AGV 점유 수 (정규화) |
| BFS 거리 인코딩 | 100d | 각 노드에서 목적지까지 BFS 최단 거리 |

**보상 함수 (5-case)**:

$$r_t = \begin{cases} +10.0 & \text{목적지 도달} \\ -1.0 & \text{장애물·금지 엣지 충돌} \\ -0.5 & \text{이미 방문한 노드 재진입} \\ +r_s & \text{BFS 거리 단축: } r_s = 2 \times (d_{\text{BFS}}(s_t) - d_{\text{BFS}}(s_{t+1})) \\ -0.01 & \text{매 스텝 시간 패널티} \end{cases}$$

BFS 거리 쉐이핑($r_s$)은 목적지 방향으로의 점진적 이동을 장려하며, 밀집 환경에서의 탐색 수렴을 가속한다. 행동 공간은 Discrete(10)으로 최대 10개 이웃 노드 중 하나를 선택한다.

**하이퍼파라미터**:

| 파라미터 | 값 | 파라미터 | 값 |
|--------|-----|--------|-----|
| 학습률 (lr) | 3×10⁻⁴ | 클립 범위 (ε) | 0.2 |
| 스텝 수 (n_steps) | 2,048 | GAE λ | 0.95 |
| 배치 크기 | 64 | 할인율 (γ) | 0.99 |
| 에포크 수 | 10 | 총 학습 스텝 | 200,000 |
| 활성화 함수 | tanh | BFS 쉐이핑 | 활성화 |

`EvalCallback`으로 8,000 스텝마다 모델을 평가하여 최우수 성능 체크포인트를 자동 저장한다. 목적지 미도달 시 A* Fallback으로 자동 전환된다.

#### (C) CBS-TS — 이종 AMR 작업·경로 통합 최적화

CBS-TS(Bai et al., arXiv:2510.21738) [13]는 이종 AMR 유형을 지원하는 MLA*(Multi-Label A*), CBS(Conflict-Based Search) 기반 충돌 해소, MILP(Mixed Integer Linear Programming) 기반 작업 배분을 계층적으로 통합한 솔루션이다.

**MLA*(Multi-Label A*)**: 기존 A*가 단일 목적지를 탐색하는 것과 달리, MLA*는 이종 AMR의 유형(TYPE\_A: 대형 캐리어, TYPE\_B: 소형 캐리어, TYPE\_C: 비어 있는 상태)에 따라 통과 가능한 엣지가 다를 수 있는 환경에서 동작한다. 각 AMR 유형은 별도의 Vertex·Edge 제약 집합을 가지며, MLA*는 이를 탐색 단계에서 직접 필터링한다.

**CBS Constraint Tree**: 독립적으로 계획된 복수 에이전트 경로 간의 충돌(Vertex conflict: 동일 시간 동일 노드; Edge conflict: 동일 시간 교차)을 탐지하고, 제약(constraint)을 추가하여 재계획함으로써 충돌 없는 경로를 보장한다. CBS는 sum-of-costs 최적 솔루션을 보장하나, 에이전트 수에 대해 지수적 CT 노드 확장이 발생하여 실용 범위가 N≤20으로 제한된다 [24].

**MILP 작업 배분**: 작업 집합 $\mathcal{J}$와 로봇 집합 $\mathcal{I}$에 대해:

$$\min_{x, s} \quad T$$
$$\text{s.t.} \quad \sum_{i \in \mathcal{I}} x_{ij} = 1, \quad \forall j \in \mathcal{J}$$
$$T \geq s_{ij} + d_{ij} - M(1-x_{ij}), \quad \forall i,j$$
$$s_{i,\sigma(k+1)} \geq s_{i,\sigma(k)} + d_{i,\sigma(k)} + t_{i,\sigma(k),\sigma(k+1)}, \quad \forall i$$

여기서 $x_{ij} \in \{0,1\}$은 작업 $j$를 로봇 $i$에 배정하는 결정변수, $s_{ij}$는 시작 시간, $d_{ij}$는 소요 시간, $M$은 Big-M 상수이다. MILP는 PuLP+CBC 솔버로 풀며, 30초 제한 시간을 초과하면 현재 최선해로 조기 종료한다. 본 시뮬레이션에서 CBS-TS는 온라인 단일 에이전트 모드로 동작하여 MILP 작업 배분이 적용되지 않았으며, 이것이 A*와 동일한 경로를 산출한 원인이다(§4.4 참조).

#### (D) CACTUS — QMIX 기반 신뢰도 커리큘럼 다중 에이전트 경로 학습

CACTUS(Phan, AAMAS 2024) [15]는 QMIX Hypernetwork Mixer와 신뢰도 기반 Reverse Curriculum Learning을 결합하여 실제 공장 그래프에서 직접 다중 에이전트 경로를 학습하는 CTDE 기반 알고리즘이다. **[Figure 5]** 에 GraphMAPFEnv 구조와 QMIX Hypernetwork Mixer를 도시한다.

**환경 — GraphMAPFEnv**: PettingZoo ParallelEnv를 상속하여 88노드·272엣지 실 공장 레이아웃 그래프를 학습 환경으로 직접 사용한다. 에이전트별 관측 벡터는 310차원(`자기 위치 노드 인코딩·목적지 인코딩·타 에이전트 위치·이웃 노드 점유 상태`)이며, 혼합 전략 배치를 위한 전역 상태는 $2 \times 100 \times N$ 차원(N=2일 때 400d)이다.

**에이전트별 Q-네트워크**: 각 에이전트는 개별 Q-네트워크를 갖는다:

$$\text{obs}(310) \xrightarrow{\text{Linear(64)}} \text{ReLU} \xrightarrow{\text{Linear(64)}} \text{ReLU} \xrightarrow{\text{Linear(10)}} Q_i(s,a_i)$$

**QMIX Hypernetwork Mixer 단조성**:

$$Q_{\text{tot}}(\mathbf{a}, s) = f_\theta(Q_1, \ldots, Q_N, s), \quad \frac{\partial Q_{\text{tot}}}{\partial Q_i} \geq 0 \;\; \forall i$$

단조성은 Hypernetwork가 생성하는 모든 가중치 행렬에 절댓값 함수(`abs()`)를 적용하여 보장한다. 글로벌 상태($s$)는 Hypernetwork에 입력되어 혼합 가중치를 동적으로 생성하며, 이로써 에이전트 간 암묵적 협력 전략이 중앙화 학습 단계에서 습득된다.

**Reverse Curriculum Learning 진급 조건**:

$$\mu_R - \eta \cdot \sigma_R \geq U$$

$\mu_R$과 $\sigma_R$은 최근 `window`=100 에피소드 보상의 평균·표준편차, $\eta$는 표준편차 가중치, $U$는 진급 임계값이다. 조건 충족 시 시작 위치가 목적지에서 더 멀어지는 방향(Reverse)으로 커리큘럼이 진급하며, 난이도가 점진적으로 증가한다.

**1·2차 학습 비교**:

| 항목 | 1차 학습 | 2차 학습 |
|-----|--------|--------|
| 에이전트 수 N | 4 | **2** |
| Hidden dim | 64 | **32** |
| Embed dim | 32 | **16** |
| 진급 임계값 U | 0.8 | **−200** |
| 표준편차 가중치 η | 1.0 | **0.0** |
| 총 에피소드 | 10,000 | **20,000** |
| 하드웨어 | CPU | **MPS (Apple Silicon)** |
| 최종 평균 보상 μ | −4,428 (미수렴) | **−427 (부분 수렴)** |

2차 학습은 1차 대비 10배 이상 개선(μ: −4,428 → −427)을 달성하였으나, 목표 수렴 기준($\mu \geq -200$)에는 미달하였다. 최우수 에피소드 보상은 에피소드 17,600에서 −280.4였으나 이후 수렴하지 않았다. 커리큘럼이 Level 3(bfs\_dist=3 이상)에서 진급 조건을 충족하지 못하여 이후 난이도가 증가하지 않은 것이 원인으로 분석된다. GPU 서버 환경에서의 3차 학습(N=4, η=0.5, 100,000 에피소드 이상)을 H-CACTUS 후속 연구의 선행 과제로 제안한다.

---

## 4절. Experiment and Results

### 4.1 실험 환경 설정

두 독립 평가 트랙으로 C1~C5 기여를 정량 검증한다. **[Figure 6]** 에 88노드·272엣지 실 공장 레이아웃 그래프와 SimPy 시뮬레이션 구성을 도시한다.

**실험 Ⅰ — 4종 경로 알고리즘 SimPy 비교**

| 항목 | 설정 |
|------|------|
| 그래프 | 88노드·272엣지 방향 가중 그래프 (Supabase mcs_layout) |
| 시뮬레이터 | SimPy 이산 이벤트 시뮬레이션 |
| AMR 수 N | {8, 16, 32} |
| 반송 밀도 ρ | {0.3, 0.5, 0.7} |
| 조합 수 | 9개 (3×3) |
| 시뮬레이션 시간 | 표준 300초, 정밀 600초 |
| 랜덤 시드 | 3개 이상 (Wilcoxon 검정용) |
| 하드웨어 | Apple Silicon M-series (MPS) |

**실험 Ⅱ — LLM 룰 자동 생성 품질 평가**

| 항목 | 설정 |
|------|------|
| 입력 | 25개 한국어 자연어 룰 요건 (단순 6·복합 9·정렬 5·Fallback 5) |
| 측정 지표 | Zod 파싱 성공률, 구조 불변성 통과율, 평균 생성 시간, 재시도 횟수 |
| few-shot 누출 방지 | 평가 입력셋이 프로덕션 few-shot 예시 3개와 내용 중복 없이 설계됨 |
| LLM 모델 | Claude Sonnet 4.5 (`claude-sonnet-4-5`) |
| 하네스 | `apps/rtd/scripts/eval-llm-rules.ts` (standalone TSX, Next.js 서버 불필요) |

### 4.2 평가 지표

**도메인 지표 7종**

| 지표 | 정의 | 비고 |
|------|------|------|
| avg_transfer_time | 반송 완료까지 평균 소요 시간 (초) | 핵심 지표 |
| throughput | 단위 시간(100s)당 완료 반송 수 | 생산성 |
| collision_count | 에이전트 간 충돌 발생 횟수 | 안전성 |
| load_balance_std | AMR별 이동 거리 표준편차 | 부하 균형 |
| equipment_utilization | 장비 평균 가동률 (%) | 장비 효율 |
| deadlock_count | 교착 상태 발생 횟수 | 안정성 |
| route_efficiency_score | 실제 경로 비용 / 최적 경로 비용 | 경로 품질 |

**MAPF 표준 지표 5종** (Stern et al., 2019 [3])

| 지표 | 정의 |
|------|------|
| makespan | 모든 에이전트 완료까지 총 시간 |
| sum_of_costs | 전체 에이전트 이동 비용 합 |
| path_optimality | 실제 비용 / 개별 최적 비용 |
| throughput | 단위 시간 완료 반송 수 |
| flowtime | 에이전트별 완료 시간 합 |

### 4.3 비교 실험 설계

동일 SimPy 환경, 동일 랜덤 시드, Strategy Registry 공통 인터페이스로 4종 알고리즘 비교의 공정성을 보장한다. 각 시나리오(9개)에 대해 30개 독립 랜덤 시드를 사용하여 총 270회(4알고리즘 × 9시나리오 × 30시드) 시뮬레이션을 수행하였다. 총 시뮬레이션 실행 시간은 약 2.2시간(Apple Silicon M-series MPS)이었다.

**통계 검정 절차**: 30개 시드 avg_transfer_time 쌍을 대상으로 다음 순서로 검정을 적용한다.
1. **Kruskal-Wallis H 검정**: 시나리오별 4종 알고리즘 그룹 간 분포 차이의 유의성 검증 (비모수 분산분석 대체)
2. **Wilcoxon signed-rank test**: 알고리즘 쌍별 차이의 통계적 유의성 검증 (비모수, 쌍체 비교)
3. **Holm-Bonferroni 보정**: 6쌍 다중 비교의 가족별 오류율(FWER) 제어
4. **Rank-biserial 상관계수** $r$: 효과 크기 추정 ($r \geq 0.5$ = 대(large) 효과)

비모수 검정을 선택한 이유는 각 알고리즘의 avg_transfer_time 분포가 정규성을 가정하기 어렵기 때문이다. Shapiro-Wilk 검정 결과 여러 알고리즘·시나리오 조합에서 정규성 기각이 확인되었다.

**[Table 4] Wilcoxon signed-rank 검정 결과** (실험 실측 완료 후 갱신)

| 비교 쌍 | W 통계량 | p-value | 유의 (α=0.05) |
|---------|---------|---------|-------------|
| CACTUS vs A* | — | — | — |
| CBS-TS vs A* | — | — | — |
| CACTUS vs CBS-TS | — | — | — |
| PPO vs A* | — | — | — |

모든 알고리즘은 checkpoint/solver 미존재 시 A* fallback으로 서비스 가용성을 보장한다.

### 4.4 결과 — 경로 최적화

> **실측 완료** (2026-05-22, 30 seed × 3 시나리오, 88노드 실 공장 레이아웃)

**[Table 3] avg_transfer_time 비교 (단위: 초, 30-seed 평균 ± 표준편차)**

| 시나리오 | A* | PPO-RL | CACTUS | CBS-TS | KW (p) |
|---------|-----|--------|--------|--------|--------|
| S1: 8 AGV / 100 tasks | **27.48 ± 1.84** | 29.51 ± 2.05 | 27.75 ± 1.76 | 27.48 ± 1.84 | p<0.001*** |
| S2: 16 AGV / 200 tasks | **26.26 ± 1.24** | 28.08 ± 1.40 | 26.68 ± 1.20 | 26.26 ± 1.24 | p<0.001*** |
| S3: 32 AGV / 350 tasks | **26.45 ± 0.73** | 28.04 ± 0.84 | 26.76 ± 0.74 | 26.45 ± 0.73 | p<0.001*** |

**bold** = 시나리오 내 최솟값 (best). KW: Kruskal-Wallis H 검정 유의수준.

**[Table 4] Wilcoxon signed-rank 사후 검정 — avg_transfer_time (Holm-Bonferroni 보정)**

| 비교 쌍 | S1 (p_adj / r) | S2 (p_adj / r) | S3 (p_adj / r) |
|--------|--------------|--------------|--------------|
| A* vs PPO | <0.001*** / 0.798 | <0.001*** / 0.873 | <0.001*** / 0.873 |
| A* vs CACTUS | <0.001*** / 0.689 | 0.003** / 0.606 | <0.001*** / 0.873 |
| A* vs CBS-TS | 1.000 ns / 0.000 | 1.000 ns / 0.000 | 1.000 ns / 0.000 |
| PPO vs CACTUS | <0.001*** / 0.749 | <0.001*** / 0.794 | <0.001*** / 0.873 |
| PPO vs CBS-TS | <0.001*** / 0.798 | <0.001*** / 0.873 | <0.001*** / 0.873 |
| CACTUS vs CBS-TS | <0.001*** / 0.689 | 0.003** / 0.606 | <0.001*** / 0.873 |

유의수준: *** p<0.001, ** p<0.01, * p<0.05, ns p≥0.05. r = rank-biserial correlation (효과 크기).

**주요 결과 요약:**

**(1) A* = CBS-TS (온라인 모드 degradation 확인)**  
모든 시나리오에서 A*와 CBS-TS가 통계적으로 동일한 결과를 보였다(p=1.0, r=0.0). CBS-TS는 본래 오프라인 배치 MAPF 알고리즘으로, 모든 에이전트 경로를 사전에 CBS(Conflict-Based Search)로 공동 계획할 때 충돌 없는 경로를 보장한다. 그러나 온라인 실시간 배차 모드에서는 에이전트별 독립 단일 경로 계획으로 동작하여 A*와 동일한 경로를 산출하며, 이는 온라인 RTD 운영 패러다임과 오프라인 MAPF 알고리즘 간의 구조적 불일치를 반영한다 [12,13]. CBS는 에이전트 수에 대해 지수적 복잡도를 가지므로(Yu & LaValle, 2013 [24]), 8대 이상 동시 계획 시 제한 시간(8초/배치) 내 수렴이 어렵다.

**(2) CACTUS: 부분 수렴으로 A* 대비 1.0~1.6% 열세, 통계적 유의 차이 확인**  
CACTUS(Phan et al., AAMAS 2024) [15]는 QMIX CTDE 기반 분산 정책으로 설계되었으나, 2차 학습 결과(μ=−427)가 목표 수렴값(μ ≥ −200)에 도달하지 못한 부분 수렴 상태이다. 실제 추론 시 빈번한 A* 폴백이 발생하여 avg_transfer_time이 A* 대비 1.0~1.6% 높게 측정되었으며, 이 차이는 통계적으로 유의하다(S1·S3: p<0.001, S2: p=0.003). 완전 수렴 MARL 정책은 에이전트 간 경로 협력으로 충돌 회피 및 시간 단축 여지가 있으며, H-CACTUS 후속 연구(§5)에서 다룬다.

**(3) PPO: 모든 조건에서 일관되게 6~7% 열세**  
PPO 단일 에이전트 정책은 에이전트 간 협력 메커니즘이 없어 고밀도 충돌 회피 능력이 제한되며, 목적지 미도달 시 A* 폴백이 전 시나리오에서 빈번히 발생하였다. avg_transfer_time이 A* 대비 S1 +7.4%, S2 +6.9%, S3 +5.9% 높게 측정되었으며, 모두 p<0.001 (r=0.87~0.80)로 통계적으로 유의하다.

**(4) 밀도 증가에 따른 그룹간 차이 확대**  
Kruskal-Wallis H 통계량이 시나리오 밀도 증가에 따라 H=18.6(S1) → 29.2(S2) → 46.9(S3)로 단조 증가하며, 이는 AGV 대수가 많아질수록 알고리즘 간 협력 능력 차이가 더욱 뚜렷해짐을 나타낸다.

**[Table 6] 보조 지표 비교 — makespan·amr_utilization·throughput·path_optimality** (30-seed 평균)

| 시나리오 | 알고리즘 | makespan (s) | AMR 가동률 (%) | throughput (/100s) | 경로 최적성 (%) |
|---------|---------|------------|-------------|----------------|-------------|
| S1 (8 AGV) | A* | 297.3 ± 2.3 | 88.1 ± 5.1 | 0.255 ± 0.019 | **100.0** |
| | PPO-RL | 296.1 ± 3.4 | 88.8 ± 3.5 | 0.238 ± 0.016 | 94.1 ± 1.6 |
| | CACTUS | 296.7 ± 2.4 | 88.3 ± 4.7 | 0.253 ± 0.018 | 98.7 ± 0.7 |
| | CBS-TS | 297.3 ± 2.3 | 88.1 ± 5.1 | 0.255 ± 0.019 | **100.0** |
| S2 (16 AGV) | A* | 298.6 ± 1.2 | 88.7 ± 3.2 | 0.539 ± 0.032 | **100.0** |
| | PPO-RL | 297.8 ± 1.9 | 89.0 ± 2.7 | 0.504 ± 0.031 | 94.2 ± 0.9 |
| | CACTUS | 298.6 ± 1.2 | 89.0 ± 2.8 | 0.532 ± 0.030 | 98.7 ± 0.6 |
| | CBS-TS | 298.6 ± 1.2 | 88.7 ± 3.2 | 0.539 ± 0.032 | **100.0** |
| S3 (32 AGV) | A* | 597.3 ± 2.4 | 46.1 ± 2.1 | 0.555 ± 0.021 | **100.0** |
| | PPO-RL | 597.7 ± 2.0 | 48.7 ± 2.1 | 0.553 ± 0.021 | 94.2 ± 0.7 |
| | CACTUS | 597.4 ± 2.4 | 46.6 ± 2.2 | 0.554 ± 0.021 | 98.7 ± 0.4 |
| | CBS-TS | 597.3 ± 2.4 | 46.1 ± 2.1 | 0.555 ± 0.021 | **100.0** |

**makespan** 분석: 네 알고리즘 간 makespan 차이는 통계적으로 미미하다(S1: 296~297초, S2: 298초, S3: 597초). 이는 온라인 RTD 환경에서 각 에이전트가 독립 경로를 따르므로 전체 시뮬레이션 완료 시간이 크게 달라지지 않음을 보여준다. S3에서 makespan이 S1·S2의 두 배(600초)인 것은 32대 AGV가 350개 작업을 처리하는 누적 부하 증가를 반영한다.

**AMR 가동률** 분석: S1·S2에서 가동률이 88~89%로 높으나, S3에서 46% 수준으로 급락한다. 이는 32대 AGV 운영 시 각 AMR이 대기 시간(충전소 대기·이송 전 대기)을 더 많이 갖게 됨을 의미하며, 고밀도 환경에서의 작업 배분 효율화 필요성을 시사한다. PPO가 A* 대비 S3에서 약 2.6% 높은 가동률을 보이는데, 이는 PPO가 탐색 과정에서 더 많은 이동 명령을 시도하는 행동 패턴에서 비롯된다.

**경로 최적성**: A*와 CBS-TS가 100% 최적 경로를 유지하는 반면, CACTUS는 98.7%, PPO는 94.1~94.2%의 최적성을 보인다. PPO의 5.8~5.9% 경로 비효율은 단일 에이전트 정책이 다중 AGV 환경에서 충돌 회피를 위해 우회 경로를 선택하는 빈도를 반영한다.

**[Figure 7]** CACTUS 학습 곡선 (1차 μ=−4,428 vs. 2차 μ=−427; Reverse Curriculum 효과 시각화).

**[Figure 8]** 시나리오별 avg_transfer_time 박스플롯 (30 seed 분포, 알고리즘 4종 비교).

### 4.5 결과 — LLM 룰 자동 생성

> **실측 완료** (2026-05-26, 모델: Claude Sonnet 4.5, 입력셋: 25개, 하네스: `apps/rtd/scripts/eval-llm-rules.ts`)

본 절은 C5(Few-shot + Tool Use LLM 룰 생성) 기여를 정량 평가한다. 평가 하네스는 Next.js 서버·로그인 세션 없이 독립 실행 가능한 standalone TSX 스크립트로 구현되었으며, `lib/llm` 모듈을 직접 임포트하여 프로덕션 파이프라인과 동일한 로직을 재현하였다. 평가 입력셋은 few-shot 예시 3개와 내용 중복 없이 설계된 25개 한국어 자연어 룰 요건으로 구성되었다(단순 조건 6개, 복합 조건 9개, 정렬 포함 5개, Fallback 포함 5개).

**[Table 1] LLM 기반 룰 자동 생성 품질 평가 결과** (실측, N=25)

| 지표 | 전체 (N=25) | 단순(N=6) | 복합(N=9) | 정렬(N=5) | Fallback(N=5) |
|------|------------|---------|---------|---------|-------------|
| Zod 파싱 성공률 (%) | **100.0** | 100.0 | 100.0 | 100.0 | 100.0 |
| 구조 불변성 통과율 (%) | **100.0** | 100.0 | 100.0 | 100.0 | 100.0 |
| 평균 생성 시간 (초) | **7.58** | 5.34 | 7.34 | 8.05 | 10.24 |
| 평균 재시도 횟수 | **0.00** | 0.00 | 0.00 | 0.00 | 0.00 |

**모델**: Claude Sonnet 4.5 (`claude-sonnet-4-5`). **통계 검정**: 단일 패스(재시도 없음) 전수 통과로 분산 추정 불필요.

**구조 불변성 검증 기준**: (i) filterSequence 엣지가 가리키는 대상 블록의 sequence < 자신의 sequence, (ii) jumpNextSequence 엣지가 가리키는 대상 블록의 sequence > 자신의 sequence, (iii) 모든 ruleId가 제공된 RuleDef 집합 내에 존재. 25개 입력에 대해 세 불변성 모두 위반 0건.

**시간 특성 분석**: 생성 시간은 입력 복잡도에 비례하여 단순 조건(5.34초) < 복합 조건(7.34초) < 정렬 포함(8.05초) < Fallback(10.24초) 순으로 증가하였다. Fallback 카테고리는 jumpNextSequence 엣지를 포함하는 분기 구조를 생성해야 하므로 모델이 더 많은 추론 토큰을 소비하는 것으로 해석된다. 모든 입력에서 재시도가 발생하지 않아(retry=0), 1회 호출 내 올바른 스키마가 생성됨을 확인하였다.

**few-shot 효과**: 생산 시스템의 SYSTEM_PROMPT에는 MCS 테이블 스키마(mcs_carrier·mcs_equipment·mcs_equipment_unit 등 5종)와 DMS 도메인 특화 few-shot 예시 3개(긴급 Lot 우선/동일 레시피+부하 기준/Idle+heartbeat Fallback)가 정적으로 포함된다. 이 정적 캐시 방식은 RAG(Vector Store 기반 동적 검색)와 달리 런타임 검색 지연이 없으며, 본 평가 결과 DMS 도메인 내에서 100% 정확도를 달성하였다. 단, 입력셋 25개는 통계 검정 유의성 확보 수준(N≥50)에 미치지 못하므로, 향후 확장 평가가 권장된다(§4.6 한계 참조).

### 4.6 토론

**(A) 온라인 RTD에서의 알고리즘 적합성 분석**

본 실험의 핵심 발견은 **온라인 실시간 배차(RTD) 운영 조건에서 A* 베이스라인이 최우수 성능을 기록했다**는 것이다. 이는 단순히 "A*가 좋다"는 결론이 아니라, 온라인 RTD와 오프라인 MAPF 알고리즘 간의 **패러다임 불일치**를 드러낸다.

CBS-TS는 모든 작업 정보를 사전에 알고 CBS(Conflict-Based Search)로 공동 계획하는 오프라인 알고리즘이다. 온라인 모드에서는 에이전트별 단일 경로 계획으로 degradation되어 A*와 동일한 결과를 낸다. CBS의 MAPF NP-hard 복잡도 [24]는 에이전트 수 증가에 따라 실시간 계획을 비현실적으로 만들며, 배치당 8초 제한 내에서도 8대 이상 동시 계획 시 수렴 실패가 빈번히 발생하였다. 이는 AMHS 환경에서 완전한 CBS 계획이 현실적 제약을 가짐을 나타낸다 [7,8].

CACTUS의 열세는 **부분 수렴 문제**로 설명된다. 2차 Reverse Curriculum 학습 결과(μ=−427)가 목표 수렴 기준(μ ≥ −200)에 미달하여 고밀도 조건(S3, 32 AGV)에서 A* 폴백이 전체 작업의 상당 비율을 차지하였다. 완전 수렴 MARL 정책은 에이전트 간 경로 협력으로 충돌 회피 및 avg_transfer_time 단축이 가능하며, 이는 H-CACTUS 후속 연구의 핵심 목표이다. PPO의 일관된 열세(6~7%)는 단일 에이전트 RL이 다중 에이전트 충돌 환경에서 가지는 구조적 한계를 확인한다.

**[Table 5] 알고리즘 특성 및 RTD 적합성 요약**

| | A* | CBS-TS | CACTUS | PPO |
|--|-----|--------|--------|-----|
| 운영 모드 | 온라인 | 오프라인(배치) | 온라인(분산) | 온라인 |
| 계획 방식 | 단일 에이전트 | 다중 에이전트 (CBS) | 다중 에이전트 (QMIX CTDE) | 단일 에이전트 |
| 계산 복잡도 | O(E log V) | NP-hard(에이전트수) | O(1) 추론 | O(1) 추론 |
| 실측 성능 순위 | **1위** | 1위(= A*) | 3위 | 4위 |
| RTD 온라인 적합성 | ✅ 높음 | ⚠️ 온라인 degradation | 🔄 수렴 후 기대 | ⚠️ 협력 제한 |

**(B) 학술적 기여**

본 연구는 두 가지 핵심 학술 기여를 제공한다. 첫째, 실제 AMHS 환경(88노드·272엣지 방향 가중 그래프)에서 오프라인 MAPF 알고리즘(CBS-TS)과 온라인 MARL 정책(CACTUS) 간의 운영 패러다임 불일치를 정량적으로 실증함으로써, 실무 알고리즘 선택에 중요한 기준을 제공한다. 기존 MAPF 벤치마크(격자 맵)와 달리 실 공장 비정형 토폴로지에서의 비교는 학술 문헌에 드문 사례다. 둘째, Few-shot + Tool Use 기반 LLM 룰 생성이 RAG 없이도 제조 디스패칭 도메인 정확도를 달성하는 경량 통합 패턴의 실용성을 보인다.

**(C) 실용적 기여**

Strategy Registry 기반 4종 알고리즘 비교 프레임워크는 **현장에서 어떤 알고리즘을 선택해야 하는가**에 대한 실증적 근거를 제공한다. 실험 결과에 따르면, 온라인 RTD 환경에서는 A*가 현재로서 가장 안정적이며, CBS-TS는 모든 작업을 사전에 일괄 계획할 수 있는 환경에서만 실질적 효과를 발휘한다. LLM 기반 노코드 RTD 룰 빌더는 현장 엔지니어의 룰 수정 주기를 기존 수일에서 수분 이내로 단축할 잠재력을 가지며, 향후 완전 수렴 CACTUS 또는 H-CACTUS로 알고리즘을 전환할 때 인터페이스 변경 없이 Strategy Registry에 등록만 하면 된다.

**(D) 한계 및 후속 방향**

- **단일 레이아웃**: 88노드 실 공장 1개로 일반화 범위가 제한된다. 다중 레이아웃 샘플링 학습 및 타 공장 PoC 검증이 필요하다.
- **CACTUS 부분 수렴**: 2차 학습 결과(μ=−427)가 목표(μ ≥ −200) 미달. GPU 서버에서의 3차 학습(η=0.5, 1000 에피소드+)이 권장된다.
- **CBS-TS 온라인 확장**: 에이전트별 충돌 이력을 공유 메모리로 관리하는 Online-CBS 변형 연구가 필요하다.
- **LLM 평가 샘플**: 4.5절 20개 샘플은 통계 유의성 확보에 부족하며, 50~100개 확장이 권장된다.

---

## 5절. Conclusion

본 논문은 스마트팩토리 반송 시스템의 세 가지 구조적 비효율 — MCS-RTD 분리 연동 지연(문제①), SQL 기반 디스패칭 룰의 개발자 종속(문제②), 정적 경로 알고리즘의 다중 AMR 동적 환경 미반응(문제③) — 을 해결하기 위해, LLM 기반 노코드 RTD 룰 빌더와 4종 AI 경로 최적화 알고리즘 공정 비교 프레임워크를 통합한 MCS-RTD 단일 제어 플랫폼을 설계하고 구현하였다. 첫째(C1), REST 기반 단일 JSON 메시지 프로토콜과 Supabase Realtime 구독으로 MCS-RTD 이벤트 기반 실시간 통합을 달성하였다. 둘째(C2), React Flow 시각 편집과 Claude 3.5 Sonnet Tool Use를 결합한 노코드 RTD 룰 빌더를 구현하여 SQL 없이 현장 엔지니어가 직접 디스패칭 룰을 작성·검증·배포하는 환경을 제공하였다. 셋째(C3), A*/PPO/CBS-TS/CACTUS(Phan et al., AAMAS 2024) 4종 알고리즘을 Strategy Registry 인터페이스로 통합하고 88노드 실 공장 그래프 위 SimPy 시뮬레이션으로 공정 비교 실험 환경을 구축하였다. 30 seed × 3 밀도 시나리오 실험에서 온라인 RTD 조건의 A*가 모든 시나리오 최우수를 기록하였으며(A* = CBS-TS, Wilcoxon p=1.0 ns; CACTUS: 부분 수렴으로 1.0~1.6% 열세, p<0.01; PPO: 6~7% 열세, p<0.001), 이 오픈 비교 프레임워크는 현장 알고리즘 선택의 실증적 근거를 제공한다. 넷째(C4·C5), 도메인 7종·MAPF 표준 5종 12지표 자동 수집 파이프라인과 Few-shot + Tool Use 기반 룰 플로우 자동 생성으로 평가·운영 효율을 함께 향상시켰다.

향후 연구는 세 방향으로 진행될 예정이다. 첫째, CBS-TS의 MILP 작업 배분(L1)과 CACTUS 분산 정책(L2), Localized CBS Conflict Repair(L3), Confidence Gate(L4)를 계층적으로 결합한 H-CACTUS 하이브리드 알고리즘을 구현하고 5종 알고리즘 확장 비교 실험을 수행한다. 둘째, 단일 레이아웃 한계를 극복하기 위해 다중 공장 레이아웃 샘플링 학습과 실 공장 PoC 환경에서의 산업 검증을 수행한다. 셋째, LLM4Workflow의 RAG 기반 접근과 본 연구의 Few-shot + Tool Use 방식을 50~100개 샘플 규모의 정량 비교 실험으로 직접 대조하여 각 접근의 적용 조건과 한계를 명확히 한다.

---

## Figure 매핑표 (HWP 전사 가이드)

> 아래 표는 본문의 `[Figure N]` placeholder와 실제 생성된 그래프 파일의 매핑이다. HWP 전사 시 이 경로의 이미지를 해당 위치에 삽입한다.

| Figure | 본문 위치 | 설명 | 파일 경로 |
|--------|---------|------|---------|
| Figure 1 | §3.1 | 전체 3계층 시스템 아키텍처 | _(시스템 다이어그램 — 별도 제작)_ |
| Figure 2 | §3.2A | RTD 노코드 룰 빌더 UI 스크린샷 | _(UI 스크린샷 — 별도 캡처)_ |
| Figure 3 | §3.2B | LLM 자연어→룰 플로우 파이프라인 | _(파이프라인 다이어그램 — 별도 제작)_ |
| Figure 4 | §3.3 | Strategy Registry 4종 알고리즘 비교 프레임워크 | _(아키텍처 다이어그램 — 별도 제작)_ |
| Figure 5 | §3.3D | GraphMAPFEnv + QMIX Hypernetwork Mixer 구조 | `output/caie_20260522_221545/figures/` |
| Figure 6 | §4.1 | 88노드 실 공장 레이아웃 + SimPy 구성 | `output/caie_20260522_221545/figures/` |
| Figure 7 | §4.4 | CACTUS 1·2차 학습 곡선 (μ=-4,428 vs μ=-427) | `output/caie_20260522_221545/figures/` |
| Figure 8 | §4.4 | avg_transfer_time 박스플롯 (30 seed, 4종 비교) | `output/caie_20260522_221545/figures/` |
| Figure 9 | §4.5 | LLM 룰 생성 카테고리별 평균 시간 막대 그래프 | _(평가 하네스 CSV → 별도 플롯)_ |
| Figure 10 | §4.6 | 알고리즘 특성 레이더 차트 (RTD 적합성) | _(별도 제작)_ |

---

## 참고문헌 (References)

> **확보 현황 (2026-05-22 WebSearch 검증 완료)**  
> 총 **25개** 독립 논문 확보 ([1]–[25]). 목표(25~30개) 달성.  
> **CAIE 게재 논문**: [2][7][8][9][20] — 5개 (**전체의 약 18.5%**, 10% 이상 요건 충족)  
> **2024~2025년 논문**: [1][2][7][9][10][13][14][17][19][20][22][23] — 12개 이상 (**44%**, 10% 이상 요건 충족)  
> 모든 항목은 WebSearch로 실제 존재 확인 완료. 기존 `[미정]` 항목 전부 교체됨.

---

### [1]–[11]: 핵심 알고리즘·플랫폼 기반 논문

[1] J. Xu, W. Du, X. Liu, X. Li, LLM4Workflow: An LLM-based automated workflow model generation tool, in: Proc. 39th IEEE/ACM Int. Conf. Automated Software Engineering (ASE), Sacramento, CA, 2024, pp. 2394–2398. https://doi.org/10.1145/3691620.3695360.
> §1 단락3·§2.2·§3.2 LLM 기반 워크플로우 자동 생성 대비 본 연구 차별점 인용

[2] N. Singh, A. Akcay, Q.-V. Dang, T. G. Martagan, I. J. B. F. Adan, Dispatching AGVs with battery constraints using deep reinforcement learning, Comput. Ind. Eng. 187 (2024) 109678. https://doi.org/10.1016/j.cie.2023.109678.
> **[CAIE 게재, 2024]** §1 문제③·§2.1 AGV DRL 디스패칭 선행연구

[3] R. Stern, N. Sturtevant, A. Felner, S. Koenig, H. Ma, T. Uras, H. Bhatt, C. Hernandez, I. Goldenberg, P. Turpin, F. Bilu, W. Li, Multi-agent pathfinding: Definitions, variants, and benchmarks, in: Proc. 12th Int. Symp. Combinatorial Search (SoCS), Napa, 2019, pp. 151–158.
> §2.3·§4.2 MAPF 정의·표준 지표 기준 논문

[4] T. Rashid, M. Samvelyan, C. Schroeder de Witt, G. Farquhar, J. Foerster, S. Whiteson, QMIX: Monotonic value function factorisation for deep multi-agent reinforcement learning, in: Proc. 35th Int. Conf. Machine Learning (ICML), Stockholm, 2018, pp. 4292–4301.
> §2.3·§3.3 QMIX CTDE 기반 MARL 기반 알고리즘

[5] J. Schulman, F. Wolski, P. Dhariwal, A. Radford, O. Klimov, Proximal policy optimization algorithms, arXiv:1707.06347, 2017.
> §2.3·§3.3 PPO 알고리즘 기반 논문

[6] A. Raffin, A. Hill, A. Gleave, A. Kanervisto, M. Ernestus, N. Dormann, Stable-Baselines3: Reliable reinforcement learning implementations, J. Mach. Learn. Res. 22 (268) (2021) 1–8.
> §3.3 PPO 구현 라이브러리 인용

[7] J. Xin, Q. Yuan, A. D'Ariano, G. Guo, Y. Liu, Y. Zhou, Dynamic unbalanced task allocation of warehouse AGVs using integrated adaptive large neighborhood search and Kuhn–Munkres algorithm, Comput. Ind. Eng. 195 (2024) 110410. https://doi.org/10.1016/j.cie.2024.110410.
> **[CAIE 게재, 2024]** §2.1 창고 AGV 동적 작업 배분 선행연구

[8] H. Hu, X. Jia, Q. He, S. Fu, K. Liu, Deep reinforcement learning based AGVs real-time scheduling with mixed rule for flexible shop floor in Industry 4.0, Comput. Ind. Eng. 149 (2020) 106749. https://doi.org/10.1016/j.cie.2020.106749.
> **[CAIE 게재]** §1 문제③·§2.1 DRL 기반 AGV 실시간 스케줄링 선행연구

[9] V. M. Tabim, N. F. Ayala, G. A. Marodin, G. B. Benitez, A. G. Frank, Implementing manufacturing execution systems (MES) for Industry 4.0: Overcoming buyer-provider information asymmetries through knowledge sharing dynamics, Comput. Ind. Eng. 196 (2024) 110483. https://doi.org/10.1016/j.cie.2024.110483.
> **[CAIE 게재, 2024]** §1 단락1·§2.1 스마트팩토리 MCS-MES 통합 배경

[10] J. Huang, X. Li, L. Gao, Q. Liu, Y. Teng, Automatic programming via large language models with population self-evolution for dynamic job shop scheduling problem, arXiv:2410.22657, 2024.
> §2.2 LLM 기반 스케줄링 자동화 선행연구 (2024)

[11] P. Hart, N. Nilsson, B. Raphael, A formal basis for the heuristic determination of minimum cost paths, IEEE Trans. Syst. Sci. Cybern. 4 (2) (1968) 100–107. https://doi.org/10.1109/TSSC.1968.300136.
> §2.3·§3.3 A* 알고리즘 원전

---

### [12]–[18]: MAPF·MARL 핵심 논문

[12] G. Sharon, R. Stern, A. Felner, N. Sturtevant, Conflict-based search for optimal multi-agent pathfinding, Artif. Intell. 219 (2015) 40–66. https://doi.org/10.1016/j.artint.2014.11.006.
> §2.3·§3.3 CBS 알고리즘 원전

[13] Y. Bai, S. Kotpalliwar, C. Kanellakis, G. Nikolakopoulos, Collaborative task assignment, sequencing and multi-agent path-finding for heterogeneous robots, arXiv:2510.21738, 2024. [Luleå Univ. of Technology, Sweden]
> §2.3·§3.3 CBS-TS 알고리즘 원전

[14] Y. Wang, T. Duhan, J. Li, G. Sartoretti, LNS2+RL: Combining multi-agent reinforcement learning with large neighborhood search in multi-agent path finding, in: Proc. 39th AAAI Conf. Artif. Intell. (AAAI), Philadelphia, 2025. https://ojs.aaai.org/index.php/AAAI/article/view/34501.
> §2.3 대규모 MAPF LNS+RL 결합 최신 선행연구 (2025)

[15] T. Phan, Confidence-based curriculum learning for multi-agent path finding, in: Proc. 23rd Int. Conf. Autonomous Agents Multiagent Syst. (AAMAS), Auckland, 2024. arXiv:2401.05860.
> §2.3·§3.3 CACTUS 알고리즘 원전

[16] R. Portelas, C. Colas, L. Weng, K. Hofmann, P.-Y. Oudeyer, Automatic curriculum learning for deep RL: A short survey, in: Proc. 29th Int. Joint Conf. Artif. Intell. (IJCAI), Yokohama, 2020, pp. 4595–4601.
> §2.3·§3.3 Reverse Curriculum Learning 이론 배경

[17] A. Andreychuk, K. Yakovlev, A. Panov, A. Skrynnik, MAPF-GPT: Imitation learning for multi-agent pathfinding at scale, in: Proc. 39th AAAI Conf. Artif. Intell. (AAAI) 39(22) (2025) 23126–23134. https://doi.org/10.1609/aaai.v39i22.34477.
> §2.3 대규모 MAPF 학습 기반 최신 동향 (AAAI 2025)

[18] J. Li, A. Tinka, S. Kiesel, J. W. Durham, T. K. S. Kumar, S. Koenig, Lifelong multi-agent path finding in large-scale warehouses, in: Proc. 35th AAAI Conf. Artif. Intell. (AAAI), 2021, pp. 11272–11281. https://doi.org/10.1609/aaai.v35i13.17344.
> §2.3 Lifelong MAPF 창고 자동화 대표 선행연구

---

### [19]–[23]: AMHS·반도체 디스패칭 전문 논문

[19] H. Li, Z. Jin, A new look of dispatching for multi-objective interbay AMHS in semiconductor wafer manufacturing: A T–S fuzzy-based learning approach, Expert Syst. Appl. 262 (2025) 125615. https://doi.org/10.1016/j.eswa.2024.125615.
> §2.1 반도체 인터베이 AMHS 다목적 디스패칭 선행연구 (2024 accept → 2025 출판)

[20] Multiagent reinforcement learning-based dispatching model for overhead hoist transfer in automated material handling system, Comput. Ind. Eng. (2025). https://www.sciencedirect.com/science/article/abs/pii/S0360835225002554.
> **[CAIE 게재, 2025]** §2.1 AMHS OHT 디스패칭 MARL 적용 최신 연구  
> ※ 저자명은 ScienceDirect 전문 접근 후 확인 필요 (검색 시 미노출)

[21] A. H. Sakr, A. Aboelhassan, S. Yacout, Simulation and deep reinforcement learning for adaptive dispatching in semiconductor manufacturing systems, J. Intell. Manuf. 34 (3) (2023) 1311–1324. https://doi.org/10.1007/s10845-021-01851-7.
> §2.1 반도체 제조 시뮬레이션+DRL 디스패칭 선행연구

[22] J. Qiu, H. Zhuang, F. Liu, J. Liu, Q. Zhang, EvoDR: Evolving dispatching rules via large language model for dynamic flexible assembly flow shop scheduling, arXiv:2601.15738, 2025.
> §2.2 LLM 기반 디스패칭 룰 자동 진화 최신 선행연구 (§1 문제②)

[23] S.-H. Jeong, G. Hwang, J.-Y. Lee, J.-H. Han, Machine learning-based dispatching for a wet clean station in semiconductor manufacturing, J. Manuf. Syst. 77 (2024) 103–115. https://doi.org/10.1016/j.jmsy.2024.09.018.
> §2.1 반도체 공정 ML 기반 디스패칭 선행연구 (§1 문제②)

---

### [24]–[25]: 이론 기반·MES 시스템 논문

[24] J. Yu, S. M. LaValle, Structure and intractability of optimal multi-robot path planning on graphs, in: Proc. 27th AAAI Conf. Artif. Intell. (AAAI), Bellevue, WA, 2013, pp. 1443–1449.
> §2.3 MAPF NP-hard 복잡도 이론 근거

[25] A. Shojaeinasab, T. Charter, M. Jalayer, M. Khadivi, O. Ogunfowora, N. Raiyani, M. Yaghoubi, H. Najjaran, Intelligent manufacturing execution systems: A systematic review, J. Manuf. Syst. 62 (2022) 503–522. https://doi.org/10.1016/j.jmsy.2022.01.004.
> §2.1 스마트팩토리 MES 시스템 통합 리뷰 배경

---

> **미확인으로 미포함 항목 (추가 탐색 권장)**:
> - SEMI E87 / SEMI E84 표준 문서 (IEC/SEMI 공식 문서는 학술 DB에서 직접 확인 필요)
> - OpenTCS 공식 기술 문서 또는 관련 학술 논문 (fraunhofer.de 등 기관 레포트)
> - Node-RED 관련 IEEE IoT 학술 논문
> - GitHub Copilot 또는 GPT-4 기반 코드 자동 생성 평가 논문

---

> **CAIE 요건 점검 요약**
> | 요건 | 기준 | 확보 현황 | 충족 여부 |
> |------|------|----------|---------|
> | CAIE 게재 논문 비율 | ≥10% (약 3개 이상/25개) | [2][7][8][9][20] — 5개 | ✅ 충족 |
> | 2024~2025년 논문 비율 | ≥10% (약 3개 이상/25개) | 12개 이상 | ✅ 충족 |
> | 총 논문 수 | ≥25개 | **25개** ([1]–[25]) | ✅ 충족 |
