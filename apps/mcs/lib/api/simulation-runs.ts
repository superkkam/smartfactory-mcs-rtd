/**
 * Supabase mcs_simulation_run 이력 조회
 * TanStack Query 훅
 */
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { SimulationRun } from '@workspace/types/mcs';

const QUERY_KEY = 'mcs_simulation_run';

/** DB row → TypeScript 타입 변환 */
function toEntity(row: Record<string, unknown>): SimulationRun {
  return {
    id: row.id as string,
    scenarioParams: row.scenario_params as SimulationRun['scenarioParams'],
    algorithms: row.algorithms as string,
    status: row.status as string,
    createdAt: row.created_at as string,
  };
}

/** 단건 조회 (layoutId 추출용 — 결과 페이지 ReplayCanvas) */
export function useSimulationRun(runId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, runId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_simulation_run')
        .select('id, layout_id, scenario_params, algorithms, status')
        .eq('id', runId!)
        .single();
      if (error) throw error;
      return {
        id:             data.id as string,
        layoutId:       data.layout_id as string,
        scenarioParams: data.scenario_params as SimulationRun['scenarioParams'],
        algorithms:     data.algorithms as string,
        status:         data.status as string,
      };
    },
    enabled: !!runId,
    staleTime: Infinity,
  });
}

/** 최근 시뮬레이션 실행 이력 (최신순 10건) */
export function useSimulationRuns() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_simulation_run')
        .select('id, scenario_params, algorithms, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []).map(toEntity);
    },
    refetchInterval: 5000,
  });
}
