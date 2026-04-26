import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';

/** LLM이 생성한 단일 시퀀스 항목 */
export const GeneratedSequenceSchema = z.object({
  sequence: z.number().int().min(1),
  ruleId: z.string().min(1),
  isMandatory: z.enum(['Y', 'N', 'O']),
  filterSequence: z.number().int().nullable().optional(),
  jumpNextSequence: z.number().int().nullable().optional(),
  jumpNextSequenceCondition: z.string().nullable().optional(),
  reasoning: z.string().optional(),
});

export const GeneratedRulesSchema = z.object({
  sequences: z.array(GeneratedSequenceSchema).min(1),
});

export type GeneratedSequence = z.infer<typeof GeneratedSequenceSchema>;
export type GeneratedRules = z.infer<typeof GeneratedRulesSchema>;

/** Anthropic Tool Use 스키마 */
export const GENERATE_RULES_TOOL: Tool = {
  name: 'generate_rule_relations',
  description: '자연어 디스패칭 조건 설명을 RuleRelation 시퀀스 배열로 변환합니다.',
  input_schema: {
    type: 'object' as const,
    properties: {
      sequences: {
        type: 'array',
        description: '생성된 룰 시퀀스 목록 (sequence 번호 오름차순 정렬)',
        items: {
          type: 'object',
          properties: {
            sequence: {
              type: 'integer',
              minimum: 1,
              description: '1부터 시작하는 연속 순서 번호',
            },
            ruleId: {
              type: 'string',
              description: '반드시 제공된 [사용 가능한 룰] 목록의 ruleId 중 하나를 사용',
            },
            isMandatory: {
              type: 'string',
              enum: ['Y', 'N', 'O'],
              description: 'Y=필수(0건이면 실패), N=선택(0건이면 스킵), O=선택적',
            },
            filterSequence: {
              type: ['integer', 'null'],
              description: '이 시퀀스의 입력이 될 이전 시퀀스 번호. null이면 DB 전체 조회.',
            },
            jumpNextSequence: {
              type: ['integer', 'null'],
              description: '조건 충족 시 점프할 시퀀스 번호. 반드시 자신보다 큰 값.',
            },
            jumpNextSequenceCondition: {
              type: ['string', 'null'],
              description: '점프 조건: COUNT>0 | COUNT=0 | null',
            },
            reasoning: {
              type: 'string',
              description: '이 룰을 이 위치에 배치한 이유 (한국어 1~2문장)',
            },
          },
          required: ['sequence', 'ruleId', 'isMandatory'],
        },
      },
    },
    required: ['sequences'],
  },
};

/**
 * LLM 응답 불변성 검증.
 * 에러 메시지 배열 반환 (길이 0 = 정상).
 */
export function validateGeneratedRules(
  rules: GeneratedRules,
  validRuleIds: Set<string>
): string[] {
  const errors: string[] = [];
  const seqNums = new Set(rules.sequences.map((s) => s.sequence));

  rules.sequences.forEach((s) => {
    if (!validRuleIds.has(s.ruleId)) {
      errors.push(`sequence ${s.sequence}: ruleId "${s.ruleId}"가 사용 가능한 룰 목록에 없습니다.`);
    }
    if (s.filterSequence != null) {
      if (s.filterSequence >= s.sequence) {
        errors.push(
          `sequence ${s.sequence}: filterSequence(${s.filterSequence})는 자신보다 작아야 합니다.`
        );
      }
      if (!seqNums.has(s.filterSequence)) {
        errors.push(
          `sequence ${s.sequence}: filterSequence(${s.filterSequence})가 시퀀스 목록에 없습니다.`
        );
      }
    }
    if (s.jumpNextSequence != null && s.jumpNextSequence <= s.sequence) {
      errors.push(
        `sequence ${s.sequence}: jumpNextSequence(${s.jumpNextSequence})는 자신보다 커야 합니다.`
      );
    }
  });

  return errors;
}
