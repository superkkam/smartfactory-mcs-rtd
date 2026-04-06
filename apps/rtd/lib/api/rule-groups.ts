import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { RuleGroup } from '@workspace/types/rtd';

const QUERY_KEY = 'rule_groups';

/** DB row → TypeScript 타입 변환 */
function toRuleGroup(row: Record<string, unknown>): RuleGroup {
  return {
    ruleGroupId:   row.rule_group_id as string,
    ruleGroupName: row.rule_group_name as string,
    ruleGroupType: row.rule_group_type as string,
    isUsable:      row.is_usable as string,
    description:   row.description as string | undefined,
  };
}

/** TypeScript 타입 → DB row 변환 */
function toRow(g: Partial<RuleGroup>) {
  return {
    ...(g.ruleGroupId   !== undefined && { rule_group_id:   g.ruleGroupId }),
    ...(g.ruleGroupName !== undefined && { rule_group_name: g.ruleGroupName }),
    ...(g.ruleGroupType !== undefined && { rule_group_type: g.ruleGroupType }),
    ...(g.isUsable      !== undefined && { is_usable:       g.isUsable }),
    ...(g.description   !== undefined && { description:     g.description }),
  };
}

/** 룰 그룹 목록 조회 */
export function useRuleGroups() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_group')
        .select('*')
        .order('rule_group_id');
      if (error) throw error;
      return (data ?? []).map(toRuleGroup);
    },
  });
}

/** 룰 그룹 단건 조회 */
export function useRuleGroup(ruleGroupId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, ruleGroupId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_group')
        .select('*')
        .eq('rule_group_id', ruleGroupId)
        .single();
      if (error) throw error;
      return toRuleGroup(data);
    },
    enabled: !!ruleGroupId,
  });
}

/** 룰 그룹 생성 */
export function useCreateRuleGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (group: Omit<RuleGroup, 'description'> & { description?: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_group')
        .insert(toRow(group))
        .select()
        .single();
      if (error) throw error;
      return toRuleGroup(data);
    },
    onSuccess: () => qc.refetchQueries({ queryKey: [QUERY_KEY] }),
  });
}

/** 룰 그룹 수정 */
export function useUpdateRuleGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleGroupId, ...rest }: Partial<RuleGroup> & { ruleGroupId: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_group')
        .update(toRow(rest))
        .eq('rule_group_id', ruleGroupId)
        .select()
        .single();
      if (error) throw error;
      return toRuleGroup(data);
    },
    onSuccess: () => qc.refetchQueries({ queryKey: [QUERY_KEY] }),
  });
}

/** 룰 그룹 삭제 */
export function useDeleteRuleGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ruleGroupId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('rule_group')
        .delete()
        .eq('rule_group_id', ruleGroupId);
      if (error) throw error;
    },
    onSuccess: () => qc.refetchQueries({ queryKey: [QUERY_KEY] }),
  });
}
