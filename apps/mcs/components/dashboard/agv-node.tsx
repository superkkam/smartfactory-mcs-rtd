'use client';

import { memo } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';

export type AgvNodeData = {
  equipmentId: string;
  state: string;
};

export type DashboardAgvNodeType = Node<AgvNodeData>;

const STATE_BADGE: Record<string, { bg: string; label: string }> = {
  Idle:         { bg: '#e5e7eb', label: 'Idle' },
  Assigned:     { bg: '#e0e7ff', label: 'Assigned' },
  MovingEmpty:  { bg: '#dbeafe', label: 'Moving→' },
  Acquiring:    { bg: '#fef3c7', label: 'Acquiring' },
  Loaded:       { bg: '#c7d2fe', label: 'Loaded' },
  MovingLoaded: { bg: '#dbeafe', label: 'Moving↑' },
  Depositing:   { bg: '#fef3c7', label: 'Depositing' },
  Error:        { bg: '#fee2e2', label: 'Error' },
};

/**
 * 대시보드 전용 AGV 노드 — SVG 심볼 + SEMI E82 상태 배지
 * 캐리어가 위에 얹히는 것이 자연스럽도록 배경 없이 SVG 만 렌더링.
 */
export const DashboardAgvNode = memo(function DashboardAgvNode({ data }: NodeProps<DashboardAgvNodeType>) {
  const isError = data.state === 'Error';
  const bodyFill = isError ? '#ef4444' : '#3b82f6';
  const badge = STATE_BADGE[data.state] ?? STATE_BADGE.Idle;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <svg
        width="44"
        height="26"
        viewBox="0 0 80 40"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))', display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 섀시 본체 */}
        <rect x={6} y={8} width={66} height={22} rx={5} fill={bodyFill} opacity={0.92} />
        {/* 바퀴 */}
        <ellipse cx={20} cy={34} rx={9} ry={5.5} fill="#1e3a5f" />
        <ellipse cx={60} cy={34} rx={9} ry={5.5} fill="#1e3a5f" />
        {/* 상단 센서 돔 */}
        <ellipse cx={40} cy={10} rx={10} ry={4.5} fill="#93c5fd" />
        {/* 전진 방향 화살표 */}
        <polygon points="72,16 80,19 72,22" fill="#bfdbfe" />
        {/* 빛 반사 */}
        <rect x={10} y={11} width={30} height={4} rx={2} fill="rgba(255,255,255,0.18)" />
      </svg>
      <span
        style={{
          fontSize:      8,
          lineHeight:    1,
          background:    badge.bg,
          borderRadius:  2,
          padding:       '1px 3px',
          whiteSpace:    'nowrap',
          color:         '#374151',
          boxShadow:     '0 1px 2px rgba(0,0,0,0.15)',
          pointerEvents: 'none',
        }}
      >
        {badge.label}
      </span>
    </div>
  );
});

DashboardAgvNode.displayName = 'DashboardAgvNode';
