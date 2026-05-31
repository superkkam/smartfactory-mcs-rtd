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

  const borderColor =
    data.direction === 'IN'   ? (selected ? '#1d4ed8' : '#93c5fd') :
    data.direction === 'OUT'  ? (selected ? '#c2410c' : '#fdba74') :
                                (selected ? '#7c3aed' : '#c4b5fd');

  return (
    <div
      className="relative flex flex-col items-center gap-0.5 rounded-lg bg-white shadow-sm transition-shadow"
      style={{
        border: `1.5px solid ${borderColor}`,
        padding: '4px 5px 3px',
        minWidth: 44,
      }}
    >
      {/* 4방향 핸들 — 최소 크기로 노드 심볼과 구분 */}
      <Handle type="source" position={Position.Top}    id="t" className="!h-1.5 !w-1.5 !bg-slate-400 !border-slate-500 !-top-1" />
      <Handle type="source" position={Position.Left}   id="l" className="!h-1.5 !w-1.5 !bg-slate-400 !border-slate-500 !-left-1" />
      <Handle type="source" position={Position.Bottom} id="b" className="!h-1.5 !w-1.5 !bg-slate-400 !border-slate-500 !-bottom-1" />
      <Handle type="source" position={Position.Right}  id="r" className="!h-1.5 !w-1.5 !bg-slate-400 !border-slate-500 !-right-1" />

      {/* 포트 심볼 — 크기 키워서 명확하게 */}
      <PortSymbol
        state="Online"
        width={28}
        height={28}
      />

      {/* IN/OUT/BOTH 방향 배지 */}
      <span className={`rounded border px-1 py-0.5 text-[7px] font-semibold leading-none ${badge.style}`}>
        {badge.label}
      </span>

      {/* portId 라벨 */}
      <span className="max-w-[56px] truncate text-center text-[6.5px] font-medium text-gray-500 leading-tight">
        {data.portId ?? data.name}
      </span>
    </div>
  );
});

PortNode.displayName = 'PortNode';
