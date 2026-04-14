import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Carrier } from '@workspace/types/mcs';

const QUERY_KEY = 'mcs_carrier';

/** DB row → TypeScript 타입 변환 */
function toEntity(row: Record<string, unknown>): Carrier {
  return {
    id:                   row.id as string,
    carrierId:            row.carrier_id as string,
    carrierType:          row.carrier_type as string,
    materialType:         row.material_type as string,
    currentEquipmentId:   row.current_equipment_id as string,
    locationId:           (row.location_id as string | null) ?? null,
    state:                row.state as string,
    createdAt:            row.created_at as string,
    // migration 004: 디스패칭 동적 컬럼
    lotId:                (row.lot_id as string) ?? '',
    lotState:             (row.lot_state as string) ?? 'WAIT',
    priority:             (row.priority as number) ?? 5,
    dueTime:              (row.due_time as string | null) ?? null,
    processStep:          (row.process_step as string) ?? '',
  };
}

/** TypeScript 타입 → DB row 변환 */
function toRow(entity: Partial<Carrier>) {
  return {
    ...(entity.carrierId          !== undefined && { carrier_id:           entity.carrierId }),
    ...(entity.carrierType        !== undefined && { carrier_type:         entity.carrierType }),
    ...(entity.materialType       !== undefined && { material_type:        entity.materialType }),
    ...(entity.currentEquipmentId !== undefined && { current_equipment_id: entity.currentEquipmentId }),
    ...(entity.locationId         !== undefined && { location_id:          entity.locationId }),
    ...(entity.state              !== undefined && { state:                entity.state }),
    // migration 004
    ...(entity.lotId              !== undefined && { lot_id:               entity.lotId }),
    ...(entity.lotState           !== undefined && { lot_state:            entity.lotState }),
    ...(entity.priority           !== undefined && { priority:             entity.priority }),
    ...(entity.dueTime            !== undefined && { due_time:             entity.dueTime }),
    ...(entity.processStep        !== undefined && { process_step:         entity.processStep }),
  };
}

/** 캐리어 전체 목록 조회 (3초 폴링 — ACS tick-loop 이 직접 DB write 하므로 Realtime 대신 폴링) */
export function useCarriers() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_carrier')
        .select('*')
        .order('carrier_id');
      if (error) throw error;
      return (data ?? []).map(toEntity);
    },
    refetchInterval: 3000,
  });
}

/** 캐리어 단건 조회 */
export function useCarrier(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_carrier')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    enabled: !!id,
  });
}

/** 캐리어 생성 */
export function useCreateCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (carrier: Omit<Carrier, 'id' | 'createdAt'>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_carrier')
        .insert(toRow(carrier))
        .select()
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

/** 캐리어 수정 */
export function useUpdateCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<Carrier> & { id: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_carrier')
        .update(toRow(rest))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, data.id] });
    },
  });
}

/** 캐리어 삭제 */
export function useDeleteCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('mcs_carrier')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
