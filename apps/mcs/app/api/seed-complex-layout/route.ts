import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { syncLayoutToDb } from '@/lib/api/sync-layout-to-db';
import { COMPLEX_NODES, COMPLEX_EDGES } from '@/lib/dummy/complex-layout';

/**
 * POST /api/seed-complex-layout
 *
 * A* / PPO 강화학습 테스트용 복잡한 Fab Bay 레이아웃을 DB에 삽입한다.
 * "Complex Fab Layout" 이름의 기존 레이아웃을 모두 삭제한 뒤 새로 생성한다.
 *
 * 구성:
 *  - Stocker × 2, Process × 6 (각 포트 2개)
 *  - Path Node × 46 (바이패스 대각선 교차 포함)
 *  - Charge × 2, AGV × 2
 *  - Transfer Edge: 양방향 ~110개 (분기점 16개+)
 */
export async function POST() {
  try {
    const supabase = createAdminClient();

    // 기존 "Complex Fab Layout" 전체 삭제 (중복 방지)
    const { data: existing } = await supabase
      .from('mcs_layout')
      .select('id')
      .eq('design_name', 'Complex Fab Layout');

    if (existing && existing.length > 0) {
      const ids = existing.map((r: { id: string }) => r.id);
      // transfer_relation → equipment_unit → equipment 순으로 cascade 삭제
      await supabase.from('mcs_transfer_relation').delete().in('layout_id', ids);
      await supabase.from('mcs_equipment_unit').delete().in('equipment_id',
        (await supabase.from('mcs_equipment').select('id').in('layout_id', ids)).data?.map((r: { id: string }) => r.id) ?? []
      );
      await supabase.from('mcs_equipment').delete().in('layout_id', ids);
      await supabase.from('mcs_layout').delete().in('id', ids);
    }

    const jsonData = {
      nodes:    COMPLEX_NODES,
      edges:    COMPLEX_EDGES,
      viewport: { x: 0, y: 0, zoom: 0.6 },
    };

    // 신규 삽입
    const { data: inserted, error: insertErr } = await supabase
      .from('mcs_layout')
      .insert({
        design_id:   'LAYOUT-COMPLEX',
        design_name: 'Complex Fab Layout',
        version:     1,
        json_data:   jsonData,
        site_id:     'SITE-001',
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;

    const layoutId = inserted.id;

    // 구조화 테이블(equipment / unit / transfer_relation) 동기화
    // RLS 우회를 위해 service_role 클라이언트를 명시적으로 전달
    await syncLayoutToDb(layoutId, COMPLEX_NODES, COMPLEX_EDGES, supabase);

    return NextResponse.json({
      ok:       true,
      layoutId,
      message:  `Complex Fab Layout 생성 완료 (id: ${layoutId})`,
      stats: {
        nodes:     COMPLEX_NODES.length,
        edges:     COMPLEX_EDGES.length,
      },
    });
  } catch (err: unknown) {
    console.error('[api/seed-complex-layout]', err);
    // Supabase PostgrestError 는 { message, code, details, hint } 구조
    const isObj = err !== null && typeof err === 'object';
    const message = isObj && 'message' in err ? String((err as Record<string, unknown>).message)
                  : err instanceof Error      ? err.message
                  : '시드 생성 실패';
    const detail  = isObj ? JSON.stringify(err) : String(err);
    return NextResponse.json({ error: message, detail }, { status: 500 });
  }
}
