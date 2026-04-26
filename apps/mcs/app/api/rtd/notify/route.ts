import { NextRequest, NextResponse } from 'next/server';
import { sendTransportComplete } from '@/lib/api/rtd-client';
import type { TransportCompleteBody } from '@workspace/types/messages';

// POST /api/rtd/notify: tick-loop → RTD TRANSPORT_COMPLETE 프록시 (서버사이드)
export interface NotifyBody extends Omit<TransportCompleteBody, 'status'> {
  correlationId?: string;
}

export async function POST(req: NextRequest) {
  let body: NotifyBody;
  try {
    body = await req.json() as NotifyBody;
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 });
  }

  const { correlationId, ...rest } = body;
  const result = await sendTransportComplete(rest, correlationId);

  if (!result.ok && result.error) {
    console.warn('[rtd/notify] TRANSPORT_COMPLETE 전송 실패:', result.error);
  }

  return NextResponse.json({ ok: result.ok, status: result.status });
}
