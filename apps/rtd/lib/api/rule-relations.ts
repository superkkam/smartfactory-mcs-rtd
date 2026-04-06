import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { RuleRelation } from '@workspace/types/rtd';

const QUERY_KEY = 'rule_relations';

function toRuleRelation(row: Record<string, unknown>): RuleRelation {
  return {
    ruleGroupId:                row.rule_group_id as string,
    ruleId:                     row.rule_id as string,
    sequence:                   row.sequence as number,
    isMandatory:                row.is_mandatory as string,
    filterSequence:             row.filter_sequence as number | null,
    jumpNextSequence:           row.jump_next_sequence as number | null,
    jumpNextSequenceCondition:  row.jump_next_sequence_condition as string | null,
    ruleSortId:                 row.rule_sort_id as string | null,
  };
}

function toRow(r: Partial<RuleRelation>) {
  return {
    ...(r.ruleGroupId               !== undefined && { rule_group_id:               r.ruleGroupId }),
    ...(r.ruleId                    !== undefined && { rule_id:                     r.ruleId }),
    ...(r.sequence                  !== undefined && { sequence:                    r.sequence }),
    ...(r.isMandatory               !== undefined && { is_mandatory:                r.isMandatory }),
    ...(r.filterSequence            !== undefined && { filter_sequence:             r.filterSequence }),
    ...(r.jumpNextSequence          !== undefined && { jump_next_sequence:          r.jumpNextSequence }),
    ...(r.jumpNextSequenceCondition !== undefined && { jump_next_sequence_condition: r.jumpNextSequenceCondition }),
    ...(r.ruleSortId                !== undefined && { rule_sort_id:               r.ruleSortId }),
  };
}

/** 특정 룰 그룹의 릴레이션 목록 조회 */
export function useRuleRelations(ruleGroupId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, ruleGroupId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_relation')
        .select('*')
        .eq('rule_group_id', ruleGroupId)
        .order('sequence');
      if (error) throw error;
      return (data ?? []).map(toRuleRelation);
    },
    enabled: !!ruleGroupId,
  });
}

/** 릴레이션 추가 */
export function useCreateRuleRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (relation: RuleRelation) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_relation')
        .insert(toRow(relation))
        .select()
        .single();
      if (error) throw error;
      return toRuleRelation(data);
    },
    onSuccess: (_, vars) =>
      qc.refetchQueries({ queryKey: [QUERY_KEY, vars.ruleGroupId] }),
  });
}

/** 릴레이션 수정 */
export function useUpdateRuleRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (relation: RuleRelation) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_relation')
        .update(toRow(relation))
        .eq('rule_group_id', relation.ruleGroupId)
        .eq('rule_id', relation.ruleId)
        .eq('sequence', relation.sequence)
        .select()
        .single();
      if (error) throw error;
      return toRuleRelation(data);
    },
    onSuccess: (_, vars) =>
      qc.refetchQueries({ queryKey: [QUERY_KEY, vars.ruleGroupId] }),
  });
}

/** 릴레이션 삭제 */
export function useDeleteRuleRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (relation: Pick<RuleRelation, 'ruleGroupId' | 'ruleId' | 'sequence'>) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('rule_relation')
        .delete()
        .eq('rule_group_id', relation.ruleGroupId)
        .eq('rule_id', relation.ruleId)
        .eq('sequence', relation.sequence);
      if (error) throw error;
    },
    onSuccess: (_, vars) =>
      qc.refetchQueries({ queryKey: [QUERY_KEY, vars.ruleGroupId] }),
  });
}
