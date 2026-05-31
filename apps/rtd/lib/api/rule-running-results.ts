import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeSubscription } from '@/lib/hooks/use-realtime-subscription';
import type { RuleRunningResult } from '@workspace/types/rtd';

const QUERY_KEY = 'rule_running_results';
const PAGE_LIMIT = 100;   // 초기 조회 건수
const CACHE_LIMIT = 200;  // Realtime 수신 시 메모리 상한

/** DB row(snake_case) → TypeScript 타입(camelCase) 변환 */
function toRuleRunningResult(row: Record<string, unknown>): RuleRunningResult {
  return {
    uuid:             row.uuid as string,
    lotId:            row.lot_id as string,
    ruleId:           row.rule_id as string,
    ruleName:         (row.rule_name as string | null) ?? null,
    sequence:         row.sequence as number,
    count:            row.count as number,
    startTime:        row.start_time as string,
    endTime:          row.end_time as string,
    isDispatching:    row.is_dispatching as string,
    destEquipmentId:  (row.dest_equipment_id as string | null) ?? null,
    resultRows:       (row.result_rows as Record<string, unknown>[] | null) ?? null,
  };
}

export interface RunningResultFilters {
  lotId?: string;
  ruleId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * 룰 실행 결과 조회 + Supabase Realtime 구독 통합 훅.
 *
 * - 초기 조회: 최근 100건, 최신순
 * - 실시간 구독: INSERT 이벤트 → 캐시 prepend (최대 200건 유지)
 * - isRealtimeEnabled / toggleRealtime 으로 실시간 연결 토글
 */
export function useRuleRunningResults(filters: RunningResultFilters = {}) {
  const queryClient = useQueryClient();
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(false);

  const queryKey = [QUERY_KEY, filters];

  // ── 초기 조회 ──────────────────────────────────────────
  const { data = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('rule_running_result')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(PAGE_LIMIT);

      if (filters.lotId)    query = query.ilike('lot_id', `%${filters.lotId}%`);
      if (filters.ruleId)   query = query.eq('rule_id', filters.ruleId);
      if (filters.startDate) query = query.gte('start_time', filters.startDate);
      if (filters.endDate)   query = query.lte('start_time', filters.endDate);

      const { data: rows, error } = await query;
      if (error) throw error;
      return (rows ?? []).map(toRuleRunningResult);
    },
  });

  // ── Realtime 구독 ──────────────────────────────────────
  const { connectionStatus } = useRealtimeSubscription({
    table: 'rule_running_result',
    event: 'INSERT',
    enabled: isRealtimeEnabled,
    onReceive: (payload) => {
      const newItem = toRuleRunningResult(payload.new as Record<string, unknown>);
      queryClient.setQueryData<RuleRunningResult[]>(queryKey, (old) => {
        const updated = [newItem, ...(old ?? [])];
        return updated.slice(0, CACHE_LIMIT);
      });
    },
  });

  return {
    data,
    isLoading,
    error: error as Error | null,
    connectionStatus,
    isRealtimeEnabled,
    toggleRealtime: () => setIsRealtimeEnabled((v) => !v),
  };
}
