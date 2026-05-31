import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { MacroCommand } from '@workspace/types/mcs';

const QUERY_KEY = 'mcs_macro_command';

/** DB row → TypeScript 타입 변환 */
function toEntity(row: Record<string, unknown>): MacroCommand {
  return {
    id:                row.id as string,
    commandId:         row.command_id as string,
    carrierId:         row.carrier_id as string,
    sourceUnitId:      row.source_unit_id as string,
    destUnitId:        row.dest_unit_id as string,
    state:             row.state as string,
    priority:          row.priority as number,
    createdAt:         row.created_at as string,
    rtdCommandId:      (row.rtd_command_id as string | null) ?? null,
    correlationId:     (row.correlation_id as string | null) ?? null,
    sourceSystem:      (row.source_system as string | undefined) ?? 'MANUAL',
    algorithm:         (row.algorithm as 'ASTAR' | 'AI_PPO' | 'CACTUS' | 'CBS_TS' | undefined) ?? 'ASTAR',
    sourceEquipmentId: (row.source_equipment_id as string | null) ?? null,
    destEquipmentId:   (row.dest_equipment_id as string | null) ?? null,
  };
}

/** TypeScript 타입 → DB row 변환 */
function toRow(entity: Partial<MacroCommand>) {
  return {
    ...(entity.commandId         !== undefined && { command_id:           entity.commandId }),
    ...(entity.carrierId         !== undefined && { carrier_id:           entity.carrierId }),
    ...(entity.sourceUnitId      !== undefined && { source_unit_id:       entity.sourceUnitId }),
    ...(entity.destUnitId        !== undefined && { dest_unit_id:         entity.destUnitId }),
    ...(entity.state             !== undefined && { state:                entity.state }),
    ...(entity.priority          !== undefined && { priority:             entity.priority }),
    ...(entity.rtdCommandId      !== undefined && { rtd_command_id:       entity.rtdCommandId }),
    ...(entity.correlationId     !== undefined && { correlation_id:       entity.correlationId }),
    ...(entity.sourceSystem      !== undefined && { source_system:        entity.sourceSystem }),
    ...(entity.algorithm         !== undefined && { algorithm:            entity.algorithm }),
    ...(entity.sourceEquipmentId !== undefined && { source_equipment_id:  entity.sourceEquipmentId }),
    ...(entity.destEquipmentId   !== undefined && { dest_equipment_id:    entity.destEquipmentId }),
  };
}

/** 매크로 명령 목록 조회 (최신순) */
export function useMacroCommands() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_macro_command')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toEntity);
    },
  });
}

/** 진행 중인 매크로 명령만 조회 (3초 폴링 — ACS tick-loop 이 직접 DB write 하므로 Realtime 대신 폴링) */
export function useActiveMacroCommands() {
  return useQuery({
    queryKey: [QUERY_KEY, 'active'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_macro_command')
        .select('*')
        .in('state', ['Pending', 'InProgress'])
        .order('priority', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toEntity);
    },
    refetchInterval: 3000,
  });
}

/**
 * ack 수신 시각 이후에 생성된 RTD 매크로 조회 (3초 폴링)
 * DispatchResultPanel 전용: LoadRequest ACK 직후부터 해당 반송 명령만 추적.
 * buffer 30s — RTD → MCS DISPATCH_RESULT 처리 지연 흡수.
 */
export function useRtdMacroSince(ackAt: number | null) {
  return useQuery({
    queryKey: [QUERY_KEY, 'rtd_since', ackAt],
    queryFn: async () => {
      if (!ackAt) return null;
      const supabase = createClient();
      const since = new Date(ackAt - 30_000).toISOString();
      const { data, error } = await supabase
        .from('mcs_macro_command')
        .select('*')
        .eq('source_system', 'RTD')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? toEntity(data) : null;
    },
    enabled: !!ackAt,
    refetchInterval: 3000,
  });
}

/** 매크로 명령 단건 조회 */
export function useMacroCommand(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_macro_command')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    enabled: !!id,
  });
}

/** 매크로 명령 생성 */
export function useCreateMacroCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (command: Omit<MacroCommand, 'id' | 'createdAt'>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_macro_command')
        .insert(toRow(command))
        .select()
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'active'] });
    },
  });
}

/** 매크로 명령 상태 수정 */
export function useUpdateMacroCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<MacroCommand> & { id: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_macro_command')
        .update(toRow(rest))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'active'] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, data.id] });
    },
  });
}
