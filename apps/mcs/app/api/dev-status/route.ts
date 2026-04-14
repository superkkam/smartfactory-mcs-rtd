/**
 * 개발용 임시 상태 조회 엔드포인트
 * TODO: 개발 완료 후 삭제
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const { data: macros } = await supabase
    .from('mcs_macro_command')
    .select('id, command_id, state, carrier_id, source_unit_id, dest_unit_id')
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: micros } = await supabase
    .from('mcs_micro_command')
    .select('id, sequence, state, departure_unit_id, arrival_unit_id, macro_command_id')
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: carriers } = await supabase
    .from('mcs_carrier')
    .select('id, carrier_id, state, location_id, current_equipment_id')
    .order('carrier_id');

  const { data: equipment } = await supabase
    .from('mcs_equipment')
    .select('id, equipment_id, location_id, state');

  return NextResponse.json({ macros, micros, carriers, equipment });
}
