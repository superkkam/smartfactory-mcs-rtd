'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useEquipmentsByLayout } from './equipment';
import { useUnitsByLayout } from './equipment-units';
import { useCarriers } from './carriers';
import type { Equipment, EquipmentUnit, Carrier } from '@workspace/types/mcs';

const RECONNECT_DELAY_MS = 3000;

export type MonitorConnectionStatus = 'connecting' | 'subscribed' | 'error' | 'closed';

/**
 * 위치 변경 이벤트 (equipment.location_id 또는 carrier.location_id 변경 시 emit)
 * REPLICA IDENTITY FULL 덕분에 payload.old 를 신뢰할 수 있음
 * (docs/migrations/002-enable-realtime-monitoring.sql:40-42)
 */
export interface HopEvent {
  id: string;                           // 이벤트 고유 ID (uuid)
  entityType: 'equipment' | 'carrier';  // 이벤트 발생 주체 종류
  entityId: string;                     // equipment.id 또는 carrier.id
  fromUnitId: string | null;            // 이전 location_id (EquipmentUnit.id)
  toUnitId: string | null;              // 새 location_id (EquipmentUnit.id)
  at: number;                           // Date.now()
}

export interface LayoutMonitorResult {
  equipments: Equipment[];
  units: EquipmentUnit[];
  carriers: Carrier[];
  connectionStatus: MonitorConnectionStatus;
  lastUpdatedAt: Date | null;
  isLoading: boolean;
  /** 위치 변경 이벤트 큐 — useCarrierAnimations 에서 소비 */
  hopEvents: HopEvent[];
  /** 이벤트 소비 완료 후 큐에서 제거 */
  ackHopEvent: (hopId: string) => void;
}

/**
 * Supabase Realtime 기반 레이아웃 실시간 모니터링 훅
 *
 * - 초기 스냅샷: useEquipmentsByLayout / useUnitsByLayout / useCarriers
 * - 실시간 변경: postgres_changes 구독 → TanStack Query 캐시 직접 업데이트
 * - 자동 재연결: CHANNEL_ERROR 발생 시 3초 후 재구독
 * - React StrictMode 대응: channelRef로 이중 구독 방지
 */
export function useLayoutMonitor(layoutId: string | undefined): LayoutMonitorResult {
  const qc = useQueryClient();

  // 초기 스냅샷 조회
  const { data: equipments = [], isLoading: loadEq }  = useEquipmentsByLayout(layoutId ?? '');
  const { data: units = [],      isLoading: loadUnit } = useUnitsByLayout(layoutId ?? '');
  const { data: carriers = [],   isLoading: loadCar }  = useCarriers();

  const [connectionStatus, setConnectionStatus] = useState<MonitorConnectionStatus>('connecting');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [hopEvents, setHopEvents] = useState<HopEvent[]>([]);

  const ackHopEvent = useCallback((hopId: string) => {
    setHopEvents((prev) => prev.filter((e) => e.id !== hopId));
  }, []);

  const channelRef   = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef   = useRef(true);
  // qc 는 렌더마다 동일 인스턴스지만 ref 로 최신 값 유지 (클로저 stale 방지)
  const qcRef        = useRef(qc);
  useEffect(() => { qcRef.current = qc; }, [qc]);

  useEffect(() => {
    mountedRef.current = true;

    if (!layoutId) {
      setConnectionStatus('closed');
      return;
    }

    const supabase = createClient();

    function subscribe() {
      if (!mountedRef.current) return;
      // 이미 구독 중인 채널이 있으면 제거
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channelName = `mcs-monitor-${layoutId}-${Date.now()}`;

      const channel = supabase
        .channel(channelName)
        // 장비 상태/위치 변화 (Online ↔ Offline ↔ Error, location_id 이동)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'mcs_equipment' },
          (payload) => {
            const updated  = payload.new as Record<string, unknown>;
            const prev_row = payload.old as Record<string, unknown>;
            if ((updated.layout_id as string) !== layoutId) return;

            qcRef.current.setQueryData<Equipment[]>(
              ['mcs_equipment', 'by_layout', layoutId],
              (prev = []) =>
                prev.map((eq) =>
                  eq.id === (updated.id as string)
                    ? {
                        ...eq,
                        state:      updated.state as string,
                        locationId: (updated.location_id as string | null) ?? null,
                      }
                    : eq,
                ),
            );

            const oldLocId = (prev_row.location_id as string | null) ?? null;
            const newLocId = (updated.location_id as string | null) ?? null;
            if (oldLocId !== newLocId) {
              setHopEvents((prev) => [
                ...prev,
                {
                  id:         `eq-${updated.id as string}-${Date.now()}`,
                  entityType: 'equipment',
                  entityId:   updated.id as string,
                  fromUnitId: oldLocId,
                  toUnitId:   newLocId,
                  at:         Date.now(),
                },
              ]);
            }

            setLastUpdatedAt(new Date());
          },
        )
        // 유닛 전송 상태 변화 (Idle ↔ Transferring)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'mcs_equipment_unit' },
          (payload) => {
            const updated = payload.new as Record<string, unknown>;
            qcRef.current.setQueryData<EquipmentUnit[]>(
              ['mcs_equipment_unit', 'by_layout', layoutId],
              (prev = []) =>
                prev.map((u) =>
                  u.id === (updated.id as string)
                    ? { ...u, transferState: updated.transfer_state as string }
                    : u,
                ),
            );
            qcRef.current.setQueryData<EquipmentUnit[]>(
              ['mcs_equipment_unit', 'by_equipment', updated.equipment_id as string],
              (prev = []) =>
                prev.map((u) =>
                  u.id === (updated.id as string)
                    ? { ...u, transferState: updated.transfer_state as string }
                    : u,
                ),
            );
            setLastUpdatedAt(new Date());
          },
        )
        // 캐리어 hop 이동 또는 상태 변화
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mcs_carrier' },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              const updated  = payload.new as Record<string, unknown>;
              const prev_row = payload.old as Record<string, unknown>;

              qcRef.current.setQueryData<Carrier[]>(
                ['mcs_carrier'],
                (prev = []) =>
                  prev.map((c) =>
                    c.id === (updated.id as string)
                      ? {
                          ...c,
                          state:              updated.state as string,
                          currentEquipmentId: updated.current_equipment_id as string,
                          locationId:         (updated.location_id as string | null) ?? null,
                        }
                      : c,
                  ),
              );

              const oldLocId = (prev_row.location_id as string | null) ?? null;
              const newLocId = (updated.location_id as string | null) ?? null;
              if (oldLocId !== newLocId) {
                setHopEvents((prev) => [
                  ...prev,
                  {
                    id:         `car-${updated.id as string}-${Date.now()}`,
                    entityType: 'carrier',
                    entityId:   updated.id as string,
                    fromUnitId: oldLocId,
                    toUnitId:   newLocId,
                    at:         Date.now(),
                  },
                ]);
              }
            } else if (payload.eventType === 'INSERT') {
              qcRef.current.invalidateQueries({ queryKey: ['mcs_carrier'] });
            } else if (payload.eventType === 'DELETE') {
              const deleted = payload.old as Record<string, unknown>;
              qcRef.current.setQueryData<Carrier[]>(
                ['mcs_carrier'],
                (prev = []) => prev.filter((c) => c.id !== (deleted.id as string)),
              );
            }
            setLastUpdatedAt(new Date());
          },
        )
        .subscribe((status) => {
          if (!mountedRef.current) return;

          if (status === 'SUBSCRIBED') {
            setConnectionStatus('subscribed');
            // 재연결 시 최신 스냅샷 확보
            qcRef.current.invalidateQueries({ queryKey: ['mcs_equipment', 'by_layout', layoutId] });
            qcRef.current.invalidateQueries({ queryKey: ['mcs_equipment_unit', 'by_layout', layoutId] });
            qcRef.current.invalidateQueries({ queryKey: ['mcs_carrier'] });
          } else if (status === 'CHANNEL_ERROR') {
            setConnectionStatus('error');
            // 기존 채널 제거 후 3초 뒤 재구독
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            reconnectRef.current = setTimeout(() => {
              if (mountedRef.current) {
                setConnectionStatus('connecting');
                subscribe();
              }
            }, RECONNECT_DELAY_MS);
          } else if (status === 'CLOSED') {
            setConnectionStatus('closed');
          } else {
            setConnectionStatus('connecting');
          }
        });

      channelRef.current = channel;
    }

    subscribe();

    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setConnectionStatus('closed');
    };
  // layoutId 변경 시만 재구독 (qc 는 ref 로 관리)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutId]);

  return {
    equipments,
    units,
    carriers,
    connectionStatus,
    lastUpdatedAt,
    isLoading: loadEq || loadUnit || loadCar,
    hopEvents,
    ackHopEvent,
  };
}
