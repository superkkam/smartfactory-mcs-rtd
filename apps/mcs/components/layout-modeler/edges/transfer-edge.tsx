'use client';

import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react';
import type { TransferEdge } from '../types';

/**
 * TransferRelation 커스텀 엣지
 * - 점선 화살표 스타일 (AMR 이동 경로)
 * - 가중치(거리) 라벨 표시
 * - hidden=true 이면 투명하게 처리 (토글 가능)
 */
export function TransferEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerStart,
  markerEnd,
}: EdgeProps<TransferEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const weight = data?.weight ?? 1;
  const system = data?.system;

  const strokeColor = selected ? '#6366f1' : '#64748b';

  return (
    <>
      {/* 투명 히트 영역 — 클릭 감지용 (실제 선보다 훨씬 넓게) */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
      />
      {/* 엣지 경로 — 시각적 표시용 */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray="6,4"
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{ pointerEvents: 'none' }}
      />

      {/* 가중치 라벨 */}
      {(
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',  // 엣지 클릭이 라벨에 가로막히지 않도록
            }}
          >
            <span className="flex items-center gap-1">
              <span
                className={`rounded border px-1 py-0.5 text-[9px] font-medium shadow-sm ${
                  selected
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-500'
                }`}
              >
                {weight}m
              </span>
              {system && (
                <span className="rounded border border-teal-200 bg-teal-50 px-1 py-0.5 text-[9px] font-medium text-teal-600 shadow-sm">
                  {system}
                </span>
              )}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

TransferEdgeComponent.displayName = 'TransferEdgeComponent';
