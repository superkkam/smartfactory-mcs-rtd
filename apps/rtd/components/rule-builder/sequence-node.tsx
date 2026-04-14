'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';

/** 시뮬레이션 오버레이 상태 (시뮬레이터 페이지에서만 전달) */
export type SimState = {
  count: number | null;
  duration: number;
  executed: boolean;   // false = jumpNextSequence 로 건너뛴 시퀀스
  failed: boolean;     // mandatory 이면서 count=0
  selected: boolean;   // 클릭 선택됨
};

export type SequenceNodeData = {
  sequence: number;
  ruleId: string;
  ruleName: string;
  ruleType: string;
  isMandatory: string;
  /** 시뮬레이터 결과 오버레이 (미전달 시 편집 모드 외관 그대로) */
  simState?: SimState;
};

/** 룰 시퀀스 블록 커스텀 노드 */
export const SequenceNode = memo(function SequenceNode({ data, selected }: NodeProps) {
  const d = data as SequenceNodeData;
  const sim = d.simState;

  // 필수 여부 배지 색
  const mandatoryColor =
    d.isMandatory === 'Y'
      ? 'bg-red-100 text-red-700 border-red-200'
      : d.isMandatory === 'O'
      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
      : 'bg-green-100 text-green-700 border-green-200';

  // 시뮬 결과에 따른 노드 테두리 색
  const borderColor = sim
    ? sim.failed
      ? 'border-red-500'
      : sim.selected
      ? 'border-blue-500'
      : sim.count !== null && sim.count > 0
      ? 'border-green-400'
      : 'border-gray-300'
    : selected
    ? 'border-blue-500'
    : 'border-gray-200';

  // 건너뛴 시퀀스: 흐림 처리
  const opacity = sim && !sim.executed ? 'opacity-40' : '';

  return (
    <div
      className={`rounded-lg border-2 bg-white px-4 py-3 shadow-sm min-w-[180px] transition-all ${borderColor} ${opacity}`}
    >
      {/* 상하 핸들: 일반 흐름 (filterSequence) */}
      <Handle type="target" position={Position.Top} id="top" className="!bg-gray-400" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-gray-400" />

      {/* 좌우 핸들: 점프 (jumpNextSequence) */}
      <Handle type="source" position={Position.Right} id="jump-out" className="!bg-amber-400 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="jump-in" className="!bg-amber-400 !w-2 !h-2" />

      {/* 헤더: 시퀀스 번호 + 필수 배지 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-400">#{d.sequence}</span>
        {sim && !sim.executed ? (
          <span className="rounded border px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-400 border-gray-200">
            건너뜀
          </span>
        ) : (
          <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${mandatoryColor}`}>
            {d.isMandatory === 'Y' ? '필수' : d.isMandatory === 'O' ? '선택' : '일반'}
          </span>
        )}
      </div>

      {/* 룰 이름 */}
      <p className="text-sm font-semibold text-gray-900 leading-tight">{d.ruleName}</p>

      {/* 룰 타입 배지 */}
      <div className="mt-2 flex items-center justify-between">
        <Badge variant="outline" className="text-xs">{d.ruleType}</Badge>

        {/* 시뮬레이션 결과 오버레이 */}
        {sim && sim.executed && (
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
              sim.failed
                ? 'bg-red-100 text-red-700'
                : sim.count !== null && sim.count > 0
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {sim.count === null ? '쿼리없음' : `${sim.count}건`}
          </span>
        )}
      </div>

      {/* 소요시간 (시뮬레이션 모드에서만) */}
      {sim && sim.executed && (
        <p className="mt-1 text-right text-xs text-gray-400">{sim.duration}ms</p>
      )}
    </div>
  );
});
