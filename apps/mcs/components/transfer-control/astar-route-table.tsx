'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface AstarPathStep {
  unitId:    string;
  unitLabel: string;
  gCost:     number;
  hCost:     number;
  fCost:     number;
}

interface AstarRouteTableProps {
  path:          AstarPathStep[];
  totalCost:     number;
  exploredCount: number;
}

/** A* 경로 탐색 결과 테이블 (GCOST/HCOST/FCOST 포함) */
export function AstarRouteTable({ path, totalCost, exploredCount }: AstarRouteTableProps) {
  if (path.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">경로 탐색 결과 없음</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          총 {exploredCount}개 노드 탐색 완료
        </p>
        <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
          총 비용: {totalCost.toFixed(1)}m
        </span>
      </div>

      <div className="rounded-md border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-12 text-center text-xs">Step</TableHead>
              <TableHead className="text-xs">유닛</TableHead>
              <TableHead className="text-right text-xs">G-Cost</TableHead>
              <TableHead className="text-right text-xs">H-Cost</TableHead>
              <TableHead className="text-right text-xs font-semibold text-indigo-700">F-Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {path.map((step, idx) => (
              <TableRow key={step.unitId} className="text-sm">
                <TableCell className="text-center font-medium text-gray-500">
                  {idx + 1}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-gray-800">{step.unitLabel}</div>
                  <div className="text-[10px] text-gray-400">{step.unitId.slice(0, 8)}…</div>
                </TableCell>
                <TableCell className="text-right text-gray-600">{step.gCost.toFixed(1)}</TableCell>
                <TableCell className="text-right text-gray-600">{step.hCost.toFixed(1)}</TableCell>
                <TableCell className="text-right font-semibold text-indigo-700">
                  {step.fCost.toFixed(1)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
