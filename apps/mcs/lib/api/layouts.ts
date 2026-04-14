import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Layout } from '@workspace/types/mcs';

const QUERY_KEY = 'mcs_layout';

/** DB row → TypeScript 타입 변환 */
function toEntity(row: Record<string, unknown>): Layout {
  return {
    id:         row.id as string,
    designId:   row.design_id as string,
    designName: row.design_name as string,
    version:    row.version as number,
    jsonData:   row.json_data as Record<string, unknown>,
    siteId:     row.site_id as string,
    createdAt:  row.created_at as string,
  };
}

/** TypeScript 타입 → DB row 변환 */
function toRow(entity: Partial<Layout>) {
  return {
    ...(entity.designId   !== undefined && { design_id:   entity.designId }),
    ...(entity.designName !== undefined && { design_name: entity.designName }),
    ...(entity.version    !== undefined && { version:     entity.version }),
    ...(entity.jsonData   !== undefined && { json_data:   entity.jsonData }),
    ...(entity.siteId     !== undefined && { site_id:     entity.siteId }),
  };
}

/** 레이아웃 목록 조회 */
export function useLayouts() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_layout')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toEntity);
    },
  });
}

/** 레이아웃 단건 조회 */
export function useLayout(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_layout')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    enabled: !!id,
  });
}

/** 레이아웃 생성 */
export function useCreateLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (layout: Omit<Layout, 'id' | 'createdAt'>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_layout')
        .insert(toRow(layout))
        .select()
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

/** 레이아웃 수정 */
export function useUpdateLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<Layout> & { id: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mcs_layout')
        .update(toRow(rest))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return toEntity(data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, vars.id] });
    },
  });
}

/** 레이아웃 삭제 */
export function useDeleteLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('mcs_layout')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
