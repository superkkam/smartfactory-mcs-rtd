'use client';

import { memo } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import type { CarrierState } from '@workspace/types/constants';

export type CarrierNodeData = {
  carrierId: string;
  state: CarrierState;
};

export type CarrierNodeType = Node<CarrierNodeData>;

/**
 * 캐리어 노드 — AGV 위에 자연스럽게 얹히는 작은 FOUP 아이콘
 * 텍스트 라벨 없음. 이동 중(Transferring)이면 amber 색으로 강조.
 */
export const CarrierNode = memo(function CarrierNode({ data }: NodeProps<CarrierNodeType>) {
  const moving = data.state === 'Transferring';

  const bodyColor   = moving ? '#f59e0b' : '#6366f1';
  const handleColor = moving ? '#d97706' : '#4338ca';
  const panelColor  = moving ? '#fcd34d' : '#a5b4fc';
  const dotColor    = moving ? '#fff'    : '#e0e7ff';

  return (
    /* AGV 섀시 위에 얹히도록 배경 없이 SVG 만 표시 */
    <svg
      width="20"
      height="20"
      viewBox="0 0 40 40"
      style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* FOUP 본체 */}
      <rect x={5} y={10} width={30} height={24} rx={3} fill={bodyColor} />
      {/* 상단 핸들 */}
      <rect x={13} y={5}  width={14} height={7}  rx={3} fill={handleColor} />
      {/* 전면 패널 */}
      <rect x={8}  y={13} width={24} height={18} rx={2} fill={panelColor} opacity={0.8} />
      {/* 슬롯 라인 */}
      <line x1={9} y1={18} x2={31} y2={18} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
      <line x1={9} y1={23} x2={31} y2={23} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
      <line x1={9} y1={28} x2={31} y2={28} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
      {/* 중앙 인디케이터 */}
      <circle cx={20} cy={20} r={3.5} fill={dotColor} />
    </svg>
  );
});

CarrierNode.displayName = 'CarrierNode';
