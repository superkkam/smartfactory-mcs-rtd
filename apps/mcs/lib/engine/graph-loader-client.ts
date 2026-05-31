'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { GraphNode } from './types';

/**
 * 클라이언트(브라우저)에서 graph를 로드하는 버전.
 * next/headers 미사용 — tick-loop 등 클라이언트 컴포넌트에서 호출 가능.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadGraphClient(
  layoutId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  injectedClient?: SupabaseClient<any>,
): Promise<Map<string, GraphNode>> {
  const supabase = injectedClient ?? createClient();

  const { data: relations, error: relErr } = await supabase
    .from('mcs_transfer_relation')
    .select('departure_unit_id, arrival_unit_id, weight')
    .eq('layout_id', layoutId);
  if (relErr) throw relErr;

  if (!relations || relations.length === 0) {
    throw new Error(`레이아웃(${layoutId})에 전이 관계가 없습니다.`);
  }

  const unitIds = Array.from(
    new Set(relations.flatMap((r) => [r.departure_unit_id, r.arrival_unit_id]))
  );

  const { data: units, error: unitErr } = await supabase
    .from('mcs_equipment_unit')
    .select('id, equipment_unit_id')
    .in('id', unitIds);
  if (unitErr) throw unitErr;

  const unitLabelMap = new Map<string, string>();
  (units ?? []).forEach((u) => unitLabelMap.set(u.id, u.equipment_unit_id));

  const graph = new Map<string, GraphNode>();
  for (const unitId of unitIds) {
    graph.set(unitId, { id: unitId, unitId: unitLabelMap.get(unitId) ?? unitId, neighbors: [] });
  }
  for (const rel of relations) {
    const node = graph.get(rel.departure_unit_id);
    if (node) node.neighbors.push({ toUnitId: rel.arrival_unit_id, weight: Number(rel.weight) });
  }

  return graph;
}
