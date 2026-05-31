'use client';

import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import type { ObstacleNode as ObstacleNodeType } from '../types';

/**
 * Obstacle 노드 — 통행 불가 셀 마커
 * - 경로망 그리드에서 AMR이 진입할 수 없는 셀을 시각화
 * - 핸들 없음 (엣지 연결 불가)
 * - 빗금 패턴 + 경고 색상으로 직관적으로 식별
 */
export const ObstacleNode = memo(function ObstacleNode({
  data,
  selected,
}: NodeProps<ObstacleNodeType>) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: 36,
        height: 36,
        borderRadius: 4,
        border: `2px solid ${selected ? '#991b1b' : '#ef4444'}`,
        background: selected ? '#fee2e2' : '#fff1f1',
        overflow: 'hidden',
      }}
    >
      {/* 빗금 패턴 SVG */}
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        className="absolute inset-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id={`hatch-${data.nodeId ?? 'obs'}`}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="#fca5a5" strokeWidth="2.5" />
          </pattern>
        </defs>
        <rect width="36" height="36" fill={`url(#hatch-${data.nodeId ?? 'obs'})`} />
        {/* 대각선 × */}
        <line x1="6" y1="6"  x2="30" y2="30" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="30" y1="6" x2="6"  y2="30" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {/* 선택 시 nodeId 라벨 */}
      {selected && data.nodeId && (
        <span
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-50 px-0.5 text-[7px] font-medium text-red-600 shadow-sm"
        >
          {data.nodeId}
        </span>
      )}
    </div>
  );
});

ObstacleNode.displayName = 'ObstacleNode';
