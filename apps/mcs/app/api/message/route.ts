import { NextRequest, NextResponse } from 'next/server';
import type {
  AnyMessage,
  DispatchResultBody,
} from '@workspace/types/messages';
import { createClient } from '@/lib/supabase/server';

/**
 * MCS 메시지 수신 엔드포인트
 * POST /api/message
 *
 * 수신 가능한 메시지 (RTD → MCS):
 * - DISPATCH_RESULT: 디스패칭 결과 수신 → MacroCommand 자동 생성
 */
export async function POST(request: NextRequest) {
  let msg: AnyMessage | null;

  try {
    msg = (await request.json()) as AnyMessage;
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 형식' }, { status: 400 });
  }

  if (!msg?.header?.messageType) {
    return NextResponse.json(
      { error: 'header.messageType 필드 누락' },
      { status: 400 },
    );
  }

  const { messageType, correlationId } = msg.header;
  const supabase = await createClient();

  switch (messageType) {
    // RTD → MCS: 디스패칭 결과 수신
    case 'DISPATCH_RESULT': {
      const body = msg.body as DispatchResultBody;
      console.log(
        `[MCS] DISPATCH_RESULT 수신 | ruleGroup=${body.ruleGroupId} lots=${body.lots.length}`,
      );

      const created: string[] = [];

      for (const lot of body.lots) {
        // 캐리어 조회 (carrierId 직접 또는 lot_id 검색)
        let carrierId = lot.carrierId ?? null;

        if (!carrierId && lot.lotId) {
          const { data: carrier } = await supabase
            .from('mcs_carrier')
            .select('id')
            .eq('lot_id', lot.lotId)
            .maybeSingle();
          carrierId = carrier?.id ?? null;
        }

        // 출발지/목적지 유닛 ID 조회 (label → DB UUID)
        const { data: srcUnit } = await supabase
          .from('mcs_equipment_unit')
          .select('id')
          .or(`unit_id.eq.${lot.sourceUnitId},id.eq.${lot.sourceUnitId}`)
          .maybeSingle();

        const { data: dstUnit } = await supabase
          .from('mcs_equipment_unit')
          .select('id')
          .or(`unit_id.eq.${lot.destUnitId},id.eq.${lot.destUnitId}`)
          .maybeSingle();

        if (!srcUnit?.id || !dstUnit?.id) {
          console.warn(
            `[MCS] DISPATCH_RESULT 유닛 조회 실패 | src=${lot.sourceUnitId} dst=${lot.destUnitId}`,
          );
          continue;
        }

        // MacroCommand 생성
        const commandId = `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        const { data: cmd, error } = await supabase
          .from('mcs_macro_command')
          .insert({
            command_id:    commandId,
            carrier_id:    carrierId,
            source_unit_id: srcUnit.id,
            dest_unit_id:  dstUnit.id,
            state:         'Pending',
            priority:      lot.priority ?? 50,
          })
          .select('id')
          .single();

        if (error) {
          console.error('[MCS] MacroCommand 생성 실패', error.message);
          continue;
        }

        created.push(cmd.id);
        console.log(
          `[MCS] MacroCommand 생성 완료 | id=${cmd.id} cmd=${commandId}`,
        );
      }

      return NextResponse.json(
        {
          received:     true,
          correlationId,
          createdCount: created.length,
          commandIds:   created,
        },
        { status: 201 },
      );
    }

    default:
      return NextResponse.json(
        { error: `MCS가 처리할 수 없는 messageType: ${messageType}` },
        { status: 422 },
      );
  }
}
