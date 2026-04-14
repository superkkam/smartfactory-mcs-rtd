/**
 * AGV 심볼 (100x100)
 * THiRA JSON: Modeler/symbols/sem/AGV.json
 * - comp[0-2]: 바퀴 (oval x3)
 * - comp[3]: 메인 본체 (rect)
 * - comp[4-15]: 암/캐빈 구조물 (shape)
 */

import type { SymbolState } from './utils';
import { segmentsToPath, pointsToPolygon } from './utils';

interface AgvSymbolProps {
  width?: number;
  height?: number;
  label?: string;
  state?: SymbolState;
  className?: string;
}

// comp[4] 사이드 패널 폴리곤 (segments 없음)
const SIDE_PANEL_POINTS = [60, 44.074, 60, 57.325, 68, 47.673, 68, 34.044, 60, 44.074];

// comp[5] 상단 패널 폴리곤
const TOP_PANEL_POINTS = [31.983, 44.004, 60.017, 44.004, 68.017, 34.004, 41.948, 34.004, 32.017, 44.004];

// comp[6] 창문 폴리곤
const WINDOW_POINTS = [34.206, 43.377, 39.623, 37.727, 66.013, 37.688, 62.453, 42.990, 34.129, 43.338];

// comp[7] 모서리 패널 (segments: [1, 2, 2, 4, 4, 2])
const CORNER_POINTS = [
  62.41387, 41.02509, 63.66, 43.28, 66.88, 39.34,
  66.88, 39.34, 68.08969, 37.99454, 67.48, 37.08,
  66.88, 36.18, 66.10291, 36.53767, 66.10291, 36.53767,
  62.46893, 41.02509,
];
const CORNER_SEGS = [1, 2, 2, 4, 4, 2];

// comp[8] 곡면 디테일 (segments: [1, 2, 4, 4])
const CURVE_POINTS = [
  62.38111, 41.04482, 62.38111, 44.00441,
  62.38111, 44.00441, 64.10784, 43.71728, 63.93563, 42.251,
  63.76342, 40.78472, 62.38111, 41.04482, 62.38111, 41.04482,
];
const CURVE_SEGS = [1, 2, 4, 4];

// comp[9] 어두운 패널 폴리곤
const DARK_PANEL_POINTS = [
  43.861, 35.862, 43.861, 35.862, 38.185, 41.860,
  57.987, 41.860, 63.018, 35.862, 43.861, 35.862,
];

// comp[10] 그림자 폴리곤
const SHADOW_POINTS = [
  60, 54.969, 68.077, 45.408, 68.470, 45.888,
  68.208, 46.631, 61.266, 55.144, 60.524, 55.406, 60, 54.925,
];

// comp[11] 사이드 트랙 (segments: [1, 4, 4, 2, 2, 2, 2, 2, 2, 4, 4])
const TRACK_POINTS = [
  60, 59.01, 60, 59.01, 60.27972, 59.01, 60.564, 59.01,
  60.84828, 59.01, 61.13711, 58.73305, 61.13711, 58.73305,
  68.76078, 49.06, 68.76078, 46.3921, 68.48199, 45.80289,
  67.98, 45.40809, 67.98, 46.79488, 61.13711, 54.84315,
  61.13711, 54.84315, 60.84828, 55.062, 60.564, 55.062,
  60.27972, 55.062, 60, 55.062, 60, 55.062,
];
const TRACK_SEGS = [1, 4, 4, 2, 2, 2, 2, 2, 2, 4, 4];

// comp[12] 금속판 디테일 폴리곤
const METAL_A_POINTS = [64.765, 45.408, 65.672, 46.373, 65.672, 49.468, 64.765, 50.588, 63.585, 46.373, 64.465, 45.408];
const METAL_B_POINTS = [63.585, 46.335, 63.636, 50.572, 64.785, 50.572, 64.682, 47.535, 63.943, 46.335, 63.585, 46.335];

// comp[15] 금속판 C 폴리곤
const METAL_C_POINTS = [64.683, 47.528, 65.663, 46.408, 65.663, 49.488, 64.783, 50.568, 64.683, 47.488];

export function AgvSymbol({
  width = 100,
  height = 100,
  label,
  state: _state = 'Offline',
  className,
}: AgvSymbolProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* 본체 그라디언트 (linear.east) */}
        <linearGradient id="agv-body-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(163,163,163)" />
          <stop offset="100%" stopColor="rgb(245,245,245)" />
        </linearGradient>
        {/* 상단 패널 그라디언트 */}
        <linearGradient id="agv-top-grad" x1="1" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="rgb(171,171,171)" />
          <stop offset="100%" stopColor="rgb(220,220,220)" />
        </linearGradient>
        {/* 트랙 그라디언트 (linear.west) */}
        <linearGradient id="agv-track-grad" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="rgb(0,0,0)" />
          <stop offset="100%" stopColor="rgb(107,107,107)" />
        </linearGradient>
      </defs>

      {/* comp[3]: 메인 본체 rect */}
      <rect
        x={31.967}
        y={44.004}
        width={28.033}
        height={14.996}
        fill="url(#agv-body-grad)"
        stroke="#979797"
      />

      {/* comp[5]: 상단 패널 */}
      <polygon
        points={pointsToPolygon(TOP_PANEL_POINTS)}
        fill="url(#agv-top-grad)"
        stroke="#979797"
      />

      {/* comp[4]: 사이드 패널 */}
      <polygon
        points={pointsToPolygon(SIDE_PANEL_POINTS)}
        fill="rgb(117,117,117)"
        stroke="#979797"
      />

      {/* comp[6]: 창문 */}
      <polygon points={pointsToPolygon(WINDOW_POINTS)} stroke="#979797" fill="none" />

      {/* comp[9]: 어두운 내부 패널 */}
      <polygon points={pointsToPolygon(DARK_PANEL_POINTS)} fill="rgb(38,38,38)" stroke="#979797" />

      {/* comp[7]: 모서리 패널 */}
      <path
        d={segmentsToPath(CORNER_POINTS, CORNER_SEGS)}
        fill="rgb(106,103,120)"
        stroke="#979797"
      />

      {/* comp[8]: 곡면 디테일 */}
      <path
        d={segmentsToPath(CURVE_POINTS, CURVE_SEGS)}
        fill="rgb(137,138,156)"
        stroke="#979797"
      />

      {/* comp[10]: 그림자 */}
      <polygon points={pointsToPolygon(SHADOW_POINTS)} fill="rgb(5,5,5)" stroke="#979797" />

      {/* comp[11]: 사이드 트랙 */}
      <path
        d={segmentsToPath(TRACK_POINTS, TRACK_SEGS)}
        fill="url(#agv-track-grad)"
        stroke="rgb(0,0,0)"
      />

      {/* comp[12,13,15]: 금속판 디테일 */}
      <polygon points={pointsToPolygon(METAL_A_POINTS)} fill="rgb(224,224,224)" stroke="#979797" />
      <polygon points={pointsToPolygon(METAL_B_POINTS)} fill="rgb(237,237,237)" stroke="#979797" />
      <polygon points={pointsToPolygon(METAL_C_POINTS)} fill="rgb(189,187,187)" stroke="#979797" />

      {/* comp[14]: 축 (tiny oval) */}
      <ellipse cx={64.855} cy={46.408} rx={0.26} ry={0.25} fill="rgb(69,69,69)" stroke="rgb(64,64,64)" strokeWidth={0.1} />

      {/* comp[0-2]: 바퀴 */}
      <ellipse cx={65.013} cy={51.61} rx={2} ry={2} fill="rgb(64,64,64)" stroke="#979797" strokeWidth={1} />
      <ellipse cx={37.129} cy={58.324} rx={2} ry={2} fill="rgb(64,64,64)" stroke="#979797" strokeWidth={1} />
      <ellipse cx={58} cy={58.324} rx={2} ry={2} fill="rgb(64,64,64)" stroke="#979797" strokeWidth={1} />

      {/* 레이블 */}
      {label && (
        <text x={50} y={72} textAnchor="middle" fontSize={5} fill="#333">
          {label}
        </text>
      )}
    </svg>
  );
}
