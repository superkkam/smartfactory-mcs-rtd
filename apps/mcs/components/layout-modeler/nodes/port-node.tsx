'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { PortSymbol } from '@/components/symbols';
import type { PortNode as PortNodeType } from '../types';

/** 방향 배지 스타일 */
const DIR_BADGE: Record<'IN' | 'OUT' | 'BOTH', { style: string; label: string }> = {
  IN:   { style: 'bg-blue-100   text-blue-700   border-blue-300',   label: 'IN'   },
  OUT:  { style: 'bg-orange-100 text-orange-700 border-orange-300', label: 'OUT'  },
  BOTH: { style: 'bg-purple-100 text-purple-700 border-purple-300', label: 'I/O'  },
};

/**
 * Port 노드 — 4방향 Handle, IN/OUT/BOTH 방향 배지
 * TransferRelation 엣지의 소스/타겟이 되는 포트
 */
export const PortNode = memo(function PortNode({
  data,
  selected,
}: NodeProps<PortNodeType>) {
  const badge = DIR_BADGE[data.direction];

  return (
    <div
      className={`flex flex-col items-center gap-0.5 rounded border bg-white p-1 shadow-sm transition-shadow ${
        selected ? 'border-indigo-500 shadow-md' : 'border-gray-300'
      }`}
    >
      {/* 4방향 핸들 — AMR이 어느 방향으로든 연결 가능 */}
      {/* ConnectionMode.Loose: source 핸들끼리 연결 가능 → 모든 방향 source 로 통일 */}
      <Handle type="source" position={Position.Top}    id="t" className="!h-3 !w-3 !bg-indigo-400 !border-indigo-600" />
      <Handle type="source" position={Position.Left}   id="l" className="!h-3 !w-3 !bg-indigo-400 !border-indigo-600" />
      <Handle type="source" position={Position.Bottom} id="b" className="!h-3 !w-3 !bg-indigo-400 !border-indigo-600" />
      <Handle type="source" position={Position.Right}  id="r" className="!h-3 !w-3 !bg-indigo-400 !border-indigo-600" />

      <PortSymbol state="Online" width={20} height={20} />

      <span className={`rounded border px-1 py-0.5 text-[7px] font-medium ${badge.style}`}>
        {badge.label}
      </span>
      {/* 1차 라벨: portId (PORT-001 등 친숙 코드) */}
      <span className="max-w-[52px] truncate text-[7px] font-medium text-gray-600">{data.portId ?? data.name}</span>
      {/* 2차 라벨: name (portId 와 다를 때만) */}
      {data.name && data.name !== data.portId && (
        <span className="max-w-[52px] truncate text-[6px] text-gray-400">{data.name}</span>
      )}
    </div>
  );
});

PortNode.displayName = 'PortNode';
