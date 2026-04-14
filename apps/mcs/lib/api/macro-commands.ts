import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { MacroCommand } from '@workspace/types/mcs';

const QUERY_KEY = 'mcs_macro_command';

/** DB row → TypeScript 타입 변환 */
function toEntity(row: Record<string, unknown>): MacroCommand {
  return {
    id:           row.id as string,
    commandId:    row.command_id as string,
    carrierId:    row.carrier_id as string,
    sourceUnitId: row.source_unit_id as string,
    destUnitId:   row.dest_unit_id as string,
    state:        row.state as string,
    priority:     row.priority as number,
    createdAt:    row.created_at as string,
  };
}

/** TypeScript 타입 → DB row 변환 */
function toRow(entity: Partial<MacroCommand>) {
  return {
    ...(entity.commandId    !== undefined && { command_id:     entity.commandId }),
    ...(entity.carrierId    !== undefined && { carrier_id:     entity.carrierId }),
    ...(entity.sourceUnitId !== undefined && { source_unit_id: entity.sourceUnitId }),
    ...(entity.destUnitId   !== undefined && { dest_unit_id:   entity.destUnitId }),
    ...(entity.state        !== undefined && { state:          entity.state }),
    ...(entity.priority     !== undefined && { priority:       entity.priority }),
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
