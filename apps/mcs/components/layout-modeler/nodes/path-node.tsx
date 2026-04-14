'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PathNode as PathNodeType } from '../types';

/**
 * AMR 경로망 경유 노드 (구 Waypoint) — 다이아몬드(◆) 형태
 * 경유점으로만 사용. 4방향 Handle로 TransferRelation 엣지 연결 가능.
 */
export const PathNode = memo(function PathNode({
  data,
  selected,
}: NodeProps<PathNodeType>) {
  return (
    <div className="relative flex h-8 w-8 items-center justify-center">
      {/* 4방향 핸들 */}
      {/* ConnectionMode.Loose: source 핸들끼리 연결 가능 → 모든 방향 source 로 통일 */}
      <Handle type="source" position={Position.Top}    id="t" className="!h-3 !w-3 !bg-amber-500 !border-amber-700" />
      <Handle type="source" position={Position.Left}   id="l" className="!h-3 !w-3 !bg-amber-500 !border-amber-700" />
      <Handle type="source" position={Position.Bottom} id="b" className="!h-3 !w-3 !bg-amber-500 !border-amber-700" />
      <Handle type="source" position={Position.Right}  id="r" className="!h-3 !w-3 !bg-amber-500 !border-amber-700" />

      {/* 다이아몬드 SVG */}
      <svg width="32" height="32" viewBox="0 0 32 32">
        <polygon
          points="16,2 30,16 16,30 2,16"
          fill={selected ? '#f59e0b' : '#fbbf24'}
          stroke={selected ? '#92400e' : '#d97706'}
          strokeWidth="1.5"
        />
        <text x="16" y="20" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">
          ◆
        </text>
      </svg>

      {/* 노드 ID 라벨 — nodeId 우선, fallback label */}
      {(data.nodeId ?? data.label) && (
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] text-gray-500">
          {data.nodeId ?? data.label}
        </span>
      )}
    </div>
  );
});

PathNode.displayName = 'PathNode';
