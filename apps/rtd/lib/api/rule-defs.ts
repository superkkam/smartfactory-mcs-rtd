import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { RuleDef } from '@workspace/types/rtd';

const QUERY_KEY = 'rule_defs';

function toRuleDef(row: Record<string, unknown>): RuleDef {
  return {
    ruleId:        row.rule_id as string,
    ruleName:      row.rule_name as string,
    ruleClassId:   row.rule_class_id as string,
    ruleType:      row.rule_type as string,
    ruleCondition: row.rule_condition as string | undefined,
  };
}

/** 룰 정의 목록 조회 */
export function useRuleDefs() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_def')
        .select('*')
        .order('rule_id');
      if (error) throw error;
      return (data ?? []).map(toRuleDef);
    },
  });
}

/** 룰 정의 신규 생성 */
export function useCreateRuleDef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (def: Omit<RuleDef, 'ruleCondition'> & { ruleCondition?: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_def')
        .insert({
          rule_id:       def.ruleId,
          rule_name:     def.ruleName,
          rule_class_id: def.ruleClassId,
          rule_type:     def.ruleType,
          rule_condition: def.ruleCondition ?? '',
        })
        .select()
        .single();
      if (error) throw error;
      return toRuleDef(data as Record<string, unknown>);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

/** 룰 이름 수정 */
export function useUpdateRuleDef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, ruleName }: { ruleId: string; ruleName: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('rule_def')
        .update({ rule_name: ruleName })
        .eq('rule_id', ruleId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

/** 특정 룰 단건 조회 */
export function useRuleDef(ruleId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, ruleId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_def')
        .select('*')
        .eq('rule_id', ruleId)
        .single();
      if (error) throw error;
      return toRuleDef(data);
    },
    enabled: !!ruleId,
  });
}
