'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AiRouteStep } from '@workspace/types/mcs';

export type { AiRouteStep };

interface AiRouteViewProps {
  /** AI 추론 결과 경로 (없으면 대기 상태 표시) */
  path?:         AiRouteStep[];
  totalTimeMs?:  number;
  isLoading?:    boolean;
}

/** AI 경로 추론 결과 테이블 (동적 가중치 + 혼잡도 반영) */
export function AiRouteView({ path, totalTimeMs, isLoading }: AiRouteViewProps) {
  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        AI 엔진 추론 중…
      </div>
    );
  }

  if (!path || path.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        AI 경로 결과 없음 (FastAPI 엔진 연동 후 표시됩니다)
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          AI PPO 모델 추론 — 동적 가중치 반영
        </p>
        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          예측 총 시간: {((totalTimeMs ?? 0) / 1000).toFixed(1)}s
        </span>
      </div>

      <div className="rounded-md border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-12 text-center text-xs">Step</TableHead>
              <TableHead className="text-xs">유닛</TableHead>
              <TableHead className="text-right text-xs">가중치</TableHead>
              <TableHead className="text-right text-xs">혼잡도</TableHead>
              <TableHead className="text-right text-xs font-semibold text-emerald-700">예측시간</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {path.map((step, idx) => {
              const congestionColor =
                step.congestionFactor >= 0.3
                  ? 'text-red-600'
                  : step.congestionFactor >= 0.1
                  ? 'text-yellow-600'
                  : 'text-green-600';
              return (
                <TableRow key={step.unitId} className="text-sm">
                  <TableCell className="text-center font-medium text-gray-500">
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-800">{step.unitLabel}</div>
                    <div className="text-[10px] text-gray-400">{step.unitId.slice(0, 8)}…</div>
                  </TableCell>
                  <TableCell className="text-right text-gray-600">
                    {(step.weight * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className={`text-right font-medium ${congestionColor}`}>
                    {(step.congestionFactor * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700">
                    {step.predictedTimeMs === 0 ? '—' : `${(step.predictedTimeMs / 1000).toFixed(1)}s`}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
