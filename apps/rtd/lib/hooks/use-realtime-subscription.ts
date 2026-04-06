'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseRealtimeOptions<T extends Record<string, unknown>> {
  /** 구독할 테이블명 */
  table: string;
  /** 감시할 이벤트 유형 */
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  /** DB 스키마 (기본값 'public') */
  schema?: string;
  /** Supabase Realtime 필터 (예: 'rule_id=eq.R001') */
  filter?: string;
  /** 새 레코드 수신 시 콜백 */
  onReceive: (payload: RealtimePostgresChangesPayload<T>) => void;
  /** 구독 활성화 여부 (기본값 true) */
  enabled?: boolean;
}

interface UseRealtimeResult {
  connectionStatus: ConnectionStatus;
}

/**
 * Supabase Realtime postgres_changes 범용 구독 훅.
 * - enabled=false 시 구독하지 않음
 * - TIMED_OUT/CHANNEL_ERROR 발생 시 지수 백오프로 자동 재연결 (1s→2s→4s, max 30s)
 * - cleanup 시 채널 제거
 */
export function useRealtimeSubscription<T extends Record<string, unknown>>(
  options: UseRealtimeOptions<T>
): UseRealtimeResult {
  const { table, event, schema = 'public', filter, onReceive, enabled = true } = options;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const retryDelayRef = useRef(1000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const removedRef = useRef(false);
  const onReceiveRef = useRef(onReceive);
  onReceiveRef.current = onReceive; // 항상 최신 콜백 참조

  useEffect(() => {
    if (!enabled) {
      setConnectionStatus('disconnected');
      return;
    }

    const supabase = createClient();
    removedRef.current = false;
    retryDelayRef.current = 1000;

    function subscribe() {
      if (removedRef.current) return;
      setConnectionStatus('connecting');

      const channelName = `realtime:${table}:${Date.now()}`;
      const ch: RealtimeChannel = supabase.channel(channelName);

      ch.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event, schema, table, ...(filter ? { filter } : {}) },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => { onReceiveRef.current(payload); }
      ).subscribe((status: string) => {
        if (removedRef.current) return;

        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          retryDelayRef.current = 1000;
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('error');
          supabase.removeChannel(ch);
          // 지수 백오프 재연결
          const delay = Math.min(retryDelayRef.current, 30000);
          retryDelayRef.current = delay * 2;
          retryTimerRef.current = setTimeout(subscribe, delay);
        } else if (status === 'CLOSED') {
          if (!removedRef.current) setConnectionStatus('disconnected');
        }
      });

      channelRef.current = ch;
    }

    subscribe();

    return () => {
      removedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      setConnectionStatus('disconnected');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, table, event, schema, filter]);

  return { connectionStatus };
}
