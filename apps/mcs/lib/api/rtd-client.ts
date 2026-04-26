/**
 * MCS → RTD 메시지 전송 유틸
 *
 * NEXT_PUBLIC_RTD_ENABLED="false" 또는 RTD_API_URL 미설정 시
 * 모든 함수가 silent skip (단독 실행 모드).
 */

import {
  createMessage,
  sendMessage,
  type SendResult,
} from '@workspace/types/message-client';
import type {
  TransportCompleteBody,
  TransportFailedBody,
} from '@workspace/types/messages';

/** RTD API base URL (서버 사이드에서 사용) */
function getRtdUrl(): string | undefined {
  return process.env.RTD_API_URL;
}

/** RTD 연동 활성 여부 — 클라이언트에서는 NEXT_PUBLIC_RTD_ENABLED 만 참조 */
export function isRtdEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RTD_ENABLED === 'true';
}

/**
 * MCS → RTD: 반송 완료 알림
 * @param correlationId 원본 DISPATCH_RESULT 의 correlationId (에코)
 */
export async function sendTransportComplete(
  params: Omit<TransportCompleteBody, 'status'>,
  correlationId?: string,
): Promise<SendResult> {
  const body: TransportCompleteBody = { ...params, status: 'COMPLETED' };
  const msg = createMessage<TransportCompleteBody>(
    'TRANSPORT_COMPLETE',
    'MCS',
    'RTD',
    body,
    correlationId ? { correlationId } : undefined,
  );
  return sendMessage(getRtdUrl(), msg);
}

/**
 * MCS → RTD: 반송 실패 알림
 */
export async function sendTransportFailed(
  params: Omit<TransportFailedBody, 'status'> & {
    status?: 'FAILED' | 'CANCELLED';
  },
): Promise<SendResult> {
  const body: TransportFailedBody = {
    ...params,
    status: params.status ?? 'FAILED',
  };
  const msg = createMessage<TransportFailedBody>(
    'TRANSPORT_FAILED',
    'MCS',
    'RTD',
    body,
  );
  return sendMessage(getRtdUrl(), msg);
}
