'use client';

import type { AcsVehicle } from '@/lib/acs/types';
import { unitIdToLabel } from '@/lib/monitor/unit-mapping';
import { useActiveMicroCommandsByExecutor } from '@/lib/api/micro-commands';
import type { EquipmentUnit } from '@workspace/types/mcs';

const STATE_BADGE: Record<string, { style: string; label: string }> = {
  Idle:         { style: 'bg-gray-100 text-gray-600',     label: '대기' },
  Assigned:     { style: 'bg-blue-100 text-blue-700',     label: '명령 할당' },
  MovingEmpty:  { style: 'bg-yellow-100 text-yellow-700', label: '이동 중(공차)' },
  Acquiring:    { style: 'bg-orange-100 text-orange-700', label: '캐리어 픽업' },
  Loaded:       { style: 'bg-green-100 text-green-700',   label: '캐리어 탑재' },
  MovingLoaded: { style: 'bg-indigo-100 text-indigo-700', label: '이동 중(적재)' },
  Depositing:   { style: 'bg-purple-100 text-purple-700', label: '캐리어 내려놓기' },
};

interface VehicleCardProps {
  vehicle: AcsVehicle;
  units?:  EquipmentUnit[];
}

export function VehicleCard({ vehicle, units = [] }: VehicleCardProps) {
  const badge = STATE_BADGE[vehicle.vehicleState] ?? STATE_BADGE.Idle;

  // DB 실시간 조회 — leader/follower 탭 무관하게 항상 정확한 진행 상태 반영
  const { data: microCommands = [] } = useActiveMicroCommandsByExecutor(vehicle.equipmentId);

  const total      = microCommands.length;
  const currentIdx = microCommands.findIndex((m) => m.state === 'InProgress');
  const step       = currentIdx >= 0 ? currentIdx + 1 : (total > 0 ? 1 : 0);
  const currentSeg = currentIdx >= 0 ? microCommands[currentIdx] : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">{vehicle.equipmentLabel}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.style}`}>
          {badge.label}
          {vehicle.returningHome && ' · 홈복귀'}
        </span>
      </div>

      {total > 0 && (
        <div className="mt-2 space-y-1">
          {/* N/M · 출발 → 도착 */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-medium text-gray-600">구간 {step}/{total}</span>
            {currentSeg && units.length > 0 && (
              <span className="truncate ml-2 text-indigo-600 font-medium">
                {unitIdToLabel(currentSeg.departureUnitId, units)}
                {' → '}
                {unitIdToLabel(currentSeg.arrivalUnitId, units)}
              </span>
            )}
          </div>
          {/* 진행 바 */}
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: total > 0 ? `${(step / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
