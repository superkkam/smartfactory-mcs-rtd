'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSimulationRuns } from '@/lib/api/simulation-runs';
import type { SimulationStatus } from '@workspace/types/constants';

/** 시뮬레이션 상태 → 배지 스타일 */
const STATUS_BADGE: Record<SimulationStatus, { style: string; label: string }> = {
  Pending:   { style: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: '대기' },
  Running:   { style: 'bg-blue-100   text-blue-700   border-blue-200',   label: '실행중' },
  Completed: { style: 'bg-green-100  text-green-700  border-green-200',  label: '완료' },
  Failed:    { style: 'bg-red-100    text-red-600    border-red-200',    label: '실패' },
};

/** 최근 시뮬레이션 실행 이력 테이블 */
export function RunHistoryTable() {
  const { data: runs = [], isLoading } = useSimulationRuns();

  if (isLoading) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">이력 로딩 중…</div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">
        실행 이력이 없습니다. 시뮬레이션을 실행해주세요.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="text-xs">실행 ID</TableHead>
            <TableHead className="text-xs">알고리즘</TableHead>
            <TableHead className="text-xs text-center">상태</TableHead>
            <TableHead className="text-right text-xs">캐리어</TableHead>
            <TableHead className="text-right text-xs">반송 요청</TableHead>
            <TableHead className="text-right text-xs">시뮬레이션 시간</TableHead>
            <TableHead className="text-xs"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => {
            const statusKey = run.status as SimulationStatus;
            const badge = STATUS_BADGE[statusKey] ?? STATUS_BADGE.Pending;
            const algoStyle = run.algorithms.includes('ai_ppo') && run.algorithms.includes('astar')
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : run.algorithms.includes('ai_ppo')
              ? 'bg-emerald-50  text-emerald-700  border-emerald-200'
              : 'bg-indigo-50   text-indigo-700   border-indigo-200';
            const algoLabel = run.algorithms.includes('ai_ppo') && run.algorithms.includes('astar')
              ? 'A* + AI'
              : run.algorithms.includes('ai_ppo')
              ? 'AI'
              : 'A*';

            return (
              <TableRow key={run.id} className="text-sm">
                <TableCell className="font-mono text-xs text-gray-600">
                  {run.id.slice(0, 8)}…
                </TableCell>
                <TableCell>
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${algoStyle}`}>
                    {algoLabel}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${badge.style}`}>
                    {badge.label}
                  </span>
                </TableCell>
                <TableCell className="text-right text-gray-600">
                  {run.scenarioParams?.carrierCount ?? '—'}
                </TableCell>
                <TableCell className="text-right text-gray-600">
                  {run.scenarioParams?.transferRequestCount ?? '—'}
                </TableCell>
                <TableCell className="text-right text-gray-600">
                  {run.scenarioParams?.simulationDuration != null
                    ? `${run.scenarioParams.simulationDuration}s`
                    : '—'}
                </TableCell>
                <TableCell>
                  {statusKey === 'Completed' && (
                    <Link
                      href={`/simulation/result?runId=${run.id}`}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      결과 보기
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
