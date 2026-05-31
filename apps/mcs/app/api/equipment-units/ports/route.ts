import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/equipment-units/ports
 * RTD 매핑 UI에서 사용 — 최신 레이아웃 기준 Port 타입 유닛 목록 반환
 * 서버 간 호출 → RLS 우회를 위해 서비스 롤 클라이언트 사용
 */
export async function GET() {
  const supabase = createAdminClient();

  // 최신 레이아웃 조회
  const { data: latestLayout, error: layoutErr } = await supabase
    .from('mcs_layout')
    .select('id, design_name, version')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (layoutErr || !latestLayout) {
    return NextResponse.json({ error: '레이아웃 없음' }, { status: 404 });
  }

  // 해당 레이아웃의 장비 ID 목록
  const { data: equipments, error: eqErr } = await supabase
    .from('mcs_equipment')
    .select('id, equipment_id')
    .eq('layout_id', latestLayout.id);

  if (eqErr) return NextResponse.json({ error: eqErr.message }, { status: 500 });
  if (!equipments || equipments.length === 0) {
    return NextResponse.json([]);
  }

  const equipmentDbIds = equipments.map((e) => e.id);
  const equipmentMap = Object.fromEntries(equipments.map((e) => [e.id, e.equipment_id]));

  // Port 타입 유닛만 조회
  const { data: ports, error: portErr } = await supabase
    .from('mcs_equipment_unit')
    .select('id, equipment_unit_id, equipment_id, in_out_mode')
    .in('equipment_id', equipmentDbIds)
    .eq('unit_type', 'Port')
    .order('equipment_unit_id');

  if (portErr) return NextResponse.json({ error: portErr.message }, { status: 500 });

  const result = (ports ?? []).map((p) => ({
    unitId:      p.equipment_unit_id as string,
    label:       `${equipmentMap[p.equipment_id as string] ?? p.equipment_id} > ${p.equipment_unit_id} (${p.in_out_mode})`,
    equipmentId: equipmentMap[p.equipment_id as string] ?? (p.equipment_id as string),
    inOutMode:   p.in_out_mode as string,
  }));

  return NextResponse.json(result);
}
