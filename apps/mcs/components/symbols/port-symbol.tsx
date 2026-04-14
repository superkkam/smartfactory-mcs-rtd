/**
 * PORT 심볼 (9x9)
 * THiRA JSON: Modeler/symbols/sem/PORT.json
 * - comp[0]: rect 배경 (장비 상태 색상)
 * - comp[1]: triangle 방향 지시자
 */

import type { SymbolState } from './utils';
import { stateToBgColor, stateToBorderColor, radToDeg } from './utils';

interface PortSymbolProps {
  width?: number;
  height?: number;
  label?: string;
  state?: SymbolState;
  className?: string;
}

export function PortSymbol({
  width = 36,
  height = 36,
  label,
  state = 'Offline',
  className,
}: PortSymbolProps) {
  const bgColor = stateToBgColor(state);
  const borderColor = stateToBorderColor(state);

  // comp[0]: rect [0.228, 0.254, 8.5, 8.5], rotation: π (180°) — 정사각형이라 무관
  const rx = 0.228, ry = 0.254, rw = 8.5, rh = 8.5;

  // comp[1]: triangle rect [1.894, 2.264, 5.17, 4.48], rotation: π
  // 위쪽 삼각형 꼭짓점 (회전 전): 상단 중앙, 하단 좌, 하단 우
  const tx = 1.894, ty = 2.264, tw = 5.17, th = 4.48;
  const tcx = tx + tw / 2; // 4.479
  const tcy = ty + th / 2; // 4.504
  const trianglePoints = `${tcx},${ty} ${tx},${ty + th} ${tx + tw},${ty + th}`;
  const rotateDeg = radToDeg(Math.PI); // 180

  return (
    <svg
      viewBox="0 0 9 9"
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 배경 사각형 */}
      <rect
        x={rx}
        y={ry}
        width={rw}
        height={rh}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={0.5}
      />
      {/* 방향 삼각형 (180° 회전 → 아래 방향) */}
      <polygon
        points={trianglePoints}
        fill="rgb(255,255,255)"
        stroke="#979797"
        strokeWidth={0.3}
        transform={`rotate(${rotateDeg}, ${tcx}, ${tcy})`}
      />
      {/* 레이블 */}
      {label && (
        <text
          x={4.5}
          y={10.5}
          textAnchor="middle"
          fontSize={2}
          fill="#333"
        >
          {label}
        </text>
      )}
    </svg>
  );
}
