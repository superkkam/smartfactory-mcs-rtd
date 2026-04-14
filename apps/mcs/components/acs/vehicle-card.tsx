'use client';

import type { AcsVehicle } from '@/lib/acs/types';

/** 차량 상태별 배지 스타일 */
const STATE_BADGE: Record<string, { style: string; label: string }> = {
  Idle:         { style: 'bg-gray-100 text-gray-600',    label: '대기' },
  Assigned:     { style: 'bg-blue-100 text-blue-700',    label: '명령 할당' },
  MovingEmpty:  { style: 'bg-yellow-100 text-yellow-700', label: '이동 중(공차)' },
  Acquiring:    { style: 'bg-orange-100 text-orange-700', label: '캐리어 픽업' },
  Loaded:       { style: 'bg-green-100 text-green-700',  label: '캐리어 탑재' },
  MovingLoaded: { style: 'bg-indigo-100 text-indigo-700', label: '이동 중(적재)' },
  Depositing:   { style: 'bg-purple-100 text-purple-700', label: '캐리어 내려놓기' },
};

interface VehicleCardProps {
  vehicle: AcsVehicle;
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const badge = STATE_BADGE[vehicle.vehicleState] ?? STATE_BADGE.Idle;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">{vehicle.equipmentLabel}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.style}`}>
          {badge.label}
        </span>
      </div>

      {vehicle.currentCommandId && (
        <p className="mt-1 text-[10px] text-gray-400 truncate">
          명령: {vehicle.currentCommandId.slice(0, 8)}…
        </p>
      )}

      {vehicle.currentPath.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] text-gray-400 mb-0.5">
            경로 진행 {vehicle.pathIndex + 1} / {vehicle.currentPath.length}
          </p>
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
              style={{
                width: `${((vehicle.pathIndex + 1) / vehicle.currentPath.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
