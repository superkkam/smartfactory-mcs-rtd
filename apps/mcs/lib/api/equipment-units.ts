import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { EquipmentUnit } from '@workspace/types/mcs';

const QUERY_KEY = 'mcs_equipment_unit';

/** DB row → TypeScript 타입 변환 */
function toEntity(row: Record<string, unknown>): EquipmentUnit {
  return {
    id:                   row.id as string,
    equipmentUnitId:      row.equipment_unit_id as string,
    equipmentId:          row.equipment_id as string,
    unitType:             row.unit_type as string,
    inOutMode:            row.in_out_mode as string,
    transferState:        row.transfer_state as string,
    createdAt:            row.created_at as string,
    // migration 004: 디스패칭 동적 컬럼
    currentCarrierId:     (row.current_carrier_id as string | null) ?? null,
    reservedByCommandId:  (row.reserved_by_command_id as string | null) ?? null,
    queueLength:          (row.queue_length as number) ?? 0,
    lastStateChangedAt:   (row.last_state_changed_at as string) ?? new Date().toISOString(),
  };
}

/** TypeScript 타입 → DB row 변환 */
function toRow(entity: Partial<EquipmentUnit>) {
  return {
    ...(entity.equipmentUnitId    !== undefined && { equipment_unit_id:       entity.equipmentUnitId }),
    ...(entity.equipmentId        !== undefined && { equipment_id:            entity.equipmentId }),
    ...(entity.unitType           !== undefined && { unit_type:               entity.unitType }),
    ...(entity.inOutMode          !== undefined && { in_out_mode:             entity.inOutMode }),
    ...(entity.transferState      !== undefined && { transfer_state:          entity.transferState }),
    // migration 004
    ...(entity.currentCarrierId   !== undefined && { current_carrier_id:      entity.currentCarrierId }),
    ...(entity.reservedByCommandId !== undefined && { reserved_by_command_id: entity.reservedByCommandId }),
    ...(entity.queueLength        !== undefined && { queue_length:            entity.queueLength }),
    ...(entity.lastStateChangedAt !== undefined && { last_state_changed_at:  entity.lastStateChangedAt }),
  };
}

/** 특정 장비의 유닛 목록 조회 */
export function useUnitsByEquipment(equipmentId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'by_equipment', equipmentId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_equipment_unit')
        .select('*')
        .eq('equipment_id', equipmentId)
        .order('equipment_unit_id');
      if (error) throw error;
      return (data ?? []).map(toEntity);
    },
    enabled: !!equipmentId,
  });
}

/**
 * 특정 레이아웃의 모든 유닛 목록 조회 (2단계: equipment ID 조회 → unit 조회)
 * 반송 제어 페이지 출발/목적지 선택 드롭다운에 사용
 */
export function useUnitsByLayout(layoutId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'by_layout', layoutId],
    queryFn: async () => {
      const supabase = createClient();

      // 1단계: 해당 레이아웃의 장비 ID 목록 조회
      const { data: equipments, error: eqErr } = await supabase
        .from('mcs_equipment')
        .select('id')
        .eq('layout_id', layoutId);
      if (eqErr) throw eqErr;
      if (!equipments || equipments.length === 0) return [];

      const equipmentIds = equipments.map((e) => e.id);

      // 2단계: 해당 장비들에 속한 유닛 전체 조회
      const { data, error } = await supabase
        .from('mcs_equipment_unit')
        .select('*')
        .in('equipment_id', equipmentIds)
        .order('equipment_unit_id');
      if (error) throw error;
      return (data ?? []).map(toEntity);
    },
    enabled: !!layoutId,
  });
}

/** 유닛 단건 조회 */
export function useEquipmentUnit(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_equipment_unit')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    enabled: !!id,
  });
}

/** 유닛 생성 */
export function useCreateEquipmentUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (unit: Omit<EquipmentUnit, 'id' | 'createdAt'>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_equipment_unit')
        .insert(toRow(unit))
        .select()
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'by_equipment', vars.equipmentId] });
    },
  });
}

/** 유닛 수정 */
export function useUpdateEquipmentUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<EquipmentUnit> & { id: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_equipment_unit')
        .update(toRow(rest))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'by_equipment', data.equipmentId] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, data.id] });
    },
  });
}

/** 유닛 삭제 */
export function useDeleteEquipmentUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, equipmentId }: { id: string; equipmentId: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('mcs_equipment_unit')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return equipmentId;
    },
    onSuccess: (equipmentId) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'by_equipment', equipmentId] });
    },
  });
}
