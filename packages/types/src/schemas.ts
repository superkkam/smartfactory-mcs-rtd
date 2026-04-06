import { z } from 'zod';

/**
 * Zod 폼 유효성 검사 스키마 정의
 */

/** 로그인 폼 스키마 */
export const loginFormSchema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력하세요'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
});
export type LoginFormValues = z.infer<typeof loginFormSchema>;

/** 회원가입 폼 스키마 */
export const registerFormSchema = z
  .object({
    email: z.string().email('올바른 이메일 형식을 입력하세요'),
    password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirmPassword'],
  });
export type RegisterFormValues = z.infer<typeof registerFormSchema>;

/** 룰 그룹 생성/수정 폼 스키마 */
export const ruleGroupFormSchema = z.object({
  ruleGroupId: z.string().min(1, '룰 그룹 ID를 입력하세요'),
  ruleGroupName: z.string().min(1, '룰 그룹 이름을 입력하세요'),
  ruleGroupType: z.enum(['DISPATCHING', 'ROUTING'], {
    required_error: '그룹 유형을 선택하세요',
  }),
  description: z.string().optional(),
  isUsable: z.enum(['Y', 'N']).default('Y'),
});
export type RuleGroupFormValues = z.infer<typeof ruleGroupFormSchema>;

/** 룰 오브젝트(장비-이벤트 매핑) 폼 스키마 */
export const ruleObjectFormSchema = z.object({
  ruleObjectId: z.string().min(1, '장비 ID를 입력하세요'),
  ruleEventId: z.string().min(1, '이벤트 ID를 입력하세요'),
  siteId: z.string().min(1, '사이트 ID를 입력하세요'),
  ruleGroupId: z.string().min(1),
  isUsable: z.enum(['Y', 'N']).default('Y'),
});
export type RuleObjectFormValues = z.infer<typeof ruleObjectFormSchema>;

/** 룰 릴레이션(시퀀스 블록) 폼 스키마 */
export const ruleRelationFormSchema = z.object({
  ruleId: z.string().min(1, '룰을 선택하세요'),
  sequence: z.number().int().positive(),
  isMandatory: z.enum(['Y', 'N', 'O']).default('N'),
  filterSequence: z.number().int().nullable().optional(),
  jumpNextSequence: z.number().int().nullable().optional(),
  jumpNextSequenceCondition: z
    .enum(['COUNT>0', 'COUNT=0'])
    .nullable()
    .optional(),
  ruleSortId: z.string().nullable().optional(),
});
export type RuleRelationFormValues = z.infer<typeof ruleRelationFormSchema>;

/** 정렬 조건 폼 스키마 */
export const ruleSortFormSchema = z.object({
  sortColumn: z.string().min(1, '정렬 컬럼을 선택하세요'),
  orderBy: z.enum(['ASC', 'DESC']).default('ASC'),
  weightValue: z.number().min(0).optional(),
  fromPercent: z.number().min(0).max(100).optional(),
  toPercent: z.number().min(0).max(100).optional(),
});
export type RuleSortFormValues = z.infer<typeof ruleSortFormSchema>;

/** 쿼리 파라미터 바인딩 폼 스키마 */
export const ruleQueryParamFormSchema = z.object({
  paramKey: z.string().min(1, '파라미터 키를 입력하세요'),
  paramValue: z.string().min(1, '파라미터 값을 입력하세요'),
  targetColumn: z.string().min(1, '대상 컬럼을 입력하세요'),
});
export type RuleQueryParamFormValues = z.infer<typeof ruleQueryParamFormSchema>;
