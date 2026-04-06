import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { RuleObject } from '@workspace/types/rtd';

const QUERY_KEY = 'rule_objects';

function toRuleObject(row: Record<string, unknown>): RuleObject {
  return {
    ruleObjectId: row.rule_object_id as string,
    ruleEventId:  row.rule_event_id as string,
    siteId:       row.site_id as string,
    ruleGroupId:  row.rule_group_id as string,
    isUsable:     row.is_usable as string,
  };
}

/** 특정 룰 그룹에 매핑된 장비-이벤트 목록 조회 */
export function useRuleObjects(ruleGroupId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, ruleGroupId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('rule_object')
        .select('*')
        .eq('rule_group_id', ruleGroupId);
      if (error) throw error;
      return (data ?? []).map(toRuleObject);
    },
    enabled: !!ruleGroupId,
  });
}
