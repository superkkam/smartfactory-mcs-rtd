/**
 * MES-RTD-MCS 메시지 생성 및 발신 유틸
 *
 * - createHeader(): 공통 봉투 헤더 생성 (messageId, correlationId, timestamp 자동 생성)
 * - sendMessage(): 대상 시스템 URL로 POST 전송 (환경 변수 URL이 없으면 silent skip)
 *
 * RTD, MCS, 가상 MES 모두 동일하게 사용합니다.
 */

import type {
  MessageHeader,
  MessageEnvelope,
  MessageType,
  SystemId,
} from './messages';

// ─── ID 생성 ─────────────────────────────────────────────────────

function generateId(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

// ─── 헤더 생성 ───────────────────────────────────────────────────

/**
 * 공통 메시지 헤더를 생성합니다.
 *
 * @param type  - 메시지 유형
 * @param source - 발신 시스템
 * @param target - 수신 시스템
 * @param options.siteId - 공장 사이트 ID (기본값 'FAB1')
 * @param options.correlationId - 기존 correlationId 이어받을 때 (응답 메시지 작성 시)
 */
export function createHeader(
  type: MessageType,
  source: SystemId,
  target: SystemId,
  options?: { siteId?: string; correlationId?: string }
): MessageHeader {
  return {
    messageId:     generateId('MSG'),
    messageType:   type,
    source,
    target,
    timestamp:     new Date().toISOString(),
    correlationId: options?.correlationId ?? generateId('COR'),
    siteId:        options?.siteId ?? 'FAB1',
    version:       '1.0',
  };
}

/**
 * 봉투(envelope)를 한 번에 생성합니다.
 *
 * @example
 * const msg = createMessage('LOAD_REQUEST', 'MES', 'RTD', {
 *   eventType: 'EVT_FULL',
 *   equipmentId: 'B1STK101',
 * });
 */
export function createMessage<T>(
  type: MessageType,
  source: SystemId,
  target: SystemId,
  body: T,
  options?: { siteId?: string; correlationId?: string }
): MessageEnvelope<T> {
  return {
    header: createHeader(type, source, target, options),
    body,
  };
}

// ─── 발신 유틸 ───────────────────────────────────────────────────

export interface SendResult<T = unknown> {
  ok: boolean;
  status?: number;
  data?: T;
  error?: string;
}

/**
 * 대상 시스템 URL로 메시지를 POST 전송합니다.
 *
 * - URL이 없으면(환경 변수 미설정 = 단독 실행 모드) 전송을 건너뜁니다.
 * - 서버 오류 시 예외를 던지지 않고 SendResult.ok=false 로 반환합니다.
 *
 * @param baseUrl - 수신 시스템 base URL (예: process.env.MCS_API_URL)
 * @param message - 전송할 메시지 봉투
 * @param endpoint - 수신 엔드포인트 (기본값 '/api/message')
 */
export async function sendMessage<TBody, TResponse = unknown>(
  baseUrl: string | undefined,
  message: MessageEnvelope<TBody>,
  endpoint = '/api/message'
): Promise<SendResult<TResponse>> {
  // URL 미설정 = 단독 실행 모드, 무시
  if (!baseUrl) {
    return { ok: true, data: undefined };
  }

  try {
    const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: text };
    }

    const data = await res.json().catch(() => undefined) as TResponse;
    return { ok: true, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : '네트워크 오류',
    };
  }
}

// ─── 수신 메시지 파싱 ────────────────────────────────────────────

/**
 * Request body에서 메시지 봉투를 파싱합니다.
 * messageType이 기대값과 다르면 null 반환.
 */
export async function parseMessage<T>(
  request: Request,
  expectedType?: MessageType
): Promise<MessageEnvelope<T> | null> {
  try {
    const msg = await request.json() as MessageEnvelope<T>;
    if (!msg.header?.messageType || !msg.body) return null;
    if (expectedType && msg.header.messageType !== expectedType) return null;
    return msg;
  } catch {
    return null;
  }
}
