/**
 * STOCKER 심볼 (300x45)
 * THiRA JSON: Modeler/symbols/sem/STOCKER.json
 * - stk_bg x2: 상단/하단 레일
 * - stk_out: 외곽 초록 프레임
 * - stk_port x44: 포트 슬롯 (22 상단 + 22 하단)
 *
 * 포트 좌표는 THiRA JSON 원본 값 사용.
 * 각 포트 크기: 8.504 x 8.504
 */

import type { SymbolState } from './utils';
import { stateToBgColor } from './utils';

interface StockerSymbolProps {
  width?: number;
  height?: number;
  label?: string;
  state?: SymbolState;
  /** 활성화된 포트 인덱스 집합 (상단 0-21, 하단 22-43) */
  activePorts?: Set<number>;
  className?: string;
}

// 22개 포트 X 좌표 (THiRA JSON 원본 값)
const PORT_X = [
  12.907, 34.157, 44.532, 56.032, 66.407, 76.782,
  87.157, 97.532, 109.407, 119.782, 130.157, 140.532,
  152.034, 162.409, 172.784, 183.159, 193.534, 203.909,
  214.284, 226.032, 236.407, 246.782,
];
const PORT_W = 8.504;
const PORT_H = 8.504;
const TOP_PORT_Y = 5.75;
const BOT_PORT_Y = 31.375;

export function StockerSymbol({
  width = 300,
  height = 45,
  label,
  state = 'Offline',
  activePorts,
  className,
}: StockerSymbolProps) {
  const bgColor = stateToBgColor(state);

  return (
    <svg
      viewBox="0 0 300 45"
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* stk_out: 외곽 초록 프레임 */}
      <rect
        x={3.117}
        y={1.92}
        width={295.334}
        height={41.668}
        fill="none"
        stroke="#07783d"
        strokeWidth={2}
      />

      {/* stk_bg 상단 레일 */}
      <rect
        x={3.375}
        y={3.887}
        width={293.167}
        height={10.625}
        fill="#ededed"
        stroke="none"
      />

      {/* stk_bg 하단 레일 */}
      <rect
        x={3.375}
        y={30.962}
        width={293.167}
        height={10.626}
        fill="#ededed"
        stroke="none"
      />

      {/* 상단 포트 x22 */}
      {PORT_X.map((x, i) => (
        <rect
          key={`top-${i}`}
          x={x}
          y={TOP_PORT_Y}
          width={PORT_W}
          height={PORT_H}
          fill={activePorts?.has(i) ? bgColor : '#42b75d'}
          stroke="rgb(7,120,62)"
          strokeWidth={0.5}
        />
      ))}

      {/* 하단 포트 x22 */}
      {PORT_X.map((x, i) => (
        <rect
          key={`bot-${i}`}
          x={x}
          y={BOT_PORT_Y}
          width={PORT_W}
          height={PORT_H}
          fill={activePorts?.has(i + 22) ? bgColor : '#42b75d'}
          stroke="rgb(7,120,62)"
          strokeWidth={0.5}
        />
      ))}

      {/* 레이블 */}
      {label && (
        <text x={150} y={25} textAnchor="middle" fontSize={6} fill="#333" fontWeight="bold">
          {label}
        </text>
      )}
    </svg>
  );
}
