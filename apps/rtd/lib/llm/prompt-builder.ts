import { MCS_TABLES, MES_EVENT_PARAMS } from '@/lib/rule-engine/mcs-schema-catalog';
import { FEW_SHOT_EXAMPLES, formatFewShotForPrompt } from './few-shot-examples';
import type { RuleDef } from '@workspace/types/rtd';

/** 정적 시스템 프롬프트 (Anthropic 캐시 활용을 위해 고정) */
export const SYSTEM_PROMPT = `당신은 반도체 공정 스마트팩토리의 RTD(Real-Time Dispatching) 룰 설계 전문가입니다.

## 역할
현장 엔지니어의 자연어 디스패칭 조건을 체계적인 룰 시퀀스 배열로 변환합니다.
generate_rule_relations 도구만 사용하여 결과를 반환하세요.

## RTD 시스템 개요
MES(제조 실행 시스템)가 이벤트를 발행하면 RTD가 룰 시퀀스를 순서대로 실행하여
어떤 Lot을 어떤 설비로 반송할지 결정합니다.

MES 이벤트 파라미터 (쿼리에서 바인딩 가능):
${MES_EVENT_PARAMS.map((p) => `  ${p}`).join('\n')}

## 사용 가능한 MCS 테이블
${Object.entries(MCS_TABLES)
  .map(([table, cols]) => `- **${table}**: ${cols.slice(0, 6).join(', ')} 등`)
  .join('\n')}

## 룰 타입 정의
- **Data**: 기준 테이블에서 초기 후보 목록 조회 (filterSequence=null)
- **SubData**: 보조 데이터 조회 (다른 시퀀스에 JOIN용)
- **Filter**: 이전 시퀀스 결과를 조건으로 좁힘 (filterSequence 필수)
- **Join**: 두 시퀀스 결과를 조인
- **Groupby**: 결과를 그룹핑
- **Sort**: 결과를 정렬 (최종 순위 결정)
- **Method**: 특수 선택 로직 (상위 N개, 랜덤 등)

## 시퀀스 설계 규칙
1. sequence는 1부터 시작하는 연속 정수
2. filterSequence는 반드시 자신보다 **작은** sequence 번호 (또는 null)
3. jumpNextSequence는 반드시 자신보다 **큰** sequence 번호 (또는 null)
4. **반드시** 제공된 [사용 가능한 룰] 목록의 ruleId만 사용 — 임의 생성 금지
5. 예시의 ruleId는 형식 설명용 자리표시자이며, 실제 출력에서는 제공된 목록에서 선택

## Few-shot 예시
${formatFewShotForPrompt(FEW_SHOT_EXAMPLES)}`;

interface RuleGroupContext {
  ruleGroupName: string;
  ruleGroupType: string;
}

/** 런타임 사용자 메시지 조립 (RuleDef 목록과 사용자 입력 포함) */
export function buildUserMessage(
  userPrompt: string,
  ruleDefs: RuleDef[],
  groupContext: RuleGroupContext
): string {
  const ruleList = ruleDefs
    .map((d) => `  - ruleId: "${d.ruleId}" | 이름: "${d.ruleName}" | 타입: ${d.ruleType}`)
    .join('\n');

  return `## 현재 룰 그룹 정보
- 그룹명: ${groupContext.ruleGroupName}
- 그룹 유형: ${groupContext.ruleGroupType}

## 사용 가능한 룰 (이 목록의 ruleId만 사용 가능)
${ruleList || '  (등록된 룰이 없습니다 — 먼저 룰 정의를 등록해주세요)'}

## 사용자 요청
${userPrompt}`;
}
