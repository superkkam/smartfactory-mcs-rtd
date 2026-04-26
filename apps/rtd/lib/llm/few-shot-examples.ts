/**
 * LLM 프롬프트용 Few-shot 예시.
 * ruleId는 형식 예시를 위한 자리표시자이며,
 * 실제 호출 시에는 주입된 RuleDef 목록에서만 선택됩니다.
 */

export interface FewShotExample {
  input: string;
  output: {
    sequences: Array<{
      sequence: number;
      ruleId: string;
      isMandatory: 'Y' | 'N' | 'O';
      filterSequence: number | null;
      jumpNextSequence: number | null;
      jumpNextSequenceCondition: string | null;
      reasoning: string;
    }>;
  };
}

export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    input: '긴급 Lot을 우선 디스패칭하고, 가용 가능한 설비만 후보로 포함하세요.',
    output: {
      sequences: [
        {
          sequence: 1,
          ruleId: '<DATA 타입 룰의 ruleId>',
          isMandatory: 'Y',
          filterSequence: null,
          jumpNextSequence: null,
          jumpNextSequenceCondition: null,
          reasoning: 'mcs_carrier 테이블에서 전체 Lot 목록을 기준 데이터로 조회합니다.',
        },
        {
          sequence: 2,
          ruleId: '<FILTER 타입 룰의 ruleId>',
          isMandatory: 'Y',
          filterSequence: 1,
          jumpNextSequence: null,
          jumpNextSequenceCondition: null,
          reasoning:
            '시퀀스 1의 결과에서 mcs_equipment.availability=true인 가용 설비만 필터합니다.',
        },
        {
          sequence: 3,
          ruleId: '<SORT 타입 룰의 ruleId>',
          isMandatory: 'N',
          filterSequence: 2,
          jumpNextSequence: null,
          jumpNextSequenceCondition: null,
          reasoning: 'priority 오름차순 정렬로 긴급(priority=1) Lot을 최상위에 배치합니다.',
        },
      ],
    },
  },
  {
    input:
      '요청 설비와 동일한 레시피를 처리할 수 있는 설비 중 현재 부하(current_load)가 가장 낮은 설비를 선택하세요.',
    output: {
      sequences: [
        {
          sequence: 1,
          ruleId: '<DATA 타입 룰의 ruleId>',
          isMandatory: 'Y',
          filterSequence: null,
          jumpNextSequence: null,
          jumpNextSequenceCondition: null,
          reasoning: 'mcs_equipment 전체 목록을 조회합니다.',
        },
        {
          sequence: 2,
          ruleId: '<FILTER 타입 룰의 ruleId>',
          isMandatory: 'Y',
          filterSequence: 1,
          jumpNextSequence: null,
          jumpNextSequenceCondition: null,
          reasoning:
            '시퀀스 1에서 recipe_type이 요청 설비(:equipmentId)와 동일한 항목만 필터합니다.',
        },
        {
          sequence: 3,
          ruleId: '<SORT 타입 룰의 ruleId>',
          isMandatory: 'N',
          filterSequence: 2,
          jumpNextSequence: null,
          jumpNextSequenceCondition: null,
          reasoning: 'current_load 오름차순 정렬로 부하가 낮은 설비를 상위에 배치합니다.',
        },
      ],
    },
  },
  {
    input:
      'Idle 상태인 설비 중 최근 5분 이내에 heartbeat을 수신한 설비만 후보로 하되, 후보가 없으면 Standby 상태까지 포함하세요.',
    output: {
      sequences: [
        {
          sequence: 1,
          ruleId: '<DATA 타입 룰의 ruleId>',
          isMandatory: 'Y',
          filterSequence: null,
          jumpNextSequence: null,
          jumpNextSequenceCondition: null,
          reasoning: 'mcs_equipment 전체 목록을 기준 데이터로 조회합니다.',
        },
        {
          sequence: 2,
          ruleId: '<FILTER 타입 룰의 ruleId>',
          isMandatory: 'N',
          filterSequence: 1,
          jumpNextSequence: 3,
          jumpNextSequenceCondition: 'COUNT>0',
          reasoning:
            "state='Idle' AND last_heartbeat_at >= NOW()-5분 조건. 결과가 있으면(COUNT>0) 시퀀스 3으로 점프.",
        },
        {
          sequence: 3,
          ruleId: '<FILTER 타입 룰의 ruleId>',
          isMandatory: 'Y',
          filterSequence: 1,
          jumpNextSequence: null,
          jumpNextSequenceCondition: null,
          reasoning:
            'Idle 후보가 없을 때만 실행. state IN (Idle, Standby)로 조건을 완화하여 재시도.',
        },
      ],
    },
  },
];

/** 시스템 프롬프트에 삽입할 문자열 형태로 변환 */
export function formatFewShotForPrompt(examples: FewShotExample[]): string {
  return examples
    .map(
      (ex, i) =>
        `### 예시 ${i + 1}\n` +
        `입력: "${ex.input}"\n` +
        `출력:\n\`\`\`json\n${JSON.stringify(ex.output, null, 2)}\n\`\`\``
    )
    .join('\n\n');
}
