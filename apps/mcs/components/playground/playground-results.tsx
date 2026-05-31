'use client';

import type { PlaygroundResponse } from '@/lib/api/ai-engine';
import type { AlgoResult } from './playground-grid';
import { ALGO_COLORS } from './playground-grid';

interface PlaygroundResultsProps {
  result: PlaygroundResponse | null;
  algorithm: string;
  isRunning: boolean;
  comparisonResults?: AlgoResult[];
}

const ALGO_LABEL: Record<string, string> = {
  astar:       'A* (Dijkstra)',
  ai_ppo:      'AI (PPO)',
  cbs_ts:      'CBS-TS',
  prioritized: 'Prioritized',
};

const ALGO_BADGE: Record<string, string> = {
  astar:       'bg-red-50 text-red-700 border-red-200',
  ai_ppo:      'bg-blue-50 text-blue-700 border-blue-200',
  cbs_ts:      'bg-violet-50 text-violet-700 border-violet-200',
  prioritized: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function PlaygroundResults({ result, algorithm, isRunning, comparisonResults }: PlaygroundResultsProps) {
  const isCompare = comparisonResults && comparisonResults.length > 0;

  if (isRunning) {
    return <div className="py-6 text-center text-sm text-gray-400 animate-pulse">경로 계산 중…</div>;
  }

  if (!result && !isCompare) {
    return <div className="py-6 text-center text-sm text-gray-300">실행 버튼을 눌러 경로를 계산하세요</div>;
  }

  // ── 비교 모드 테이블 ───────────────────────────────────────────────
  if (isCompare) {
    const best = {
      cost:      Math.min(...comparisonResults!.map((r) => r.response.cost)),
      makespan:  Math.min(...comparisonResults!.map((r) => r.response.makespan)),
      conflicts: Math.min(...comparisonResults!.map((r) => r.response.conflict_count)),
      runtime:   Math.min(...comparisonResults!.map((r) => r.response.runtime_ms)),
    };

    return (
      <div className="space-y-3">
        <p className="text-[10px] font-medium text-gray-500">알고리즘 비교 (같은 시나리오)</p>

        {/* 범례 */}
        <div className="flex flex-wrap gap-1.5">
          {comparisonResults!.map(({ algorithm: alg }) => (
            <span key={alg} className="flex items-center gap-1 text-[10px] font-medium">
              <span className="inline-block w-5 h-1.5 rounded" style={{ backgroundColor: ALGO_COLORS[alg] ?? '#6b7280' }} />
              {ALGO_LABEL[alg] ?? alg}
            </span>
          ))}
        </div>

        {/* 비교 테이블 */}
        <div className="overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-[10px] text-gray-400 border-b border-gray-100">
                <th className="text-left py-1 pr-2">알고리즘</th>
                <th className="text-right py-1 px-1">SOC</th>
                <th className="text-right py-1 px-1">Makespan</th>
                <th className="text-right py-1 px-1">충돌</th>
                <th className="text-right py-1 pl-1">ms</th>
              </tr>
            </thead>
            <tbody>
              {comparisonResults!.map(({ algorithm: alg, response: r }) => (
                <tr key={alg} className="border-b border-gray-50">
                  <td className="py-1.5 pr-2">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ALGO_COLORS[alg] ?? '#6b7280' }} />
                      <span className="font-medium text-gray-700">{ALGO_LABEL[alg] ?? alg}</span>
                      {r.fallback && <span className="text-[9px] text-amber-500">폴백</span>}
                    </span>
                  </td>
                  <td className={`text-right py-1.5 px-1 font-semibold ${r.cost === best.cost ? 'text-emerald-600' : 'text-gray-600'}`}>
                    {r.cost.toFixed(1)}
                  </td>
                  <td className={`text-right py-1.5 px-1 font-semibold ${r.makespan === best.makespan ? 'text-emerald-600' : 'text-gray-600'}`}>
                    {r.makespan}
                  </td>
                  <td className={`text-right py-1.5 px-1 font-semibold ${r.conflict_count === 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {r.conflict_count}
                  </td>
                  <td className={`text-right py-1.5 pl-1 ${r.runtime_ms === best.runtime ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {r.runtime_ms.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] text-gray-300">초록색 = 해당 지표 최우수</p>
      </div>
    );
  }

  // ── 단일 알고리즘 결과 ─────────────────────────────────────────────
  if (!result) return null;

  const metrics = [
    { label: 'Sum of Costs',   value: result.cost.toFixed(1),             unit: '' },
    { label: 'Makespan',       value: result.makespan.toString(),          unit: 'steps' },
    { label: '충돌 수',        value: result.conflict_count.toString(),    unit: '',
      highlight: result.conflict_count > 0 ? 'text-red-600' : 'text-emerald-600' },
    { label: '계산 시간',      value: result.runtime_ms.toFixed(1),       unit: 'ms' },
    { label: '에이전트',       value: result.agent_paths.length.toString(), unit: '개' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-medium border rounded px-2 py-0.5 ${ALGO_BADGE[algorithm] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
          {ALGO_LABEL[algorithm] ?? algorithm}
        </span>
        {result.fallback && (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5">
            ⚠ A* 폴백
          </span>
        )}
        {result.conflict_count === 0 && result.agent_paths.length > 1 && (
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-0.5">
            ✓ 충돌 없음
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {metrics.map(({ label, value, unit, highlight }) => (
          <div key={label} className="rounded bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-[10px] text-gray-400">{label}</p>
            <p className={`text-sm font-semibold ${highlight ?? 'text-gray-900'}`}>
              {value} <span className="text-[10px] font-normal text-gray-400">{unit}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="rounded bg-gray-50 border border-gray-100 px-3 py-2 space-y-1">
        <p className="text-[10px] font-medium text-gray-500">에이전트별 경로 길이</p>
        {result.agent_paths.map((ap, i) => (
          <p key={ap.agent_id} className="text-xs text-gray-700">
            Agent {i + 1}: {ap.path.length - 1} steps
            ({ap.path[0]?.[0]},{ap.path[0]?.[1]} → {ap.path.at(-1)?.[0]},{ap.path.at(-1)?.[1]})
          </p>
        ))}
      </div>
    </div>
  );
}
