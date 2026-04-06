'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';

export type SequenceNodeData = {
  sequence: number;
  ruleId: string;
  ruleName: string;
  ruleType: string;
  isMandatory: string;
};

/** 룰 시퀀스 블록 커스텀 노드 */
export const SequenceNode = memo(function SequenceNode({ data, selected }: NodeProps) {
  const d = data as SequenceNodeData;

  const mandatoryColor =
    d.isMandatory === 'Y'
      ? 'bg-red-100 text-red-700 border-red-200'
      : d.isMandatory === 'O'
      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
      : 'bg-green-100 text-green-700 border-green-200';

  return (
    <div
      className={`rounded-lg border-2 bg-white px-4 py-3 shadow-sm min-w-[160px] ${
        selected ? 'border-blue-500' : 'border-gray-200'
      }`}
    >
      {/* 상하 핸들: 일반 흐름 (filterSequence) */}
      <Handle type="target" position={Position.Top} id="top" className="!bg-gray-400" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-gray-400" />

      {/* 좌우 핸들: 점프 (jumpNextSequence) */}
      <Handle type="source" position={Position.Right} id="jump-out" className="!bg-amber-400 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="jump-in" className="!bg-amber-400 !w-2 !h-2" />

      {/* 시퀀스 번호 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-400">#{d.sequence}</span>
        <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${mandatoryColor}`}>
          {d.isMandatory === 'Y' ? '필수' : d.isMandatory === 'O' ? '선택' : '일반'}
        </span>
      </div>

      {/* 룰 이름 */}
      <p className="text-sm font-semibold text-gray-900 leading-tight">{d.ruleName}</p>

      {/* 룰 타입 배지 */}
      <div className="mt-2">
        <Badge variant="outline" className="text-xs">{d.ruleType}</Badge>
      </div>
    </div>
  );
});
