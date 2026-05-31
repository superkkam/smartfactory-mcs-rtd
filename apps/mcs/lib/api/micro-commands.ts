import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { MicroCommand } from '@workspace/types/mcs';

const QUERY_KEY = 'mcs_micro_command';

/** DB row → TypeScript 타입 변환 */
function toEntity(row: Record<string, unknown>): MicroCommand {
  return {
    id:                   row.id as string,
    macroCommandId:       row.macro_command_id as string,
    sequence:             row.sequence as number,
    departureUnitId:      row.departure_unit_id as string,
    arrivalUnitId:        row.arrival_unit_id as string,
    state:                row.state as string,
    executorEquipmentId:  (row.executor_equipment_id as string | null) ?? null,
    createdAt:            row.created_at as string,
  };
}

/** TypeScript 타입 → DB row 변환 */
function toRow(entity: Partial<MicroCommand>) {
  return {
    ...(entity.macroCommandId       !== undefined && { macro_command_id:      entity.macroCommandId }),
    ...(entity.sequence             !== undefined && { sequence:              entity.sequence }),
    ...(entity.departureUnitId      !== undefined && { departure_unit_id:     entity.departureUnitId }),
    ...(entity.arrivalUnitId        !== undefined && { arrival_unit_id:       entity.arrivalUnitId }),
    ...(entity.state                !== undefined && { state:                 entity.state }),
    ...(entity.executorEquipmentId  !== undefined && { executor_equipment_id: entity.executorEquipmentId }),
  };
}

/**
 * 특정 AMR 이 현재 실행 중인 마이크로 명령 전체 조회 (2초 폴링)
 * InProgress 인 micro → 부모 macro ID 확인 → 해당 macro 의 전체 sequence 반환
 * leader/follower 탭 무관하게 DB 를 직접 읽으므로 항상 정확한 진행 상태를 보장.
 */
export function useActiveMicroCommandsByExecutor(equipmentId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'by_executor', equipmentId],
    queryFn: async () => {
      const supabase = createClient();
      // 1단계: 현재 이 AMR 이 실행 중인(InProgress) micro 에서 macro_command_id 추출
      const { data: active } = await supabase
        .from('mcs_micro_command')
        .select('macro_command_id')
        .eq('executor_equipment_id', equipmentId)
        .eq('state', 'InProgress')
        .limit(1);
      const macroId = (active?.[0] as Record<string, unknown> | undefined)?.macro_command_id as string | undefined;
      if (!macroId) return [];
      // 2단계: 해당 macro 의 전체 micro command 시퀀스 (Completed 포함)
      const { data, error } = await supabase
        .from('mcs_micro_command')
        .select('*')
        .eq('macro_command_id', macroId)
        .order('sequence');
      if (error) throw error;
      return (data ?? []).map(toEntity);
    },
    enabled: !!equipmentId,
    refetchInterval: 2000,
  });
}

/** 특정 매크로 명령의 마이크로 명령 시퀀스 조회 (3초 폴링) */
export function useMicroCommandsByMacro(macroCommandId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'by_macro', macroCommandId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_micro_command')
        .select('*')
        .eq('macro_command_id', macroCommandId)
        .order('sequence');
      if (error) throw error;
      return (data ?? []).map(toEntity);
    },
    enabled: !!macroCommandId,
    refetchInterval: 3000,
  });
}

/** 마이크로 명령 단건 조회 */
export function useMicroCommand(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_micro_command')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    enabled: !!id,
  });
}

/** 마이크로 명령 일괄 생성 (매크로 명령 분해 시 사용) */
export function useCreateMicroCommands() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commands: Array<Omit<MicroCommand, 'id' | 'createdAt'>>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_micro_command')
        .insert(commands.map(toRow))
        .select();
      if (error) throw error;
      return (data ?? []).map(toEntity);
    },
    onSuccess: (data) => {
      const macroIds = [...new Set(data.map((c) => c.macroCommandId))];
      macroIds.forEach((id) =>
        qc.invalidateQueries({ queryKey: [QUERY_KEY, 'by_macro', id] })
      );
    },
  });
}

/** 마이크로 명령 상태 수정 */
export function useUpdateMicroCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<MicroCommand> & { id: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_micro_command')
        .update(toRow(rest))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'by_macro', data.macroCommandId] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, data.id] });
    },
  });
}
