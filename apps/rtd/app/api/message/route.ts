import { NextRequest, NextResponse } from 'next/server';
import {
  type AnyMessage,
  type LoadRequestBody,
  type UnloadRequestBody,
  type TransferRequestBody,
  type TransportCompleteBody,
  type TransportFailedBody,
  type DispatchAcknowledgeBody,
} from '@workspace/types/messages';
import { createMessage, sendMessage } from '@workspace/types/message-client';
import { createClient } from '@/lib/supabase/server';
import { runRuleEngine } from '@/lib/rule-engine/engine';

/**
 * RTD 메시지 수신 엔드포인트
 * POST /api/message
 *
 * 수신 가능한 메시지:
 * - LOAD_REQUEST    (MES → RTD)
 * - UNLOAD_REQUEST  (MES → RTD)
 * - TRANSFER_REQUEST(MES → RTD)
 * - TRANSPORT_COMPLETE (MCS → RTD)
 * - TRANSPORT_FAILED   (MCS → RTD)
 */
export async function POST(request: NextRequest) {
  let msg: AnyMessage | null;

  try {
    msg = await request.json() as AnyMessage;
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 형식' }, { status: 400 });
  }

  if (!msg?.header?.messageType) {
    return NextResponse.json({ error: 'header.messageType 필드 누락' }, { status: 400 });
  }

  const { messageType, correlationId, siteId } = msg.header;
  const supabase = await createClient();

  // ── 메시지 유형별 처리 ────────────────────────────────────────
  switch (messageType) {

    // MES → RTD: Lot 반출 요청
    case 'LOAD_REQUEST': {
      const body = msg.body as LoadRequestBody;
      console.log(`[RTD] LOAD_REQUEST 수신 | eq=${body.equipmentId} event=${body.eventType}`);

      // 설비 ID + 이벤트 유형으로 매핑된 룰 그룹 조회
      const engineResult = await dispatchByEquipmentEvent(supabase, {
        equipmentId: body.equipmentId,
        eventType:   body.eventType,
      });

      const ack = createMessage<DispatchAcknowledgeBody>(
        'DISPATCH_ACKNOWLEDGE', 'RTD', 'MES',
        {
          status:          engineResult.success ? 'ACCEPTED' : 'REJECTED',
          ruleGroupId:     engineResult.ruleGroupId,
          selectedLotId:   engineResult.selectedLotId,
          destEquipmentId: engineResult.destEquipmentId,
          reason:          engineResult.reason ?? null,
        },
        { siteId, correlationId }
      );

      await sendMessage(process.env.MES_API_URL, ack);
      return NextResponse.json(ack, { status: 200 });
    }

    // MES → RTD: Lot 투입 요청
    case 'UNLOAD_REQUEST': {
      const body = msg.body as UnloadRequestBody;
      console.log(`[RTD] UNLOAD_REQUEST 수신 | eq=${body.equipmentId} event=${body.eventType}`);

      const engineResult = await dispatchByEquipmentEvent(supabase, {
        equipmentId: body.equipmentId,
        eventType:   body.eventType,
      });

      const ack = createMessage<DispatchAcknowledgeBody>(
        'DISPATCH_ACKNOWLEDGE', 'RTD', 'MES',
        {
          status:          engineResult.success ? 'ACCEPTED' : 'REJECTED',
          ruleGroupId:     engineResult.ruleGroupId,
          selectedLotId:   engineResult.selectedLotId,
          destEquipmentId: engineResult.destEquipmentId,
          reason:          engineResult.reason ?? null,
        },
        { siteId, correlationId }
      );

      await sendMessage(process.env.MES_API_URL, ack);
      return NextResponse.json(ack, { status: 200 });
    }

    // MES → RTD: 특정 Lot 강제 이동
    case 'TRANSFER_REQUEST': {
      const body = msg.body as TransferRequestBody;
      console.log(`[RTD] TRANSFER_REQUEST 수신 | lot=${body.lotId} event=${body.eventType}`);

      // TRANSFER_REQUEST 는 destEquipmentId 가 MES 에서 직접 지정됨
      // 룰 엔진은 경로 검증/우선순위 정렬만 담당
      const engineResult = await dispatchByEquipmentEvent(supabase, {
        equipmentId:     body.sourceEquipmentId ?? '',
        eventType:       body.eventType,
        lotId:           body.lotId,
        carrierId:       body.carrierId,
        overrideDest:    body.destEquipmentId,
      });

      const ack = createMessage<DispatchAcknowledgeBody>(
        'DISPATCH_ACKNOWLEDGE', 'RTD', 'MES',
        {
          status:          engineResult.success ? 'ACCEPTED' : 'REJECTED',
          ruleGroupId:     engineResult.ruleGroupId,
          selectedLotId:   body.lotId,
          destEquipmentId: body.destEquipmentId,  // MES 지정 목적지 우선
          reason:          engineResult.reason ?? null,
        },
        { siteId, correlationId }
      );

      await sendMessage(process.env.MES_API_URL, ack);
      return NextResponse.json(ack, { status: 200 });
    }

    // MCS → RTD: 반송 완료
    case 'TRANSPORT_COMPLETE': {
      const body = msg.body as TransportCompleteBody;
      console.log(`[RTD] TRANSPORT_COMPLETE 수신 | lot=${body.lotId} cmd=${body.commandId}`);

      // rule_running_result 의 완료 시각 갱신
      const now = new Date().toISOString();
      if (body.lotId) {
        await supabase
          .from('rule_running_result')
          .update({ end_time: now, is_dispatching: 'Y' })
          .eq('lot_id', body.lotId)
          .is('end_time', null);
      }

      // triggerNextDispatch=true 이면 다음 디스패칭 이벤트 처리
      // (현재는 수신 확인만 — 연속 디스패칭은 MES 가 다음 LOAD_REQUEST 를 전송)

      return NextResponse.json({ received: true }, { status: 200 });
    }

    // MCS → RTD: 반송 실패
    case 'TRANSPORT_FAILED': {
      const body = msg.body as TransportFailedBody;
      console.log(`[RTD] TRANSPORT_FAILED 수신 | lot=${body.lotId} reason=${body.failureReason}`);

      // retryable=true 면 동일 Lot 에 대해 우선순위를 낮춰 재시도 가능 상태로 표시
      if (body.retryable && body.lotId) {
        // lot_state 를 WAIT 으로 되돌려 다음 디스패칭 사이클에서 재선택 가능하게 함
        await supabase
          .from('mcs_carrier')
          .update({ lot_state: 'WAIT' })
          .eq('lot_id', body.lotId);

        console.log(`[RTD] TRANSPORT_FAILED 재시도 대기 상태로 전환 | lot=${body.lotId}`);
      }

      return NextResponse.json({ received: true }, { status: 200 });
    }

    default:
      return NextResponse.json(
        { error: `RTD가 처리할 수 없는 messageType: ${messageType}` },
        { status: 422 }
      );
  }
}

// ─── 헬퍼: 설비+이벤트 → 룰 그룹 조회 → 엔진 실행 ──────────────

interface DispatchOptions {
  equipmentId: string;
  eventType: string;
  lotId?: string;
  carrierId?: string;
  overrideDest?: string | null;
}

async function dispatchByEquipmentEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: DispatchOptions
) {
  const { equipmentId, eventType, lotId, carrierId } = opts;

  // rule_object 테이블에서 설비 ID + 이벤트 유형 → 룰 그룹 ID 조회
  // Fallback 계층: EQP_FULL(설비전용) → EQP_EMPTY → EQP_COMMON(공통)
  const { data: ruleObjects } = await supabase
    .from('rule_object')
    .select('rule_group_id, is_usable')
    .eq('rule_object_id', equipmentId)
    .eq('rule_event_id', eventType)
    .eq('is_usable', 'Y')
    .order('rule_group_id')
    .limit(1);

  const ruleGroupId = ruleObjects?.[0]?.rule_group_id as string | undefined;

  if (!ruleGroupId) {
    // 매핑 없으면 ACCEPTED 로 패스 (단독 모드 동작)
    return {
      success:         true,
      ruleGroupId:     '',
      selectedLotId:   null,
      destEquipmentId: opts.overrideDest ?? null,
      reason:          '룰 그룹 매핑 없음 — 단독 모드',
    };
  }

  return runRuleEngine(supabase, {
    ruleGroupId,
    equipmentId,
    eventType,
    lotId,
    carrierId,
    dryRun: false,
  });
}
