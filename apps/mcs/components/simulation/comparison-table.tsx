'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SimulationResult, SimulationComparison } from '@workspace/types/mcs';

interface MetricRow {
  label: string;
  astarVal: string;
  aiVal: string;
  improvement: number;
  higherIsBetter: boolean;
}

interface ComparisonTableProps {
  results: SimulationResult[];
  comparison: SimulationComparison;
}

/** A* vs AI 성과 지표 비교 테이블 */
export function ComparisonTable({ results, comparison }: ComparisonTableProps) {
  const astar = results.find((r) => r.algorithm === 'astar');
  const ai    = results.find((r) => r.algorithm === 'ai_ppo');

  const METRICS: MetricRow[] = [
    {
      label:          '평균 반송 시간',
      astarVal:       `${(astar?.avgTransferTime ?? 0).toFixed(2)}s`,
      aiVal:          `${(ai?.avgTransferTime    ?? 0).toFixed(2)}s`,
      improvement:    comparison.transferTimeReduction,
      higherIsBetter: false,
    },
    {
      label:          '장비 가동률',
      astarVal:       `${(astar?.equipmentUtilization ?? 0).toFixed(1)}%`,
      aiVal:          `${(ai?.equipmentUtilization    ?? 0).toFixed(1)}%`,
      improvement:    comparison.utilizationIncrease,
      higherIsBetter: true,
    },
    {
      label:          '교착 발생 횟수',
      astarVal:       `${astar?.deadlockCount ?? 0}회`,
      aiVal:          `${ai?.deadlockCount    ?? 0}회`,
      improvement:    comparison.deadlockElimination,
      higherIsBetter: false,
    },
    {
      label:          '경로 효율 점수',
      astarVal:       `${(astar?.routeEfficiencyScore ?? 0).toFixed(1)}`,
      aiVal:          `${(ai?.routeEfficiencyScore    ?? 0).toFixed(1)}`,
      improvement:    comparison.efficiencyIncrease,
      higherIsBetter: true,
    },
    {
      label:          '처리량 (캐리어/h)',
      astarVal:       `${(astar?.throughput ?? 0).toFixed(1)}`,
      aiVal:          `${(ai?.throughput    ?? 0).toFixed(1)}`,
      improvement:    comparison.throughputIncrease,
      higherIsBetter: true,
    },
  ];

  return (
    <div className="rounded-md border border-gray-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="text-xs">지표</TableHead>
            <TableHead className="text-right text-xs text-indigo-700">A*</TableHead>
            <TableHead className="text-right text-xs text-emerald-700">AI</TableHead>
            <TableHead className="text-right text-xs">개선율</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {METRICS.map((m) => {
            const isPositive = m.improvement > 0;
            const badgeStyle = isPositive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-600 border-red-200';

            return (
              <TableRow key={m.label} className="text-sm">
                <TableCell className="font-medium text-gray-700">{m.label}</TableCell>
                <TableCell className="text-right text-gray-600">{m.astarVal}</TableCell>
                <TableCell className="text-right font-semibold text-emerald-700">{m.aiVal}</TableCell>
                <TableCell className="text-right">
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${badgeStyle}`}>
                    {isPositive ? '+' : ''}{m.improvement.toFixed(1)}%
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
