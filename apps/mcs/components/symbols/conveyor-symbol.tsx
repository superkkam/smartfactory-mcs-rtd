/**
 * CONVEYOR 심볼 (14x12)
 * THiRA JSON: Modeler/symbols/sem/CONVEYOR.json
 * - con_side: 좌측 패널
 * - con_bg: 메인 본체
 * - con_l (x2): 좌우 프레임
 * - con_roll1 (x4): 밝은 롤러
 * - con_roll2 (x4): 어두운 롤러
 * - con_state_bg: 상태 히트 영역
 */

import type { SymbolState } from './utils';

interface ConveyorSymbolProps {
  width?: number;
  height?: number;
  label?: string;
  state?: SymbolState;
  className?: string;
}

// 롤러 캡슐 경로 (base: y=[0.02, 0.99], x=[3.58, 12.99])
// THiRA segments: [1, 2, 4, 4, 2, 4, 4, 2]
const ROLLER_PATH =
  'M 12.55087 0.99181 L 4.01919 0.99181 ' +
  'C 3.7793 0.99181 3.58455 0.77391 3.58455 0.50549 ' +
  'C 3.58455 0.23707 3.7793 0.01916 4.01919 0.01916 ' +
  'L 12.55087 0.01916 ' +
  'C 12.79077 0.01916 12.98551 0.23707 12.98551 0.50549 ' +
  'C 12.98551 0.77391 12.79077 0.99181 12.55087 0.99181 Z';

// 밝은 롤러 Y 오프셋 (con_roll1): base y_center=0.505 → offsets
const LIGHT_ROLLER_Y = [0, 3.019, 6.038, 9.057]; // translateY 값
// 어두운 롤러 Y 오프셋 (con_roll2): base y=1.530 (delta ~1.51씩)
const DARK_ROLLER_BASE_Y = 1.51; // con_roll2 첫 번째 y 시작
const DARK_ROLLER_Y = [DARK_ROLLER_BASE_Y, DARK_ROLLER_BASE_Y + 3.019, DARK_ROLLER_BASE_Y + 6.038, DARK_ROLLER_BASE_Y + 9.057];

export function ConveyorSymbol({
  width = 56,
  height = 48,
  label,
  state: _state = 'Offline',
  className,
}: ConveyorSymbolProps) {
  return (
    <svg
      viewBox="0 0 14 12"
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* 밝은 롤러 그라디언트 (spread.vertical 근사) */}
        <linearGradient id="conv-roll-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(153,153,153)" />
          <stop offset="50%" stopColor="rgb(212,212,212)" />
          <stop offset="100%" stopColor="rgb(153,153,153)" />
        </linearGradient>
        {/* 어두운 롤러 그라디언트 */}
        <linearGradient id="conv-roll-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(61,68,69)" />
          <stop offset="50%" stopColor="rgb(151,154,166)" />
          <stop offset="100%" stopColor="rgb(61,68,69)" />
        </linearGradient>
      </defs>

      {/* con_side: 좌측 사이드 패널 */}
      <rect
        x={0.287}
        y={3.255}
        width={2.797}
        height={5.5}
        fill="rgb(214,214,214)"
        stroke="rgb(37,44,61)"
        strokeWidth={0.7}
      />

      {/* con_bg: 메인 본체 (rect 3.285~13.285 x, 0.005~12.005 y) */}
      <rect
        x={3.285}
        y={0.005}
        width={10}
        height={12}
        fill="rgb(250,250,245)"
      />

      {/* con_l: 좌측 프레임 */}
      <rect x={2.785} y={0.005} width={1} height={12} fill="rgb(37,44,61)" />
      {/* con_l: 우측 프레임 */}
      <rect x={12.785} y={0.005} width={1} height={12} fill="rgb(37,44,61)" />

      {/* 밝은 롤러 x4 (con_roll1) */}
      {LIGHT_ROLLER_Y.map((dy, i) => (
        <path
          key={`light-${i}`}
          d={ROLLER_PATH}
          fill="url(#conv-roll-light)"
          transform={`translate(0, ${dy})`}
        />
      ))}

      {/* 어두운 롤러 x4 (con_roll2) */}
      {DARK_ROLLER_Y.map((dy, i) => (
        <path
          key={`dark-${i}`}
          d={ROLLER_PATH}
          fill="url(#conv-roll-dark)"
          transform={`translate(0, ${dy})`}
        />
      ))}

      {/* 레이블 */}
      {label && (
        <text x={7} y={13.5} textAnchor="middle" fontSize={1.5} fill="#333">
          {label}
        </text>
      )}
    </svg>
  );
}
