'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

/**
 * AGV/AMR 노드 — 레이아웃 모델러 전용 심볼
 * - 이동형 장비. 크기는 SVG 콘텐츠에 딱 맞게 고정 (NodeResizer 없음).
 * - 1차 라벨: data.equipmentId (AGV-001 등 친숙 코드)
 * - 2차 라벨: data.systemName (ACS-001 등 담당 시스템)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AgvNode = memo(function AgvNode({ data, selected }: NodeProps<any>) {
  const borderColor   = selected ? '#2563eb' : '#60a5fa';
  const bgColor       = selected ? '#dbeafe' : '#eff6ff';
  const equipmentId   = (data.equipmentId as string) ?? 'AGV';
  const systemName    = (data.systemName  as string) ?? '';

  return (
    <div
      className="relative flex flex-col items-center justify-center gap-0.5 p-1"
      style={{ border: `2px solid ${borderColor}`, borderRadius: 8, background: bgColor }}
    >
      {/* 연결 핸들 */}
      <Handle type="target" position={Position.Top}    id="t" className="!h-1.5 !w-1.5 !bg-blue-500" />
      <Handle type="target" position={Position.Left}   id="l" className="!h-1.5 !w-1.5 !bg-blue-500" />
      <Handle type="source" position={Position.Bottom} id="b" className="!h-1.5 !w-1.5 !bg-blue-500" />
      <Handle type="source" position={Position.Right}  id="r" className="!h-1.5 !w-1.5 !bg-blue-500" />

      {/* AGV 심볼 */}
      <svg width="40" height="22" viewBox="0 0 80 40">
        <rect x="8" y="8" width="64" height="22" rx="4" fill="#3b82f6" opacity="0.9" />
        <ellipse cx="20" cy="34" rx="8" ry="5" fill="#1e3a5f" />
        <ellipse cx="60" cy="34" rx="8" ry="5" fill="#1e3a5f" />
        <ellipse cx="40" cy="11" rx="9" ry="4" fill="#93c5fd" />
        <polygon points="70,16 79,19 70,22" fill="#bfdbfe" />
      </svg>

      {/* 설비 아이디 (1차 라벨) */}
      <span className="text-[9px] font-bold text-blue-700 leading-tight">{equipmentId}</span>

      {/* 시스템 이름 (2차 라벨 — 입력된 경우에만 표시) */}
      {systemName && (
        <span className="text-[7px] text-blue-500 leading-tight">{systemName}</span>
      )}
    </div>
  );
});

AgvNode.displayName = 'AgvNode';
