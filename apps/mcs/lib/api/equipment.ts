import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Equipment } from '@workspace/types/mcs';

const QUERY_KEY = 'mcs_equipment';

/** DB row → TypeScript 타입 변환 */
function toEntity(row: Record<string, unknown>): Equipment {
  return {
    id:               row.id as string,
    equipmentId:      row.equipment_id as string,
    layoutId:         row.layout_id as string,
    equipmentType:    row.equipment_type as string,
    ecServerName:     row.ec_server_name as string,
    inlineStocker:    row.inline_stocker as boolean,
    state:            row.state as string,
    locationId:       (row.location_id as string | null) ?? null,
    createdAt:        row.created_at as string,
    // migration 004: 디스패칭 동적 컬럼
    availability:     (row.availability as boolean) ?? true,
    currentLoad:      (row.current_load as number) ?? 0,
    capacity:         (row.capacity as number) ?? 1,
    recipeType:       (row.recipe_type as string) ?? '',
    lastHeartbeatAt:  (row.last_heartbeat_at as string) ?? new Date().toISOString(),
  };
}

/** TypeScript 타입 → DB row 변환 */
function toRow(entity: Partial<Equipment>) {
  return {
    ...(entity.equipmentId    !== undefined && { equipment_id:       entity.equipmentId }),
    ...(entity.layoutId       !== undefined && { layout_id:          entity.layoutId }),
    ...(entity.equipmentType  !== undefined && { equipment_type:     entity.equipmentType }),
    ...(entity.ecServerName   !== undefined && { ec_server_name:     entity.ecServerName }),
    ...(entity.inlineStocker  !== undefined && { inline_stocker:     entity.inlineStocker }),
    ...(entity.state          !== undefined && { state:              entity.state }),
    ...(entity.locationId     !== undefined && { location_id:        entity.locationId }),
    // migration 004
    ...(entity.availability   !== undefined && { availability:       entity.availability }),
    ...(entity.currentLoad    !== undefined && { current_load:       entity.currentLoad }),
    ...(entity.capacity       !== undefined && { capacity:           entity.capacity }),
    ...(entity.recipeType     !== undefined && { recipe_type:        entity.recipeType }),
    ...(entity.lastHeartbeatAt !== undefined && { last_heartbeat_at: entity.lastHeartbeatAt }),
  };
}

/** 특정 레이아웃의 장비 목록 조회 */
export function useEquipmentsByLayout(layoutId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'by_layout', layoutId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_equipment')
        .select('*')
        .eq('layout_id', layoutId)
        .order('equipment_id');
      if (error) throw error;
      return (data ?? []).map(toEntity);
    },
    enabled: !!layoutId,
  });
}

/** 장비 단건 조회 */
export function useEquipment(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_equipment')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    enabled: !!id,
  });
}

/** 장비 생성 */
export function useCreateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (equipment: Omit<Equipment, 'id' | 'createdAt'>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_equipment')
        .insert(toRow(equipment))
        .select()
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'by_layout', vars.layoutId] });
    },
  });
}

/** 장비 상태 수정 */
export function useUpdateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<Equipment> & { id: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_equipment')
        .update(toRow(rest))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'by_layout', data.layoutId] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, data.id] });
    },
  });
}

/** 장비 삭제 */
export function useDeleteEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, layoutId }: { id: string; layoutId: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('mcs_equipment')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return layoutId;
    },
    onSuccess: (layoutId) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'by_layout', layoutId] });
    },
  });
}
