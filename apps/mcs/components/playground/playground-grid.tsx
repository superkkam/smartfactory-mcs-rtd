'use client';

import { useCallback } from 'react';
import type { AgentPath, PlaygroundResponse } from '@/lib/api/ai-engine';

export type CellState = 'empty' | 'obstacle' | 'start' | 'goal';

export interface GridCell {
  col: number;
  row: number;
  state: CellState;
  agentIndex?: number; // 0~N (start/goal 에이전트 인덱스)
}

export interface AlgoResult {
  algorithm: string;
  response: PlaygroundResponse;
}

const AGENT_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6'];

export const ALGO_COLORS: Record<string, string> = {
  astar:       '#ef4444',
  ai_ppo:      '#3b82f6',
  cbs_ts:      '#8b5cf6',
  prioritized: '#10b981',
};

const ALGO_DASH: Record<string, string> = {
  astar:       'none',
  ai_ppo:      '8 3',
  cbs_ts:      '4 2',
  prioritized: '2 2',
};

interface PlaygroundGridProps {
  gridSize: number;
  cells: GridCell[][];
  /** 단일 알고리즘 결과 */
  agentPaths?: AgentPath[];
  /** 비교 모드: 여러 알고리즘 결과 동시 오버레이 */
  comparisonResults?: AlgoResult[];
  replayStep?: number;
  algorithm?: string;
  onCellClick: (col: number, row: number) => void;
  onCellDrag?: (col: number, row: number) => void;
}

const CELL_SIZE = 44;
const PADDING = 8;

export function PlaygroundGrid({
  gridSize,
  cells,
  agentPaths,
  comparisonResults,
  replayStep,
  algorithm = 'astar',
  onCellClick,
  onCellDrag,
}: PlaygroundGridProps) {
  const svgSize = gridSize * CELL_SIZE + PADDING * 2;
  const pathColor = ALGO_COLORS[algorithm] ?? '#6b7280';
  const isCompare = comparisonResults && comparisonResults.length > 0;

  const cx = (col: number) => PADDING + col * CELL_SIZE + CELL_SIZE / 2;
  const cy = (row: number) => PADDING + row * CELL_SIZE + CELL_SIZE / 2;

  // 경로 폴리라인 좌표
  const buildPolyline = useCallback((path: [number, number][]) =>
    path.map(([c, r]) => `${cx(c)},${cy(r)}`).join(' ')
  , [gridSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseDown = useCallback((col: number, row: number, e: React.MouseEvent) => {
    e.preventDefault();
    onCellClick(col, row);
  }, [onCellClick]);

  const handleMouseEnter = useCallback((col: number, row: number, e: React.MouseEvent) => {
    if (e.buttons === 1) onCellDrag?.(col, row);
  }, [onCellDrag]);

  return (
    <svg
      width={svgSize}
      height={svgSize}
      className="select-none rounded border border-gray-200 bg-white"
      style={{ touchAction: 'none' }}
    >
      {/* 격자 셀 */}
      {cells.map((rowArr, row) =>
        rowArr.map((cell, col) => {
          const x = PADDING + col * CELL_SIZE;
          const y = PADDING + row * CELL_SIZE;
          const fill =
            cell.state === 'obstacle' ? '#1f2937' :
            cell.state === 'start'    ? (AGENT_COLORS[cell.agentIndex ?? 0] + 'cc') :
            cell.state === 'goal'     ? (AGENT_COLORS[cell.agentIndex ?? 0] + '66') :
            '#f9fafb';

          return (
            <g key={`${col}-${row}`}>
              <rect
                x={x + 1} y={y + 1}
                width={CELL_SIZE - 2} height={CELL_SIZE - 2}
                rx={4}
                fill={fill}
                stroke={cell.state === 'empty' ? '#e5e7eb' : 'transparent'}
                strokeWidth={1}
                className="cursor-pointer"
                onMouseDown={(e) => handleMouseDown(col, row, e)}
                onMouseEnter={(e) => handleMouseEnter(col, row, e)}
              />
              {/* 셀 라벨 */}
              {cell.state === 'start' && (
                <text x={cx(col)} y={cy(row) + 5} textAnchor="middle" fontSize={13} fill="white" fontWeight={700} style={{ pointerEvents: 'none' }}>
                  S{(cell.agentIndex ?? 0) + 1}
                </text>
              )}
              {cell.state === 'goal' && (
                <text x={cx(col)} y={cy(row) + 5} textAnchor="middle" fontSize={13} fill={AGENT_COLORS[cell.agentIndex ?? 0]} fontWeight={700} style={{ pointerEvents: 'none' }}>
                  G{(cell.agentIndex ?? 0) + 1}
                </text>
              )}
            </g>
          );
        })
      )}

      {/* 단일 알고리즘 경로 */}
      {!isCompare && agentPaths && agentPaths.map((ap, idx) => (
        <polyline
          key={ap.agent_id}
          points={buildPolyline(ap.path)}
          fill="none"
          stroke={pathColor}
          strokeWidth={3}
          strokeOpacity={0.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={idx === 0 ? 'none' : '6 3'}
        />
      ))}

      {/* 비교 모드 — 알고리즘별 색상+대시 오버레이 */}
      {isCompare && comparisonResults!.map(({ algorithm: alg, response }) => {
        const color = ALGO_COLORS[alg] ?? '#6b7280';
        const dash  = ALGO_DASH[alg] ?? 'none';
        return response.agent_paths.map((ap) => (
          <polyline
            key={`${alg}-${ap.agent_id}`}
            points={buildPolyline(ap.path)}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeOpacity={0.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dash}
          />
        ));
      })}

      {/* 재생 스텝 — AMR 상면도 아이콘 */}
      {agentPaths && !isCompare && replayStep !== undefined && replayStep >= 0 &&
        agentPaths.map((ap, idx) => {
          const step = Math.min(replayStep, ap.path.length - 1);
          const [c, r] = ap.path[step];
          const color = AGENT_COLORS[idx % AGENT_COLORS.length];
          const x = cx(c);
          const y = cy(r);
          // 이동 방향 계산 (다음 스텝과의 벡터)
          let angle = 0;
          if (step < ap.path.length - 1) {
            const [nc, nr] = ap.path[step + 1];
            angle = Math.atan2(nr - r, nc - c) * (180 / Math.PI);
          } else if (step > 0) {
            const [pc, pr] = ap.path[step - 1];
            angle = Math.atan2(r - pr, c - pc) * (180 / Math.PI);
          }
          return (
            <g key={`amr-${ap.agent_id}`} transform={`translate(${x},${y}) rotate(${angle})`}>
              {/* 본체 — 가로로 긴 직사각형 */}
              <rect x={-13} y={-8} width={26} height={16} rx={4}
                fill={color} stroke="white" strokeWidth={1.5} />
              {/* 앞바퀴 (진행 방향 오른쪽) */}
              <rect x={10} y={-9} width={5} height={4} rx={1}
                fill="white" opacity={0.85} />
              <rect x={10} y={5} width={5} height={4} rx={1}
                fill="white" opacity={0.85} />
              {/* 뒷바퀴 */}
              <rect x={-15} y={-9} width={5} height={4} rx={1}
                fill="white" opacity={0.85} />
              <rect x={-15} y={5} width={5} height={4} rx={1}
                fill="white" opacity={0.85} />
              {/* 진행 방향 화살표 */}
              <polygon points="14,-3 20,0 14,3"
                fill="white" opacity={0.9} />
              {/* 에이전트 번호 */}
              <text x={-1} y={4} textAnchor="middle" fontSize={9}
                fill="white" fontWeight={700} style={{ pointerEvents: 'none' }}>
                {idx + 1}
              </text>
            </g>
          );
        })
      }

      {/* 비교 모드 재생 — 알고리즘별 AMR (에이전트 0만 표시, 알고리즘 색상) */}
      {isCompare && replayStep !== undefined && replayStep >= 0 &&
        comparisonResults!.map(({ algorithm: alg, response }, algoIdx) => {
          const ap = response.agent_paths[0];
          if (!ap) return null;
          const step = Math.min(replayStep, ap.path.length - 1);
          const [c, r] = ap.path[step];
          const color = ALGO_COLORS[alg] ?? '#6b7280';
          const x = cx(c);
          const y = cy(r);
          let angle = 0;
          if (step < ap.path.length - 1) {
            const [nc, nr] = ap.path[step + 1];
            angle = Math.atan2(nr - r, nc - c) * (180 / Math.PI);
          } else if (step > 0) {
            const [pc, pr] = ap.path[step - 1];
            angle = Math.atan2(r - pr, c - pc) * (180 / Math.PI);
          }
          // Y 오프셋으로 겹침 방지
          const yOff = (algoIdx - (comparisonResults!.length - 1) / 2) * 3;
          return (
            <g key={`amr-cmp-${alg}`} transform={`translate(${x},${y + yOff}) rotate(${angle})`}>
              <rect x={-12} y={-7} width={24} height={14} rx={3}
                fill={color} stroke="white" strokeWidth={1.5} />
              <polygon points="12,-3 18,0 12,3" fill="white" opacity={0.9} />
              <text x={-1} y={4} textAnchor="middle" fontSize={7}
                fill="white" fontWeight={700} style={{ pointerEvents: 'none' }}>
                {alg === 'ai_ppo' ? 'PPO' : alg === 'cbs_ts' ? 'CBS' : alg === 'prioritized' ? 'PP' : 'A*'}
              </text>
            </g>
          );
        })
      }
    </svg>
  );
}
