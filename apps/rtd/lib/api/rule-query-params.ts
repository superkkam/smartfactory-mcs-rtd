import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { RuleQueryParam } from '@workspace/types/rtd';

const QUERY_KEY = 'rule_query_params';
const DEFAULT_VERSION = '1';

function toRuleQueryParam(row: Record<string, unknown>): RuleQueryParam {
  return {
    ruleQueryId:      row.rule_query_id as string,
    ruleQueryVersion: row.rule_query_version as string,
    paramKey:         row.param_key as string,
    paramValue:       row.param_value as string,
    targetColumn:     row.target_column as string,
  };
}

/** 룰 ID 기반 파라미터 목록 조회 */
export function useRuleQueryParams(ruleId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, ruleId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_query_param')
        .select('*')
        .eq('rule_query_id', ruleId!)
        .eq('rule_query_version', DEFAULT_VERSION);
      if (error) throw error;
      return (data ?? []).map(toRuleQueryParam);
    },
    enabled: !!ruleId,
  });
}

/** 파라미터 일괄 저장 (기존 삭제 후 재삽입) */
export function useSaveRuleQueryParams() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ruleId,
      params,
    }: {
      ruleId: string;
      params: Array<{ paramKey: string; paramValue: string; targetColumn: string }>;
    }) => {
      const supabase = createClient();
      // 기존 파라미터 삭제
      const { error: delError } = await supabase
        .from('rule_query_param')
        .delete()
        .eq('rule_query_id', ruleId)
        .eq('rule_query_version', DEFAULT_VERSION);
      if (delError) throw delError;

      if (params.length === 0) return [];

      // 새 파라미터 삽입
      const rows = params.map((p) => ({
        rule_query_id:      ruleId,
        rule_query_version: DEFAULT_VERSION,
        param_key:          p.paramKey,
        param_value:        p.paramValue,
        target_column:      p.targetColumn,
      }));
      const { data, error } = await supabase
        .from('rule_query_param')
        .insert(rows)
        .select();
      if (error) throw error;
      return (data ?? []).map(toRuleQueryParam);
    },
    onSuccess: (_, vars) =>
      qc.refetchQueries({ queryKey: [QUERY_KEY, vars.ruleId] }),
  });
}
