import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { syncLayoutToDb } from '@/lib/api/sync-layout-to-db';
import type { Node, Edge } from '@xyflow/react';

/**
 * POST /api/layouts/sync
 *
 * 저장된 레이아웃 JSON으로 구조화 테이블(mcs_equipment/unit/transfer_relation) 재동기화.
 * AI 추론 오류 "전이 관계가 없습니다" 해결 용도.
 * RLS 우회 필요 → createAdminClient() 사용.
 *
 * Body: { layoutId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { layoutId } = (await req.json()) as { layoutId?: string };
    if (!layoutId) {
      return NextResponse.json({ error: 'layoutId 필수' }, { status: 400 });
    }

    // service_role 클라이언트 — DELETE/INSERT에 RLS 미적용
    const supabase = createAdminClient();

    // 레이아웃 JSON 조회
    const { data: layout, error: layoutErr } = await supabase
      .from('mcs_layout')
      .select('json_data')
      .eq('id', layoutId)
      .maybeSingle();
    if (layoutErr) throw layoutErr;
    if (!layout?.json_data) {
      return NextResponse.json({ error: '레이아웃을 찾을 수 없습니다.' }, { status: 404 });
    }

    const json = layout.json_data as { nodes?: Node[]; edges?: Edge[] };
    const nodes = json.nodes ?? [];
    const edges = json.edges ?? [];

    // supabase 인스턴스를 명시적으로 전달해 syncLayoutToDb 내부에서 anon client 생성 방지
    await syncLayoutToDb(layoutId, nodes, edges, supabase);

    return NextResponse.json({ ok: true, message: `레이아웃(${layoutId}) 재동기화 완료` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '재동기화 실패';
    console.error('[api/layouts/sync]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
