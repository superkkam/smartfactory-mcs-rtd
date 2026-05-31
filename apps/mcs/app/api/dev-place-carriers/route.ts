/**
 * POST /api/dev-place-carriers
 *
 * 가장 최신 레이아웃의 공정 OUT 포트에 기존 캐리어를 1:1로 배치한다.
 * - 캐리어 수 > OUT 포트 수인 경우 포트를 순환 배정
 * - 캐리어 수 <= OUT 포트 수인 경우 1캐리어 1포트
 * 개발/데모용 전용 엔드포인트
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = createAdminClient();

  // 1. 최신 레이아웃 조회
  const { data: layout, error: layoutErr } = await supabase
    .from('mcs_layout')
    .select('id, design_name')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (layoutErr || !layout) {
    return NextResponse.json({ error: '레이아웃 없음' }, { status: 404 });
  }

  // 2. 해당 레이아웃의 Process/Stocker 장비 조회
  const { data: equipment } = await supabase
    .from('mcs_equipment')
    .select('id, equipment_id, equipment_type')
    .eq('layout_id', layout.id)
    .in('equipment_type', ['Process', 'Stocker']);

  if (!equipment || equipment.length === 0) {
    return NextResponse.json({ error: '공정/스토커 장비 없음' }, { status: 404 });
  }

  const equipmentIds = equipment.map((e: { id: string }) => e.id);

  // 3. 공정 OUT 포트 우선, 없으면 BOTH 포트도 포함
  const { data: outPorts } = await supabase
    .from('mcs_equipment_unit')
    .select('id, equipment_unit_id, equipment_id, in_out_mode')
    .in('equipment_id', equipmentIds)
    .eq('unit_type', 'Port')
    .in('in_out_mode', ['Out', 'Both']);

  if (!outPorts || outPorts.length === 0) {
    return NextResponse.json({ error: 'OUT 포트 없음' }, { status: 404 });
  }

  // 공정 OUT 포트 우선 정렬 (Process Out > Stocker Both)
  const equipmentMap = new Map(equipment.map((e: { id: string; equipment_type: string }) => [e.id, e]));
  const sortedPorts = [...outPorts].sort((a, b) => {
    const aType = (equipmentMap.get(a.equipment_id) as { equipment_type: string } | undefined)?.equipment_type ?? '';
    const bType = (equipmentMap.get(b.equipment_id) as { equipment_type: string } | undefined)?.equipment_type ?? '';
    const aScore = aType === 'Process' && a.in_out_mode === 'Out' ? 0
                 : aType === 'Process' ? 1
                 : aType === 'Stocker' ? 2 : 3;
    const bScore = bType === 'Process' && b.in_out_mode === 'Out' ? 0
                 : bType === 'Process' ? 1
                 : bType === 'Stocker' ? 2 : 3;
    return aScore - bScore;
  });

  // 4. 기존 캐리어 조회
  const { data: carriers } = await supabase
    .from('mcs_carrier')
    .select('id, carrier_id')
    .order('carrier_id');

  if (!carriers || carriers.length === 0) {
    return NextResponse.json({ error: '캐리어 없음' }, { status: 404 });
  }

  // 5. 캐리어별 포트 할당 (순환)
  const assignments: Array<{
    carrierId: string;
    portId: string;
    portName: string;
    equipmentDbId: string;
  }> = carriers.map((c: { id: string; carrier_id: string }, i: number) => {
    const port = sortedPorts[i % sortedPorts.length];
    return {
      carrierId: c.id,
      portId: port.id,
      portName: port.equipment_unit_id,
      equipmentDbId: port.equipment_id,
    };
  });

  // 6. 캐리어 location_id + current_equipment_id 업데이트
  const results = await Promise.all(
    assignments.map(({ carrierId, portId, equipmentDbId }) =>
      supabase
        .from('mcs_carrier')
        .update({
          location_id:          portId,
          current_equipment_id: equipmentDbId,
          state:                'Installed',
        })
        .eq('id', carrierId)
    )
  );

  const errors = results.filter((r) => r.error).map((r) => r.error?.message);

  return NextResponse.json({
    ok:      errors.length === 0,
    layout:  layout.design_name,
    placed:  assignments.map((a) => ({
      carrier:  carriers.find((c: { id: string; carrier_id: string }) => c.id === a.carrierId)?.carrier_id,
      port:     a.portName,
    })),
    errors,
  });
}
