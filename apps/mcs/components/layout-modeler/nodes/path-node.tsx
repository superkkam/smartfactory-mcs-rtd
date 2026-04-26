'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PathNode as PathNodeType } from '../types';

/**
 * AMR 경로망 경유 노드 — 소형 원형(●)
 * 4방향 Handle로 TransferRelation 엣지 연결. 가능한 작게 유지해 설비와 겹침 최소화.
 */
export const PathNode = memo(function PathNode({
  data,
  selected,
}: NodeProps<PathNodeType>) {
  return (
    <div className="relative flex h-5 w-5 items-center justify-center">
      {/* 4방향 핸들 — 최소 크기 */}
      <Handle type="source" position={Position.Top}    id="t" className="!h-1.5 !w-1.5 !bg-slate-400 !border-slate-500 !-top-1" />
      <Handle type="source" position={Position.Left}   id="l" className="!h-1.5 !w-1.5 !bg-slate-400 !border-slate-500 !-left-1" />
      <Handle type="source" position={Position.Bottom} id="b" className="!h-1.5 !w-1.5 !bg-slate-400 !border-slate-500 !-bottom-1" />
      <Handle type="source" position={Position.Right}  id="r" className="!h-1.5 !w-1.5 !bg-slate-400 !border-slate-500 !-right-1" />

      {/* 원형 노드 본체 */}
      <div
        className={`h-5 w-5 rounded-full border-2 transition-colors ${
          selected
            ? 'border-indigo-500 bg-indigo-200'
            : 'border-slate-400 bg-slate-100'
        }`}
      />

      {/* 노드 ID 라벨 — 선택 시에만 표시 (공간 절약) */}
      {selected && (data.nodeId ?? data.label) && (
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-0.5 text-[7px] font-medium text-indigo-600 shadow-sm">
          {data.nodeId ?? data.label}
        </span>
      )}
    </div>
  );
});

PathNode.displayName = 'PathNode';
