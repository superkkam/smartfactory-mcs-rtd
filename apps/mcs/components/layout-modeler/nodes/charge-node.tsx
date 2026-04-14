'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ChargeNode as ChargeNodeType } from '../types';

/**
 * 충전소 노드 — AMR/AGV 의 홈 위치(시작점)
 * - 경로망의 일부이므로 4방향 Handle 보유 (Node 와 동일)
 * - 시각적으로 ⚡ 심볼 + 주황 색상으로 구분
 * - data.nodeId 를 라벨로 표시 (CHG-001 등)
 */
export const ChargeNode = memo(function ChargeNode({
  data,
  selected,
}: NodeProps<ChargeNodeType>) {
  return (
    <div className="relative flex h-8 w-8 items-center justify-center">
      {/* 4방향 핸들 */}
      {/* ConnectionMode.Loose: source 핸들끼리 연결 가능 → 모든 방향 source 로 통일 */}
      <Handle type="source" position={Position.Top}    id="t" className="!h-3 !w-3 !bg-orange-500 !border-orange-700" />
      <Handle type="source" position={Position.Left}   id="l" className="!h-3 !w-3 !bg-orange-500 !border-orange-700" />
      <Handle type="source" position={Position.Bottom} id="b" className="!h-3 !w-3 !bg-orange-500 !border-orange-700" />
      <Handle type="source" position={Position.Right}  id="r" className="!h-3 !w-3 !bg-orange-500 !border-orange-700" />

      {/* 충전소 SVG — 육각형 + 번개 */}
      <svg width="32" height="32" viewBox="0 0 32 32">
        <polygon
          points="16,2 28,9 28,23 16,30 4,23 4,9"
          fill={selected ? '#ea580c' : '#f97316'}
          stroke={selected ? '#9a3412' : '#c2410c'}
          strokeWidth="1.5"
        />
        {/* 번개 모양 */}
        <polygon
          points="18,5 12,17 16,17 14,27 20,15 16,15"
          fill="white"
          opacity="0.9"
        />
      </svg>

      {/* 노드 ID 라벨 */}
      {(data.nodeId ?? data.label) && (
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] text-orange-600 font-medium">
          {data.nodeId ?? data.label}
        </span>
      )}
    </div>
  );
});

ChargeNode.displayName = 'ChargeNode';
