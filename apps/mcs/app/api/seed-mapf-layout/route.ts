import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { syncLayoutToDb } from '@/lib/api/sync-layout-to-db';
import { MAPF_NODES, MAPF_EDGES, MAPF_META } from '@/lib/dummy/mapf-layout';

/**
 * POST /api/seed-mapf-layout
 *
 * CACTUS / CBS-TS MAPF 알고리즘 테스트용 8×8 그리드 레이아웃을 DB에 삽입한다.
 * 기존 동일 이름 레이아웃을 삭제 후 재생성(멱등 처리).
 */
export async function POST() {
  try {
    const supabase = createAdminClient();

    // 기존 동일 이름 레이아웃 삭제
    const { data: existing } = await supabase
      .from('mcs_layout')
      .select('id')
      .eq('design_name', MAPF_META.designName);

    if (existing && existing.length > 0) {
      const ids = existing.map((r: { id: string }) => r.id);
      await supabase.from('mcs_transfer_relation').delete().in('layout_id', ids);
      const { data: eqpRows } = await supabase.from('mcs_equipment').select('id').in('layout_id', ids);
      if (eqpRows && eqpRows.length > 0) {
        await supabase.from('mcs_equipment_unit').delete().in('equipment_id', eqpRows.map((r: { id: string }) => r.id));
      }
      await supabase.from('mcs_equipment').delete().in('layout_id', ids);
      await supabase.from('mcs_layout').delete().in('id', ids);
    }

    const jsonData = {
      nodes:    MAPF_NODES,
      edges:    MAPF_EDGES,
      viewport: { x: 0, y: 0, zoom: 0.5 },
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('mcs_layout')
      .insert({
        design_id:   MAPF_META.designId,
        design_name: MAPF_META.designName,
        version:     1,
        json_data:   jsonData,
        site_id:     'SITE-001',
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;

    const layoutId = inserted.id;

    const { droppedEdgeCount, orphanPortCount } = await syncLayoutToDb(layoutId, MAPF_NODES, MAPF_EDGES, supabase);

    return NextResponse.json({
      ok:       true,
      layoutId,
      message:  `${MAPF_META.designName} 생성 완료 (id: ${layoutId})`,
      stats: {
        nodes:        MAPF_NODES.length,
        edges:        MAPF_EDGES.length,
        droppedEdges: droppedEdgeCount,
        orphanPorts:  orphanPortCount,
        meta:         MAPF_META,
      },
    });
  } catch (err: unknown) {
    console.error('[api/seed-mapf-layout]', err);
    const isObj = err !== null && typeof err === 'object';
    const message = isObj && 'message' in err ? String((err as Record<string, unknown>).message)
                  : err instanceof Error      ? err.message
                  : '시드 생성 실패';
    const detail  = isObj ? JSON.stringify(err) : String(err);
    return NextResponse.json({ error: message, detail }, { status: 500 });
  }
}
