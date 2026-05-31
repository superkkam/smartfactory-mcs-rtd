'use client';

import { X, Navigation, Home } from 'lucide-react';
import { unitIdToLabel } from '@/lib/monitor/unit-mapping';
import { useActiveMicroCommandsByExecutor } from '@/lib/api/micro-commands';
import type { AcsVehicle } from '@/lib/acs/types';
import type { EquipmentUnit } from '@workspace/types/mcs';

const STATE_LABEL: Record<string, string> = {
  Idle:         '대기',
  Assigned:     '명령 할당',
  MovingEmpty:  '이동 중(공차)',
  Acquiring:    '캐리어 픽업',
  Loaded:       '캐리어 탑재',
  MovingLoaded: '이동 중(적재)',
  Depositing:   '캐리어 내려놓기',
};

const STATE_COLOR: Record<string, string> = {
  Idle:         'bg-gray-100 text-gray-600',
  Assigned:     'bg-blue-100 text-blue-700',
  MovingEmpty:  'bg-yellow-100 text-yellow-700',
  Acquiring:    'bg-orange-100 text-orange-700',
  Loaded:       'bg-green-100 text-green-700',
  MovingLoaded: 'bg-indigo-100 text-indigo-700',
  Depositing:   'bg-purple-100 text-purple-700',
};

interface VehiclePathPanelProps {
  vehicle: AcsVehicle;
  units:   EquipmentUnit[];
  onClose: () => void;
  /** 충전소 복귀 트리거 (Idle 상태에서만 동작) */
  onReturnHome?: () => void;
}

export function VehiclePathPanel({ vehicle, units, onClose, onReturnHome }: VehiclePathPanelProps) {
  const { vehicleState, equipmentId, returningHome } = vehicle;

  // DB 실시간 조회 — leader/follower 탭 무관하게 항상 정확한 진행 상태 반영
  const { data: microCommands = [] } = useActiveMicroCommandsByExecutor(equipmentId);

  const currentIdx = microCommands.findIndex((m) => m.state === 'InProgress');
  const total      = microCommands.length;
  const step       = currentIdx >= 0 ? currentIdx + 1 : 0;

  return (
    <div className="flex w-64 shrink-0 flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Navigation className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-800">{vehicle.equipmentLabel}</span>
        </div>
        <button onClick={onClose} className="rounded p-0.5 hover:bg-gray-100">
          <X className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </div>

      {/* 상태 배지 + 충전소 복귀 버튼 */}
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center self-start rounded-full px-2 py-0.5 text-[10px] font-medium ${STATE_COLOR[vehicleState] ?? 'bg-gray-100 text-gray-600'}`}>
          {STATE_LABEL[vehicleState] ?? vehicleState}
          {returningHome && ' · 홈 복귀 중'}
        </span>
        {onReturnHome && vehicleState === 'Idle' && !returningHome && (
          <button
            onClick={onReturnHome}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"
            title="충전소로 복귀"
          >
            <Home className="h-3 w-3" />
            충전소 복귀
          </button>
        )}
      </div>

      {/* 구간 목록 (DB 2초 폴링) */}
      {total > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">이동 구간</span>
            <span className="text-gray-400">{step > 0 ? `${step} / ${total}` : `- / ${total}`}</span>
          </div>

          {/* 진행 바 */}
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: total > 0 ? `${(step / total) * 100}%` : '0%' }}
            />
          </div>

          {/* 구간 목록 */}
          <div className="space-y-0.5 rounded-md bg-gray-50 p-2 max-h-52 overflow-y-auto">
            {microCommands.map((seg, i) => {
              const isCurrent = seg.state === 'InProgress';
              const isPast    = seg.state === 'Completed';
              const depLabel  = unitIdToLabel(seg.departureUnitId, units);
              const arrLabel  = unitIdToLabel(seg.arrivalUnitId, units);

              return (
                <div
                  key={seg.id}
                  className={`flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] ${
                    isCurrent
                      ? 'bg-indigo-50 font-semibold text-indigo-700'
                      : isPast
                      ? 'text-gray-400'
                      : 'text-gray-700'
                  }`}
                >
                  {/* 번호 */}
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    isCurrent
                      ? 'bg-indigo-600 text-white'
                      : isPast
                      ? 'bg-gray-200 text-gray-400'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {i + 1}
                  </span>
                  {/* 구간 */}
                  <span className="truncate">
                    {depLabel}
                    <span className="mx-0.5 opacity-60">→</span>
                    {arrLabel}
                  </span>
                  {isCurrent && (
                    <span className="ml-auto shrink-0 text-[9px] text-indigo-400">이동중</span>
                  )}
                  {isPast && (
                    <span className="ml-auto shrink-0 text-[9px] text-gray-300">완료</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400">이동 구간 없음</p>
      )}
    </div>
  );
}
