import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { TransferRelation } from '@workspace/types/mcs';

const QUERY_KEY = 'mcs_transfer_relation';

/** DB row → TypeScript 타입 변환 */
function toEntity(row: Record<string, unknown>): TransferRelation {
  return {
    id:                     row.id as string,
    layoutId:               row.layout_id as string,
    departureUnitId:        row.departure_unit_id as string,
    arrivalUnitId:          row.arrival_unit_id as string,
    transportEquipmentId:   row.transport_equipment_id as string,
    weight:                 row.weight as number,
    createdAt:              row.created_at as string,
  };
}

/** TypeScript 타입 → DB row 변환 */
function toRow(entity: Partial<TransferRelation>) {
  return {
    ...(entity.layoutId              !== undefined && { layout_id:               entity.layoutId }),
    ...(entity.departureUnitId       !== undefined && { departure_unit_id:       entity.departureUnitId }),
    ...(entity.arrivalUnitId         !== undefined && { arrival_unit_id:         entity.arrivalUnitId }),
    ...(entity.transportEquipmentId  !== undefined && { transport_equipment_id:  entity.transportEquipmentId }),
    ...(entity.weight                !== undefined && { weight:                  entity.weight }),
  };
}

/** 특정 레이아웃의 구간 연결 목록 조회 (경로 그래프 전체 로드) */
export function useTransferRelationsByLayout(layoutId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'by_layout', layoutId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_transfer_relation')
        .select('*')
        .eq('layout_id', layoutId);
      if (error) throw error;
      return (data ?? []).map(toEntity);
    },
    enabled: !!layoutId,
  });
}

/** 구간 연결 단건 조회 */
export function useTransferRelation(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_transfer_relation')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    enabled: !!id,
  });
}

/** 구간 연결 생성 */
export function useCreateTransferRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (relation: Omit<TransferRelation, 'id' | 'createdAt'>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_transfer_relation')
        .insert(toRow(relation))
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

/** 구간 연결 수정 (가중치 변경 등) */
export function useUpdateTransferRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<TransferRelation> & { id: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_transfer_relation')
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

/** 구간 연결 삭제 */
export function useDeleteTransferRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, layoutId }: { id: string; layoutId: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('mcs_transfer_relation')
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

/** 레이아웃의 구간 연결 일괄 교체 (레이아웃 저장 시 사용) */
export function useReplaceTransferRelations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      layoutId,
      relations,
    }: {
      layoutId: string;
      relations: Array<Omit<TransferRelation, 'id' | 'createdAt'>>;
    }) => {
      const supabase = createClient();
      // 기존 구간 전체 삭제 후 재삽입
      const { error: delError } = await supabase
        .from('mcs_transfer_relation')
        .delete()
        .eq('layout_id', layoutId);
      if (delError) throw delError;

      if (relations.length === 0) return [];

      const { data, error } = await supabase
        .from('mcs_transfer_relation')
        .insert(relations.map(toRow))
        .select();
      if (error) throw error;
      return (data ?? []).map(toEntity);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'by_layout', vars.layoutId] });
    },
  });
}
