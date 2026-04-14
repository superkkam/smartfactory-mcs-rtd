/**
 * PROCESS 설비 심볼 (100x40)
 * THiRA JSON: Content/storage/symbol/process/PROCESS_2.json
 * - comp[0]: 메인 본체 윤곽 (장비 상태 색상)
 * - comp[1]: 회전 샤프트 (rect, rotation=90°)
 * - comp[2]: 외곽 테두리 (rect 100x40)
 * - comp[3]: 수직 파이프 (rect, rotation=90°)
 * - comp[4-6]: 챔버 상단 패널 x3
 * - comp[7-9]: 챔버 내부 라운드 패널 x3 (roundRect)
 * - comp[10-12]: 챔버 연결 핀 x3 (rect)
 */

import type { SymbolState } from './utils';
import { segmentsToPath, stateToBgColor, radToDeg } from './utils';

interface ProcessSymbolProps {
  width?: number;
  height?: number;
  label?: string;
  state?: SymbolState;
  className?: string;
}

// comp[0] 메인 본체 윤곽 (rounded bottom corners)
// segments: [1, 2, 4, 2, 2, 4, 2, 4]
const BODY_POINTS = [
  0, 0.30874, 0, 39.44098,
  0, 39.74973, 0.772, 39.99997, 1.72423, 39.99997,
  75.86211, 39.99997, 98.27576, 39.99997,
  99.228, 39.99997, 100, 39.74973, 100, 39.44098,
  100, 0.30874, 100, 0, 100, 0.30874, 100, 0.30874,
];
const BODY_SEGS = [1, 2, 4, 2, 2, 4, 2, 4];

export function ProcessSymbol({
  width = 200,
  height = 80,
  label,
  state = 'Offline',
  className,
}: ProcessSymbolProps) {
  const bgColor = stateToBgColor(state);

  // comp[1]: 회전 샤프트 rect [81.466, 21.466, 13.935, 23.134], rotation=90°
  const shaft1 = { x: 81.466, y: 21.466, w: 13.935, h: 23.134 };
  const shaft1Deg = radToDeg(1.5708); // 90°

  // comp[3]: 수직 파이프 rect [66.622, -7.373, 3.921, 62.836], rotation=90°
  const pipe = { x: 66.622, y: -7.373, w: 3.921, h: 62.836 };
  const pipeDeg = radToDeg(1.5708); // 90°

  // comp[13]: 중간 샤프트 rect [58.331, 21.466, 13.935, 23.134], rotation=90°
  const shaft2 = { x: 58.331, y: 21.466, w: 13.935, h: 23.134 };

  // comp[14]: 하단 샤프트 rect [38.48, 24.749, 13.935, 16.567], rotation=90°
  const shaft3 = { x: 38.48, y: 24.749, w: 13.935, h: 16.567 };

  return (
    <svg
      viewBox="0 0 100 40"
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* comp[0]: 메인 본체 (상태 색상, rounded bottom) */}
      <path
        d={segmentsToPath(BODY_POINTS, BODY_SEGS)}
        fill={bgColor}
        fillRule="evenodd"
      />

      {/* comp[2]: 외곽 테두리 */}
      <rect x={0} y={0} width={100} height={40} fill="none" stroke="#979797" strokeWidth={1} />

      {/* comp[3]: 수직 파이프 (rotation=90°, 세로 스트라이프) */}
      <rect
        x={pipe.x}
        y={pipe.y}
        width={pipe.w}
        height={pipe.h}
        fill="rgb(61,61,61)"
        stroke="#979797"
        strokeWidth={1}
        transform={`rotate(${pipeDeg}, ${pipe.x + pipe.w / 2}, ${pipe.y + pipe.h / 2})`}
      />

      {/* comp[1]: 우측 샤프트 (rotation=90°) */}
      <rect
        x={shaft1.x}
        y={shaft1.y}
        width={shaft1.w}
        height={shaft1.h}
        fill="none"
        stroke="#979797"
        strokeWidth={1}
        transform={`rotate(${shaft1Deg}, ${shaft1.x + shaft1.w / 2}, ${shaft1.y + shaft1.h / 2})`}
      />

      {/* comp[4-6]: 챔버 상단 패널 x3 */}
      <rect x={12.5} y={0} width={25} height={20} fill="none" stroke="#979797" strokeWidth={1} />
      <rect x={37.5} y={0} width={25} height={20} fill="none" stroke="#979797" strokeWidth={1} />
      <rect x={62.5} y={0} width={25} height={20} fill="none" stroke="#979797" strokeWidth={1} />

      {/* comp[7-9]: 챔버 내부 라운드 패널 x3 (roundRect) */}
      <rect x={15} y={5} width={20} height={10} rx={2} ry={2} fill="rgb(79,79,79)" stroke="#979797" />
      <rect x={40} y={5} width={20} height={10} rx={2} ry={2} fill="rgb(79,79,79)" stroke="#979797" />
      <rect x={65} y={5} width={20} height={10} rx={2} ry={2} fill="rgb(79,79,79)" stroke="#979797" />

      {/* comp[10-12]: 챔버 연결 핀 x3 */}
      <rect x={23.5} y={17.5} width={3} height={1} fill="rgb(80,80,80)" stroke="#979797" />
      <rect x={48.5} y={17.5} width={3} height={1} fill="rgb(80,80,80)" stroke="#979797" />
      <rect x={73.5} y={17.5} width={3} height={1} fill="rgb(80,80,80)" stroke="#979797" />

      {/* comp[13]: 중간 샤프트 */}
      <rect
        x={shaft2.x}
        y={shaft2.y}
        width={shaft2.w}
        height={shaft2.h}
        fill="none"
        stroke="#979797"
        strokeWidth={1}
        transform={`rotate(${shaft1Deg}, ${shaft2.x + shaft2.w / 2}, ${shaft2.y + shaft2.h / 2})`}
      />

      {/* comp[14]: 하단 샤프트 */}
      <rect
        x={shaft3.x}
        y={shaft3.y}
        width={shaft3.w}
        height={shaft3.h}
        fill="none"
        stroke="#979797"
        strokeWidth={1}
        transform={`rotate(${shaft1Deg}, ${shaft3.x + shaft3.w / 2}, ${shaft3.y + shaft3.h / 2})`}
      />

      {/* 레이블 */}
      {label && (
        <text x={50} y={45} textAnchor="middle" fontSize={4} fill="#333">
          {label}
        </text>
      )}
    </svg>
  );
}
