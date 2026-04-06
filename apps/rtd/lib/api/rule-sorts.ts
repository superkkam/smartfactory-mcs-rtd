import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { RuleSort } from '@workspace/types/rtd';

const QUERY_KEY = 'rule_sorts';

function toRuleSort(row: Record<string, unknown>): RuleSort {
  return {
    ruleSortId:   row.rule_sort_id as string,
    sortColumn:   row.sort_column as string,
    weightValue:  row.weight_value as number | undefined,
    fromPercent:  row.from_percent as number | undefined,
    toPercent:    row.to_percent as number | undefined,
    orderBy:      row.order_by as string,
  };
}

function toRow(s: Partial<RuleSort>) {
  return {
    ...(s.ruleSortId  !== undefined && { rule_sort_id:  s.ruleSortId }),
    ...(s.sortColumn  !== undefined && { sort_column:   s.sortColumn }),
    ...(s.weightValue !== undefined && { weight_value:  s.weightValue }),
    ...(s.fromPercent !== undefined && { from_percent:  s.fromPercent }),
    ...(s.toPercent   !== undefined && { to_percent:    s.toPercent }),
    ...(s.orderBy     !== undefined && { order_by:      s.orderBy }),
  };
}

/** 정렬 조건 단건 조회 */
export function useRuleSort(ruleSortId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, ruleSortId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_sort')
        .select('*')
        .eq('rule_sort_id', ruleSortId!)
        .single();
      if (error) throw error;
      return toRuleSort(data);
    },
    enabled: !!ruleSortId,
  });
}

/** 정렬 조건 저장 (upsert) */
export function useUpsertRuleSort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sort: RuleSort) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_sort')
        .upsert(toRow(sort))
        .select()
        .single();
      if (error) throw error;
      return toRuleSort(data);
    },
    onSuccess: (_, vars) =>
      qc.refetchQueries({ queryKey: [QUERY_KEY, vars.ruleSortId] }),
  });
}
