'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useEquipmentsByLayout } from './equipment';
import { useUnitsByLayout } from './equipment-units';
import { useCarriers } from './carriers';
import type { Equipment, EquipmentUnit, Carrier } from '@workspace/types/mcs';

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
 * - 자동 재연결: Supabase Realtime 클라이언트 기본 제공 (지수 백오프)
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

  // React StrictMode 이중 실행 방지: 채널이 이미 구독 중이면 재구독 스킵
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  useEffect(() => {
    if (!layoutId) {
      setConnectionStatus('closed');
      return;
    }

    // 이미 구독 중이면 재구독 스킵 (React StrictMode 이중 실행 방지)
    if (channelRef.current) return;

    const supabase = createClient();
    // 채널명에 타임스탬프를 추가하여 동일 topic 충돌 방지
    const channelName = `mcs-monitor-${layoutId}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      // 장비 상태/위치 변화 (Online ↔ Offline ↔ Error, location_id 이동)
      // 참고: REPLICA IDENTITY FULL 없이 서버사이드 filter 사용 시 구독 실패 → 클라이언트 필터링
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mcs_equipment' },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          const prev_row = payload.old as Record<string, unknown>;
          // 현재 레이아웃 소속 장비만 처리
          if ((updated.layout_id as string) !== layoutId) return;

          // TanStack Query 캐시 패치 (state + locationId 동시 갱신)
          qc.setQueryData<Equipment[]>(
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

          // location_id 변경 시 hopEvent emit (AMR/AGV 이동 추적)
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
          // by_layout 캐시 업데이트
          qc.setQueryData<EquipmentUnit[]>(
            ['mcs_equipment_unit', 'by_layout', layoutId],
            (prev = []) =>
              prev.map((u) =>
                u.id === (updated.id as string)
                  ? { ...u, transferState: updated.transfer_state as string }
                  : u,
              ),
          );
          // by_equipment 캐시 업데이트 (반송 제어 페이지와 공유)
          qc.setQueryData<EquipmentUnit[]>(
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
      // 캐리어 hop 이동 (currentEquipmentId / locationId) 또는 상태 변화
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mcs_carrier' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated  = payload.new as Record<string, unknown>;
            const prev_row = payload.old as Record<string, unknown>;

            // TanStack Query 캐시 패치 (locationId 포함)
            qc.setQueryData<Carrier[]>(
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

            // location_id 변경 시 hopEvent emit (캐리어 이동 추적)
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
            qc.invalidateQueries({ queryKey: ['mcs_carrier'] });
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as Record<string, unknown>;
            qc.setQueryData<Carrier[]>(
              ['mcs_carrier'],
              (prev = []) => prev.filter((c) => c.id !== (deleted.id as string)),
            );
          }
          setLastUpdatedAt(new Date());
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('subscribed');
          // 재연결 시 최신 스냅샷 확보
          qc.invalidateQueries({ queryKey: ['mcs_equipment', 'by_layout', layoutId] });
          qc.invalidateQueries({ queryKey: ['mcs_equipment_unit', 'by_layout', layoutId] });
          qc.invalidateQueries({ queryKey: ['mcs_carrier'] });
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('error');
        } else if (status === 'CLOSED') {
          setConnectionStatus('closed');
        } else {
          setConnectionStatus('connecting');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setConnectionStatus('closed');
    };
  }, [layoutId, qc]);

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
