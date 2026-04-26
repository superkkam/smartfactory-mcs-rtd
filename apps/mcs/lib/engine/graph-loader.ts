import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import type { GraphNode } from './types';

/**
 * Supabase에서 특정 레이아웃의 전이 관계를 로드하여 A* 그래프 구성
 *
 * mcs_transfer_relation: departure_unit_id → arrival_unit_id, weight
 * mcs_equipment_unit:    id, equipment_unit_id (표시용 라벨)
 *
 * 전이 관계가 없으면 레이아웃 JSON에서 직접 복구 후 DB에 자동 저장.
 *
 * @returns unitId(DB uuid) → GraphNode 맵
 */
export async function loadGraph(layoutId: string): Promise<Map<string, GraphNode>> {
  // RLS 우회: API 라우트에서 세션 없이 호출되므로 service_role 클라이언트 사용
  const supabase = createAdminClient();

  // 전이 관계 전체 로드
  const { data: relations, error: relErr } = await supabase
    .from('mcs_transfer_relation')
    .select('departure_unit_id, arrival_unit_id, weight')
    .eq('layout_id', layoutId);
  if (relErr) throw relErr;

  // 전이 관계가 없으면 레이아웃 JSON에서 복구 시도
  const effectiveRelations = (relations && relations.length > 0)
    ? relations
    : await recoverRelationsFromJson(layoutId, supabase);

  if (!effectiveRelations || effectiveRelations.length === 0) {
    throw new Error(`레이아웃(${layoutId})에 전이 관계가 없습니다. 레이아웃 모델러에서 저장 후 사용하세요.`);
  }

  // 관련 유닛 ID 수집
  const unitIds = Array.from(
    new Set(effectiveRelations.flatMap((r) => [r.departure_unit_id, r.arrival_unit_id]))
  );

  // 유닛 표시용 라벨 로드
  const { data: units, error: unitErr } = await supabase
    .from('mcs_equipment_unit')
    .select('id, equipment_unit_id')
    .in('id', unitIds);
  if (unitErr) throw unitErr;

  const unitLabelMap = new Map<string, string>();
  (units ?? []).forEach((u) => unitLabelMap.set(u.id, u.equipment_unit_id));

  // 그래프 맵 구성
  const graph = new Map<string, GraphNode>();

  // 모든 유닛 노드 초기화
  for (const unitId of unitIds) {
    graph.set(unitId, {
      id:        unitId,
      unitId:    unitLabelMap.get(unitId) ?? unitId,
      neighbors: [],
    });
  }

  // 엣지 추가 (방향 그래프)
  for (const rel of effectiveRelations) {
    const node = graph.get(rel.departure_unit_id);
    if (node) {
      node.neighbors.push({
        toUnitId: rel.arrival_unit_id,
        weight:   Number(rel.weight),
      });
    }
  }

  return graph;
}

/** 레이아웃 JSON에서 전이 관계를 재구성하여 DB에 자동 복구 삽입 후 반환 */
async function recoverRelationsFromJson(
  layoutId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<Array<{ departure_unit_id: string; arrival_unit_id: string; weight: number }>> {
  console.warn(`[graph-loader] 전이 관계 없음 → JSON 폴백 복구 시도 (layoutId=${layoutId})`);

  // 레이아웃 JSON 조회
  const { data: layout } = await supabase
    .from('mcs_layout')
    .select('json_data')
    .eq('id', layoutId)
    .maybeSingle();
  if (!layout?.json_data) return [];

  const jsonData = layout.json_data as { nodes?: unknown[]; edges?: unknown[] };
  const nodes = (jsonData.nodes ?? []) as Array<{ id: string; type?: string; data?: Record<string, unknown> }>;
  const edges = (jsonData.edges ?? []) as Array<{ source: string; target: string; type?: string; data?: Record<string, unknown> }>;

  // 레이아웃의 모든 유닛 조회 (equipment_unit_id → DB uuid 매핑용)
  const { data: equipments } = await supabase
    .from('mcs_equipment')
    .select('id')
    .eq('layout_id', layoutId);
  const equipmentIds = (equipments ?? []).map((e: { id: string }) => e.id);
  if (equipmentIds.length === 0) return [];

  const { data: units } = await supabase
    .from('mcs_equipment_unit')
    .select('id, equipment_unit_id')
    .in('equipment_id', equipmentIds);

  const unitsByCode = new Map<string, string>();
  (units ?? []).forEach((u: { id: string; equipment_unit_id: string }) => {
    unitsByCode.set(u.equipment_unit_id, u.id);
  });

  // React Flow node.id → unit DB uuid 매핑
  const rfToUnitId = new Map<string, string>();
  for (const node of nodes) {
    const { id: rfId, type: nodeType, data = {} } = node;
    let unitCode: string | undefined;
    if (nodeType === 'port') {
      unitCode = ((data.portId as string | undefined) ?? '').trim() || rfId;
    } else if (nodeType === 'node' || nodeType === 'charge') {
      unitCode = ((data.nodeId as string | undefined) ?? '').trim() || rfId;
    } else {
      continue;
    }
    const dbId = unitsByCode.get(unitCode);
    if (dbId) rfToUnitId.set(rfId, dbId);
  }

  // transfer 엣지 → 전이 관계 목록
  const relations: Array<{ layout_id: string; departure_unit_id: string; arrival_unit_id: string; weight: number }> = [];
  for (const edge of edges) {
    if (edge.type !== 'transfer') continue;
    const depId = rfToUnitId.get(edge.source);
    const arrId = rfToUnitId.get(edge.target);
    if (!depId || !arrId) continue;
    const weight = Number((edge.data?.weight as number | undefined) ?? 1.0);
    relations.push({ layout_id: layoutId, departure_unit_id: depId, arrival_unit_id: arrId, weight });
  }

  if (relations.length === 0) {
    console.warn(`[graph-loader] JSON 폴백에서도 전이 관계를 찾을 수 없음 (엣지 수: ${edges.length})`);
    return [];
  }

  // DB에 자동 복구 삽입 (이후 호출 시 폴백 없이 바로 로드)
  try {
    await supabase.from('mcs_transfer_relation').insert(relations);
    console.info(`[graph-loader] 전이 관계 ${relations.length}건 자동 복구 완료`);
  } catch (e) {
    console.warn('[graph-loader] 자동 복구 삽입 실패 (무시):', e);
  }

  return relations.map(({ departure_unit_id, arrival_unit_id, weight }) => ({
    departure_unit_id,
    arrival_unit_id,
    weight,
  }));
}
