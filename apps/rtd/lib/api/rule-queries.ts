import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { RuleQuery } from '@workspace/types/rtd';

const QUERY_KEY = 'rule_queries';
/** 연구 프로토타입에서는 버전 고정 */
const DEFAULT_VERSION = '1';

function toRuleQuery(row: Record<string, unknown>): RuleQuery {
  return {
    ruleQueryId:      row.rule_query_id as string,
    ruleQueryVersion: row.rule_query_version as string,
    ruleQueryString:  row.rule_query_string as string,
    ruleQueryType:    row.rule_query_type as string | undefined,
  };
}

/** 룰 ID 기반 쿼리 조회 (ruleQueryId = ruleId, version = '1') */
export function useRuleQuery(ruleId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, ruleId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_query')
        .select('*')
        .eq('rule_query_id', ruleId!)
        .eq('rule_query_version', DEFAULT_VERSION)
        .maybeSingle();
      if (error) throw error;
      return data ? toRuleQuery(data) : null;
    },
    enabled: !!ruleId,
  });
}

/** SQL 쿼리 삭제 */
export function useDeleteRuleQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('rule_query')
        .delete()
        .eq('rule_query_id', ruleId)
        .eq('rule_query_version', DEFAULT_VERSION);
      if (error) throw error;
    },
    onSuccess: (_, ruleId) =>
      qc.refetchQueries({ queryKey: [QUERY_KEY, ruleId] }),
  });
}

/** SQL 쿼리 저장 (upsert) */
export function useUpsertRuleQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, sql, ruleQueryType }: { ruleId: string; sql: string; ruleQueryType?: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_query')
        .upsert({
          rule_query_id:      ruleId,
          rule_query_version: DEFAULT_VERSION,
          rule_query_string:  sql,
          ...(ruleQueryType && { rule_query_type: ruleQueryType }),
        })
        .select()
        .single();
      if (error) throw error;
      return toRuleQuery(data);
    },
    onSuccess: (_, vars) =>
      qc.refetchQueries({ queryKey: [QUERY_KEY, vars.ruleId] }),
  });
}
