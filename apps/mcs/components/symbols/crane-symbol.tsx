/**
 * CRANE 심볼 (21x22)
 * THiRA JSON: Modeler/symbols/sem/CRANE.json
 * - comp[0,1]: 대각선 지지 보 (라인)
 * - comp[2,3]: 바퀴 측면 쐐기 (폴리곤)
 * - comp[4,5]: 수직 다리 (라인)
 * - comp[6]: crane_state_bg — 메인 본체 폴리곤 (장비 상태 색상)
 * - comp[7,8]: 바퀴 (oval)
 * - comp[9-13]: 상단 화물 칸 (rect x5)
 */

import type { SymbolState } from './utils';
import { stateToBgColor, stateToBorderColor, pointsToPolygon } from './utils';

interface CraneSymbolProps {
  width?: number;
  height?: number;
  label?: string;
  state?: SymbolState;
  className?: string;
}

// comp[6] crane_state_bg 폴리곤 포인트
const BODY_POINTS = [
  3.24758, 16.32467, 0.44471, 16.32467, 0.44471, 21.78593,
  5.90672, 21.81453, 5.90672, 19.32694, 15.11367, 19.29834,
  15.11367, 21.81453, 20.44472, 21.81453, 20.44472, 16.32467,
  17.80141, 16.32467, 17.68704, 3.11471, 15.11367, 3.11471,
  15.11367, 16.32467, 12.59748, 16.32467, 12.5403, 14.83784,
  11.42517, 14.83784, 11.42517, 13.7799, 9.44471, 13.7799,
  9.42366, 14.83784, 8.39431, 14.83784, 8.36572, 16.32467,
  5.90672, 16.32467, 5.90672, 3.11471, 18.94536, 3.11471,
  18.94536, 0.13778, 16.51117, 0.13778, 16.51117, 0.96449,
  4.17946, 0.96449, 4.17946, 0.13778, 1.65341, 0.13778,
  1.65341, 3.11471, 3.24758, 3.11471, 3.27617, 16.32467,
];

// comp[2] 좌측 바퀴 쐐기 폴리곤
const WEDGE_L_POINTS = [
  3.52192, 16.64355, 2.13247, 14.20978, -0.23964, 14.20978,
  0.30938, 14.77868, 1.26916, 14.99849, 1.49195, 16.64355,
  3.52192, 16.64355,
];

// comp[3] 우측 바퀴 쐐기 폴리곤
const WEDGE_R_POINTS = [
  17.47906, 16.64355, 18.86652, 14.20978, 21.23963, 14.20978,
  20.69061, 14.77868, 19.72983, 14.9965, 19.50804, 16.64355,
  17.47906, 16.64355,
];

export function CraneSymbol({
  width = 63,
  height = 66,
  label,
  state = 'Offline',
  className,
}: CraneSymbolProps) {
  const bgColor = stateToBgColor(state);
  const borderColor = stateToBorderColor(state);

  return (
    <svg
      viewBox="0 0 21 22"
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* comp[4,5]: 수직 다리 */}
      <line x1={1.970} y1={3.021} x2={1.868} y2={15.410} stroke="rgb(31,36,38)" strokeWidth={0.3} />
      <line x1={18.910} y1={3.021} x2={18.808} y2={15.410} stroke="rgb(31,36,38)" strokeWidth={0.3} />

      {/* comp[0,1]: 대각선 지지 보 */}
      <line x1={5.674} y1={9.331} x2={7.182} y2={16.366} stroke="rgb(31,36,38)" strokeWidth={0.5} />
      <line x1={13.690} y1={16.366} x2={15.359} y2={9.331} stroke="rgb(31,36,38)" strokeWidth={0.5} />

      {/* comp[6]: 메인 본체 (상태 색상) */}
      <polygon
        points={pointsToPolygon(BODY_POINTS)}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={0.5}
      />

      {/* comp[2,3]: 바퀴 측면 쐐기 */}
      <polygon points={pointsToPolygon(WEDGE_L_POINTS)} fill="rgb(31,36,38)" />
      <polygon points={pointsToPolygon(WEDGE_R_POINTS)} fill="rgb(31,36,38)" />

      {/* comp[7]: 좌측 바퀴 (oval) */}
      <ellipse cx={3.174} cy={19.126} rx={1.75} ry={1.75} fill="rgb(255,255,255)" stroke="rgb(28,28,28)" strokeWidth={0.5} />
      {/* comp[8]: 우측 바퀴 (oval) */}
      <ellipse cx={17.859} cy={19.126} rx={1.75} ry={1.75} fill="rgb(255,255,255)" stroke="rgb(28,28,28)" strokeWidth={0.5} />

      {/* comp[9-13]: 상단 화물 칸 (rect x5) */}
      <rect x={6.708} y={1.605} width={1.822} height={0.8} fill="rgb(252,252,252)" stroke="rgb(0,0,0)" strokeWidth={0.2} />
      <rect x={9.402} y={1.605} width={1.822} height={0.8} fill="rgb(252,252,252)" stroke="rgb(0,0,0)" strokeWidth={0.2} />
      <rect x={12.097} y={1.605} width={1.822} height={0.8} fill="rgb(252,252,252)" stroke="rgb(0,0,0)" strokeWidth={0.2} />
      <rect x={14.791} y={1.605} width={1.822} height={0.8} fill="rgb(252,252,252)" stroke="rgb(0,0,0)" strokeWidth={0.2} />
      <rect x={4.013} y={1.605} width={1.822} height={0.8} fill="rgb(252,252,252)" stroke="rgb(0,0,0)" strokeWidth={0.2} />

      {/* 레이블 */}
      {label && (
        <text x={10.5} y={23.5} textAnchor="middle" fontSize={2} fill="#333">
          {label}
        </text>
      )}
    </svg>
  );
}
