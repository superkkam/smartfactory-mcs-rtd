'use client';

import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { StockerSymbol } from '@/components/symbols';
import { getEquipmentContainerStyle, getEquipmentBadgeStyle, getEquipmentStateLabel } from '@/lib/monitor/state-colors';
import type { StockerNode } from '../types';

/**
 * Stocker 설비 노드
 * - 포트는 별도 독립 노드로 생성되어 근처에 자유롭게 배치
 * - 이 노드 자체는 연결 핸들 없음 (연결은 Port 노드를 통해)
 */
export const StockerGroupNode = memo(function StockerGroupNode({
  data,
  selected,
}: NodeProps<StockerNode>) {
  const stateStyle  = getEquipmentContainerStyle(data.state ?? '');
  const badgeStyle  = getEquipmentBadgeStyle(data.state ?? '');
  const badgeLabel  = getEquipmentStateLabel(data.state ?? '');

  return (
    <div
      className={`rounded-lg border-2 p-2 shadow-sm transition-shadow ${stateStyle} ${
        selected ? 'shadow-md ring-2 ring-indigo-400 ring-offset-1' : ''
      }`}
    >
      {/* 설비 아이디 + 상태 배지 */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          {/* 1차 라벨: equipmentId (STK-001 등 친숙 코드) */}
          <span className="max-w-[150px] truncate text-[10px] font-semibold text-gray-700">
            {data.equipmentId ?? data.name}
          </span>
          {/* 2차 라벨: name (equipmentId 와 다를 때만 표시) */}
          {data.name && data.name !== data.equipmentId && (
            <span className="max-w-[150px] truncate text-[8px] text-gray-400">{data.name}</span>
          )}
        </div>
        <span className={`rounded border px-1 py-0.5 text-[8px] font-medium ${badgeStyle}`}>
          {badgeLabel}
        </span>
      </div>

      {/* Stocker 심볼 */}
      <StockerSymbol state={data.state} width={160} height={24} className="block" />

      {/* 포트 수 */}
      <div className="mt-1 text-center text-[8px] text-gray-400">
        포트 {data.portCount}개 (별도 배치)
      </div>
    </div>
  );
});

StockerGroupNode.displayName = 'StockerGroupNode';
