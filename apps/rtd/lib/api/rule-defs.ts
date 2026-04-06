import { useQuery } from '@tanstack/react-query';
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
