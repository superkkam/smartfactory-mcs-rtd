/** THiRA JSON 심볼 → SVG 변환 유틸리티 */

/**
 * THiRA segments 배열을 SVG path d 속성 문자열로 변환.
 * - 1: M (moveTo)
 * - 2: L (lineTo)
 * - 3: corner marker — 2쌍 소비, SVG 명령 없음
 * - 4: C (cubic bezier, 3쌍 소비)
 */
export function segmentsToPath(points: number[], segments: number[]): string {
  let d = '';
  let pi = 0;
  for (const seg of segments) {
    if (seg === 1) {
      d += `M ${points[pi * 2]} ${points[pi * 2 + 1]} `;
      pi++;
    } else if (seg === 2) {
      d += `L ${points[pi * 2]} ${points[pi * 2 + 1]} `;
      pi++;
    } else if (seg === 3) {
      // corner marker: 2쌍을 소비하지만 SVG 경로 명령 없음
      pi += 2;
    } else if (seg === 4) {
      d += `C ${points[pi * 2]} ${points[pi * 2 + 1]} `;
      d += `${points[pi * 2 + 2]} ${points[pi * 2 + 3]} `;
      d += `${points[pi * 2 + 4]} ${points[pi * 2 + 5]} `;
      pi += 3;
    }
  }
  return d.trimEnd() + ' Z';
}

/** points 배열을 SVG polygon points 문자열로 변환 */
export function pointsToPolygon(points: number[]): string {
  const pairs: string[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    pairs.push(`${points[i]},${points[i + 1]}`);
  }
  return pairs.join(' ');
}

/** 라디안 → 도(degree) 변환 */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export type SymbolState = 'Online' | 'Offline' | 'Error';

/** 장비 상태 → 배경색 매핑 */
export function stateToBgColor(state: SymbolState): string {
  switch (state) {
    case 'Online':  return 'rgb(2,100,161)';
    case 'Error':   return 'rgb(200,30,30)';
    case 'Offline':
    default:        return 'rgb(161,161,161)';
  }
}

/** 장비 상태 → 테두리색 매핑 */
export function stateToBorderColor(state: SymbolState): string {
  switch (state) {
    case 'Online':  return 'rgb(0,60,120)';
    case 'Error':   return 'rgb(140,0,0)';
    case 'Offline':
    default:        return 'rgb(26,27,28)';
  }
}
