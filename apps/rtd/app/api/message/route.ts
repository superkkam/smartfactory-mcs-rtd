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

  // ── 메시지 유형별 처리 ────────────────────────────────────────
  switch (messageType) {

    // MES → RTD: Lot 반출 요청
    case 'LOAD_REQUEST': {
      const body = msg.body as LoadRequestBody;
      console.log(`[RTD] LOAD_REQUEST 수신 | eq=${body.equipmentId} event=${body.eventType}`);

      // TODO: 룰 그룹 실행 엔진 연동 (RTD 실행 로직)
      // 현재는 수신 확인 응답만 반환

      const ack = createMessage<DispatchAcknowledgeBody>(
        'DISPATCH_ACKNOWLEDGE', 'RTD', 'MES',
        {
          status: 'ACCEPTED',
          ruleGroupId: '',         // TODO: RuleObject 매핑 후 실제 groupId 채우기
          selectedLotId: null,
          destEquipmentId: null,
          reason: null,
        },
        { siteId, correlationId }
      );

      // MES에 응답 전송 (URL 미설정 시 단독 모드 → skip)
      await sendMessage(process.env.MES_API_URL, ack);

      return NextResponse.json(ack, { status: 200 });
    }

    // MES → RTD: Lot 투입 요청
    case 'UNLOAD_REQUEST': {
      const body = msg.body as UnloadRequestBody;
      console.log(`[RTD] UNLOAD_REQUEST 수신 | eq=${body.equipmentId} event=${body.eventType}`);

      const ack = createMessage<DispatchAcknowledgeBody>(
        'DISPATCH_ACKNOWLEDGE', 'RTD', 'MES',
        {
          status: 'ACCEPTED',
          ruleGroupId: '',
          selectedLotId: null,
          destEquipmentId: null,
          reason: null,
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

      const ack = createMessage<DispatchAcknowledgeBody>(
        'DISPATCH_ACKNOWLEDGE', 'RTD', 'MES',
        {
          status: 'ACCEPTED',
          ruleGroupId: '',
          selectedLotId: body.lotId,
          destEquipmentId: body.destEquipmentId,
          reason: null,
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

      // TODO: rule_running_result 저장, 다음 디스패칭 트리거 (triggerNextDispatch=true 시)

      return NextResponse.json({ received: true }, { status: 200 });
    }

    // MCS → RTD: 반송 실패
    case 'TRANSPORT_FAILED': {
      const body = msg.body as TransportFailedBody;
      console.log(`[RTD] TRANSPORT_FAILED 수신 | lot=${body.lotId} reason=${body.failureReason}`);

      // TODO: 재시도 로직 (retryable=true 시)

      return NextResponse.json({ received: true }, { status: 200 });
    }

    default:
      return NextResponse.json(
        { error: `RTD가 처리할 수 없는 messageType: ${messageType}` },
        { status: 422 }
      );
  }
}
