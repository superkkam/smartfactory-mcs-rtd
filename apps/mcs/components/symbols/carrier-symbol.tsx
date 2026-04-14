/**
 * Carrier 심볼 — 커스텀 구현
 * THiRA JSON의 Carrier.json은 외부 이미지 참조 방식이라 직접 구현.
 * 반도체 FOUP(캐리어 박스)를 단순화한 아이소메트릭 표현.
 */

import type { SymbolState } from './utils';
import { stateToBgColor } from './utils';

interface CarrierSymbolProps {
  width?: number;
  height?: number;
  label?: string;
  state?: SymbolState;
  className?: string;
}

export function CarrierSymbol({
  width = 40,
  height = 40,
  label,
  state = 'Offline',
  className,
}: CarrierSymbolProps) {
  const bgColor = stateToBgColor(state);

  return (
    <svg
      viewBox="0 0 40 40"
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* FOUP 본체 (정면) */}
      <rect x={6} y={8} width={28} height={24} rx={2} ry={2} fill={bgColor} stroke="rgb(60,60,60)" strokeWidth={1} />

      {/* 핸들 (상단 중앙) */}
      <rect x={14} y={5} width={12} height={4} rx={2} ry={2} fill="rgb(80,80,80)" stroke="rgb(40,40,40)" strokeWidth={0.8} />

      {/* 전면 슬롯 라인 (FOUP 특징) */}
      <line x1={8} y1={14} x2={32} y2={14} stroke="rgba(0,0,0,0.2)" strokeWidth={0.8} />
      <line x1={8} y1={18} x2={32} y2={18} stroke="rgba(0,0,0,0.2)" strokeWidth={0.8} />
      <line x1={8} y1={22} x2={32} y2={22} stroke="rgba(0,0,0,0.2)" strokeWidth={0.8} />
      <line x1={8} y1={26} x2={32} y2={26} stroke="rgba(0,0,0,0.2)" strokeWidth={0.8} />

      {/* 전면 창 */}
      <rect x={10} y={12} width={20} height={16} rx={1} ry={1} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={0.8} />

      {/* 하단 베이스 */}
      <rect x={4} y={32} width={32} height={4} rx={1} ry={1} fill="rgb(50,50,50)" stroke="rgb(30,30,30)" strokeWidth={0.8} />

      {/* 레이블 */}
      {label && (
        <text x={20} y={38.5} textAnchor="middle" fontSize={3.5} fill="#333">
          {label}
        </text>
      )}
    </svg>
  );
}
