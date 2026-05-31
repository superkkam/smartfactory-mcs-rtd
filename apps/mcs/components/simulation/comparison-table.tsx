'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SimulationResult, SimulationComparison, PairwisePvalues } from '@workspace/types/mcs';

interface ComparisonTableProps {
  results: SimulationResult[];
  comparison: SimulationComparison;
}

const ALG_META: Record<string, { label: string; color: string }> = {
  astar:       { label: 'A*',           color: 'text-indigo-700' },
  prioritized: { label: 'PP (A*)',      color: 'text-blue-700'   },
  ai_ppo:      { label: 'AI(PPO)',      color: 'text-emerald-700' },
  cbs_ts:      { label: 'CBS-TS',       color: 'text-amber-700'  },
  cactus:      { label: 'CACTUS',       color: 'text-purple-700' },
};

function algLabel(alg: string) { return ALG_META[alg]?.label ?? alg.toUpperCase(); }
function algColor(alg: string) { return ALG_META[alg]?.color ?? 'text-gray-700'; }

interface MetricDef {
  key: keyof SimulationResult;
  ciLowKey?: keyof SimulationResult;
  ciHighKey?: keyof SimulationResult;
  label: string;
  fmt: (v: number) => string;
  higherIsBetter: boolean;
  journal?: boolean;
}

const METRIC_DEFS: MetricDef[] = [
  { key: 'makespan',       ciLowKey: 'makespanCiLow',          ciHighKey: 'makespanCiHigh',
    label: 'Makespan',              fmt: (v) => `${v.toFixed(2)}s`,  higherIsBetter: false, journal: true },
  { key: 'sumOfCosts',
    label: 'Sum of Costs',          fmt: (v) => `${v.toFixed(1)}s`,  higherIsBetter: false, journal: true },
  { key: 'avgTransferTime', ciLowKey: 'avgTransferTimeCiLow', ciHighKey: 'avgTransferTimeCiHigh',
    label: '평균 반송 시간',          fmt: (v) => `${v.toFixed(2)}s`,  higherIsBetter: false },
  { key: 'avgWaitTime',
    label: '평균 AMR 대기 시간',     fmt: (v) => `${v.toFixed(2)}s`,  higherIsBetter: false, journal: true },
  { key: 'amrUtilization',
    label: 'AMR 가동률',            fmt: (v) => `${v.toFixed(1)}%`,  higherIsBetter: true,  journal: true },
  { key: 'equipmentUtilization',
    label: '장비 가동률',            fmt: (v) => `${v.toFixed(1)}%`,  higherIsBetter: true  },
  { key: 'deadlockCount',
    label: '교착 발생 횟수',         fmt: (v) => `${v}회`,             higherIsBetter: false },
  { key: 'deadlockRate',
    label: '교착 발생률 (건/분)',     fmt: (v) => `${v.toFixed(3)}`,   higherIsBetter: false, journal: true },
  { key: 'pathOptimality',
    label: '경로 최적성',            fmt: (v) => `${v.toFixed(1)}%`,  higherIsBetter: true,  journal: true },
  { key: 'conflictCount',
    label: 'MAPF Conflict 횟수',    fmt: (v) => `${v}회`,             higherIsBetter: false, journal: true },
  { key: 'throughput',
    label: '처리량 (캐리어/s)',       fmt: (v) => `${v.toFixed(3)}`,   higherIsBetter: true  },
  { key: 'collisionCount',
    label: '충돌/대기 횟수',         fmt: (v) => `${v}회`,             higherIsBetter: false },
];

function improvementVsAstar(
  astarVal: number | undefined,
  val: number,
  higherIsBetter: boolean,
): number | null {
  if (astarVal == null || astarVal === 0) return null;
  const pct = ((val - astarVal) / Math.abs(astarVal)) * 100;
  return higherIsBetter ? pct : -pct;
}

function findBestIdx(values: (number | undefined)[], higherIsBetter: boolean): number {
  let best = -1;
  let bestVal = higherIsBetter ? -Infinity : Infinity;
  values.forEach((v, i) => {
    if (v == null) return;
    if (higherIsBetter ? v > bestVal : v < bestVal) { bestVal = v; best = i; }
  });
  return best;
}

/** CI 표시 (±형식) */
function CiBadge({ lo, hi }: { lo?: number; hi?: number }) {
  if (lo == null || hi == null) return null;
  const half = (hi - lo) / 2;
  return (
    <span className="ml-1 text-[10px] text-gray-400">
      ±{half.toFixed(2)}
    </span>
  );
}

/** Wilcoxon p-value에서 유의성 별표 추출 */
function getPvalStar(
  pvalues: PairwisePvalues | undefined,
  metricKey: string,
  algA: string,
  algB: string,
): string {
  if (!pvalues) return '';
  const metricMap = pvalues[metricKey as keyof PairwisePvalues] as Record<string, number> | undefined;
  if (!metricMap) return '';
  const pairKey = `${algA}__vs__${algB}`;
  const pairKeyRev = `${algB}__vs__${algA}`;
  const p = metricMap[pairKey] ?? metricMap[pairKeyRev];
  if (p == null) return '';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  return '';
}

const METRIC_TO_PVAL_KEY: Record<string, string> = {
  makespan: 'makespan',
  sumOfCosts: 'sumOfCosts',
  avgTransferTime: 'avgTransferTime',
  pathOptimality: 'pathOptimality',
};

export function ComparisonTable({ results, comparison }: ComparisonTableProps) {
  const astar    = results.find((r) => r.algorithm === 'astar');
  const nonAstar = results.filter((r) => r.algorithm !== 'astar');
  const ordered  = [...(astar ? [astar] : []), ...nonAstar];

  // 다중 시드 결과 여부
  const hasCi = results.some(
    (r) => r.makespanCiLow != null || r.avgTransferTimeCiLow != null
  );
  const hasJournal = results.some((r) => r.makespan != null && r.makespan > 0);

  // 표시할 지표 (hasJournal이면 전부, 아니면 기존 6개만)
  const visibleMetrics = METRIC_DEFS.filter((m) => !m.journal || hasJournal);

  return (
    <div className="rounded-md border border-gray-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="text-xs font-semibold">지표</TableHead>
            {ordered.map((r) => (
              <TableHead
                key={r.algorithm}
                className={`text-right text-xs font-semibold ${algColor(r.algorithm)}`}
              >
                {algLabel(r.algorithm)}
                {r.fallback && (
                  <span className="ml-1 text-[10px] text-red-400">(폴백)</span>
                )}
                {r.seedCount && r.seedCount > 1 && (
                  <span className="ml-1 text-[10px] text-gray-400">n={r.seedCount}</span>
                )}
              </TableHead>
            ))}
            {astar && ordered.length > 1 && (
              <TableHead className="text-right text-xs text-gray-500">A* 대비</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleMetrics.map((m) => {
            const values = ordered.map((r) => r[m.key] as number);
            const bestIdx = findBestIdx(values, m.higherIsBetter);

            return (
              <TableRow key={m.key} className="text-sm">
                <TableCell className="font-medium text-gray-700">
                  {m.label}
                </TableCell>
                {values.map((v, i) => {
                  const rec = ordered[i];
                  const ciLo = m.ciLowKey ? (rec[m.ciLowKey] as number | undefined) : undefined;
                  const ciHi = m.ciHighKey ? (rec[m.ciHighKey] as number | undefined) : undefined;
                  return (
                    <TableCell
                      key={rec.algorithm}
                      className={`text-right ${i === bestIdx ? 'font-bold text-emerald-700' : 'text-gray-600'}`}
                    >
                      {m.fmt(v ?? 0)}
                      {hasCi && <CiBadge lo={ciLo} hi={ciHi} />}
                    </TableCell>
                  );
                })}
                {/* A* 대비 개선율 + 유의성 별표 */}
                {astar && ordered.length > 1 && (() => {
                  const astarVal = astar[m.key] as number;
                  const bestNonAstar = nonAstar.reduce<{ r: SimulationResult | null; impr: number }>(
                    (acc, r) => {
                      const impr = improvementVsAstar(astarVal, r[m.key] as number, m.higherIsBetter);
                      if (impr != null && impr > acc.impr) return { r, impr };
                      return acc;
                    },
                    { r: null, impr: -Infinity },
                  );

                  if (!isFinite(bestNonAstar.impr) || !bestNonAstar.r) return <TableCell />;
                  const isPositive = bestNonAstar.impr > 0;
                  const badge = isPositive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-600 border-red-200';

                  const pvalKey = METRIC_TO_PVAL_KEY[m.key as string];
                  const star = pvalKey
                    ? getPvalStar(
                        comparison?.pairwisePvalues,
                        pvalKey,
                        'astar',
                        bestNonAstar.r.algorithm,
                      )
                    : '';

                  return (
                    <TableCell className="text-right">
                      <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${badge}`}>
                        {isPositive ? '+' : ''}{bestNonAstar.impr.toFixed(1)}%
                      </span>
                      {star && (
                        <span
                          className="ml-1 text-[11px] font-bold text-violet-600"
                          title={star === '**' ? 'p<0.01 (Wilcoxon+Bonferroni)' : 'p<0.05 (Wilcoxon+Bonferroni)'}
                        >
                          {star}
                        </span>
                      )}
                    </TableCell>
                  );
                })()}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
