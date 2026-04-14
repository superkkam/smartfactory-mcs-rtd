/**
 * 개발용 임시 DB 초기화 엔드포인트
 * 오염된 캐리어/명령 상태를 정리
 * TODO: 개발 완료 후 삭제
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  // FOUP-001 을 PORT-002 로 리셋 (테스트용)
  if (body.resetFoup001) {
    const port002UnitId  = '7969e0ec-f70a-4781-be81-cf3f268506fa';
    // PORT-002 유닛의 equipment_id 조회
    const { data: port002Unit } = await supabase
      .from('mcs_equipment_unit')
      .select('id, equipment_id')
      .eq('id', port002UnitId)
      .maybeSingle();

    await supabase
      .from('mcs_carrier')
      .update({
        state: 'Installed',
        location_id: port002UnitId,
        current_equipment_id: port002Unit?.equipment_id ?? null,
      })
      .eq('carrier_id', 'FOUP-001');

    return NextResponse.json({ ok: true, resetFoup001: true, port002Unit });
  }

  // 1. Transferring / InTransfer 캐리어를 Installed 로 리셋 (AGV body 에 걸린 것 포함)
  const { data: stuckCarriers } = await supabase
    .from('mcs_carrier')
    .select('id, carrier_id, state, location_id')
    .in('state', ['Transferring', 'InTransfer']);

  const results: Record<string, unknown>[] = [];

  for (const c of stuckCarriers ?? []) {
    // AGV body 유닛인지 확인 (unit_type = 'AGV')
    const { data: unit } = await supabase
      .from('mcs_equipment_unit')
      .select('id, unit_type, equipment_id')
      .eq('id', c.location_id as string)
      .maybeSingle();

    if (unit?.unit_type === 'AGV') {
      // AGV body 에 걸려있는 캐리어 → location_id 를 null 로 (또는 원래 포트로 보낼 수 없으니 그냥 state만 reset)
      // 일단 Stored 로 만들어 숨겨둠
      await supabase
        .from('mcs_carrier')
        .update({ state: 'Stored', current_equipment_id: null })
        .eq('id', c.id as string);
      results.push({ id: c.id, carrier_id: c.carrier_id, action: 'reset-to-stored' });
    }
  }

  // 2. InProgress macro_command → Pending 리셋 (잘못 중단된 것)
  const { data: macroData } = await supabase
    .from('mcs_macro_command')
    .update({ state: 'Pending' })
    .eq('state', 'InProgress')
    .select('id');
  const macroReset = macroData?.length ?? 0;

  // 3. InProgress micro_command → Pending 리셋
  const { data: microData } = await supabase
    .from('mcs_micro_command')
    .update({ state: 'Pending' })
    .eq('state', 'InProgress')
    .select('id');
  const microReset = microData?.length ?? 0;

  return NextResponse.json({
    ok: true,
    stuckCarriersFixed: results,
    macroCommandsReset: macroReset ?? 0,
    microCommandsReset: microReset ?? 0,
  });
}
