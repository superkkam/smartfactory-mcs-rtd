/**
 * ACS — 시나리오 시더 (임시 RTD 역할)
 *
 * 실제 RTD → Task 022 에서 구현.
 * 현재는 샘플 시나리오를 수동 insert 하는 버튼용 함수만 제공.
 *
 * 시나리오:
 *   1. 활성 레이아웃에서 Port 타입 유닛 2개를 선택 (source, dest)
 *   2. mcs_macro_command 1건 + mcs_micro_command N건 insert
 *   3. ACS tick loop 이 자동으로 pick up 하여 AMR 에게 할당
 */

import { createClient } from '@/lib/supabase/client';
import type { EquipmentUnit } from '@workspace/types/mcs';

/**
 * 샘플 반송 시나리오를 DB 에 insert 한다.
 *
 * @param carrierId   - mcs_carrier.id (uuid)
 * @param sourceUnit  - 출발 유닛 (Port)
 * @param destUnit    - 목적지 유닛 (Port)
 * @param path        - 출발 → 목적지 경로 (EquipmentUnit.id 배열, BFS 결과)
 * @returns 생성된 macro_command.id
 */
export async function seedTransferScenario(
  carrierId: string,
  sourceUnit: EquipmentUnit,
  destUnit: EquipmentUnit,
  path: string[],
): Promise<string> {
  const supabase = createClient();

  // 1. MacroCommand 생성 (command_id: NOT NULL UNIQUE 이므로 고유값 자동 생성)
  const commandId = `CMD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { data: macro, error: macroErr } = await supabase
    .from('mcs_macro_command')
    .insert({
      command_id:      commandId,
      carrier_id:      carrierId,
      source_unit_id:  sourceUnit.id,
      dest_unit_id:    destUnit.id,
      state:           'Pending',
      priority:        50,
    })
    .select('id')
    .single();

  if (macroErr || !macro) throw macroErr ?? new Error('macro command 생성 실패');

  // 2. path 를 구간(departure→arrival) 쌍으로 분해 → MicroCommand 일괄 insert
  if (path.length < 2) {
    throw new Error(`경로가 너무 짧습니다: ${path.join(' → ')}`);
  }

  const microCommands = path.slice(0, -1).map((fromUnitId, idx) => ({
    macro_command_id:  macro.id,
    sequence:          idx + 1,
    departure_unit_id: fromUnitId,
    arrival_unit_id:   path[idx + 1],
    state:             'Pending',
  }));

  const { error: microErr } = await supabase
    .from('mcs_micro_command')
    .insert(microCommands);

  if (microErr) throw microErr;

  return macro.id;
}
