import { NextRequest, NextResponse } from 'next/server';
import { createMessage, sendMessage } from '@workspace/types/message-client';
import type { LoadRequestBody } from '@workspace/types/messages';

// POST /api/rtd/trigger: MES 역할 시뮬레이션 — RTD 에 LOAD_REQUEST 송신 (수동 트리거)
export async function POST(req: NextRequest) {
  let body: { equipmentId: string; eventType?: string };
  try {
    body = await req.json() as { equipmentId: string; eventType?: string };
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 });
  }

  if (!body.equipmentId) {
    return NextResponse.json({ error: 'equipmentId 필수' }, { status: 400 });
  }

  const rtdUrl = process.env.RTD_API_URL;
  if (!rtdUrl) {
    return NextResponse.json({ error: 'RTD_API_URL 미설정' }, { status: 503 });
  }

  const loadRequest = createMessage<LoadRequestBody>(
    'LOAD_REQUEST',
    'MES',
    'RTD',
    {
      eventType:   (body.eventType as LoadRequestBody['eventType']) ?? 'EVT_FULL',
      equipmentId: body.equipmentId,
    },
  );

  const result = await sendMessage(rtdUrl, loadRequest);

  return NextResponse.json(
    { ok: result.ok, status: result.status, error: result.error, ack: result.data },
    { status: result.ok ? 200 : 502 },
  );
}
