'use client';

import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  StockerSymbol,
  ConveyorSymbol,
  ProcessSymbol,
  PortSymbol,
  CraneSymbol,
} from '@/components/symbols';
import type { SymbolState } from '@/components/symbols';

export type EquipmentNodeData = {
  equipmentId: string;
  name: string;
  equipmentType: 'STOCKER' | 'CONVEYOR' | 'PROCESS' | 'PORT' | 'CRANE';
  state: SymbolState;
};

/** 장비 상태 → 배지 스타일 */
function StateBadge({ state }: { state: SymbolState }) {
  const styles: Record<SymbolState, string> = {
    Online:  'bg-green-100 text-green-700 border-green-300',
    Offline: 'bg-gray-100  text-gray-500  border-gray-300',
    Error:   'bg-red-100   text-red-600   border-red-300',
  };
  const labels: Record<SymbolState, string> = {
    Online: '운영중', Offline: '중지', Error: '에러',
  };
  return (
    <span className={`rounded border px-1 py-0.5 text-[9px] font-medium ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}

/** 장비 타입 → SVG 심볼 컴포넌트 */
function EquipmentSymbol({
  type,
  state,
}: {
  type: EquipmentNodeData['equipmentType'];
  state: SymbolState;
}) {
  const props = { state, className: 'block' };
  switch (type) {
    case 'STOCKER':  return <StockerSymbol  {...props} width={160} height={24} />;
    case 'CONVEYOR': return <ConveyorSymbol {...props} width={40}  height={34} />;
    case 'PROCESS':  return <ProcessSymbol  {...props} width={120} height={48} />;
    case 'PORT':     return <PortSymbol     {...props} width={28}  height={28} />;
    case 'CRANE':    return <CraneSymbol    {...props} width={36}  height={38} />;
    default:         return null;
  }
}

export type EquipmentNodeType = Node<EquipmentNodeData>;

/** React Flow 커스텀 장비 노드 */
export const EquipmentNode = memo(function EquipmentNode({
  data,
  selected,
}: NodeProps<EquipmentNodeType>) {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-md border bg-white p-1.5 shadow-sm transition-shadow ${
        selected ? 'border-indigo-500 shadow-md' : 'border-gray-300'
      }`}
    >
      <Handle type="target" position={Position.Left}  className="!w-2 !h-2 !bg-indigo-400" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-indigo-400" />

      <EquipmentSymbol type={data.equipmentType} state={data.state} />

      <div className="flex items-center gap-1">
        <span className="max-w-[120px] truncate text-[10px] font-medium text-gray-700">
          {data.name}
        </span>
        <StateBadge state={data.state} />
      </div>
    </div>
  );
});

EquipmentNode.displayName = 'EquipmentNode';
