'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComparisonTable }   from '@/components/simulation/comparison-table';
import { TransferTimeChart } from '@/components/simulation/transfer-time-chart';
import { UtilizationChart }  from '@/components/simulation/utilization-chart';
import { CsvExportButton }   from '@/components/simulation/csv-export-button';
import { useSimulationResult } from '@/lib/api/ai-engine';

function SimulationResultContent() {
  const params = useSearchParams();
  const runId  = params.get('runId');

  const { data, isLoading, error } = useSimulationResult(runId);

  /* 헤더 (CSV 버튼 포함) — data 유무에 따라 버튼 활성화 */
  const header = (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">시뮬레이션 결과</h1>
        <p className="mt-0.5 text-sm text-gray-500">A* vs AI 비교 분석</p>
      </div>
      <CsvExportButton results={data?.results} comparison={data?.comparison} />
    </div>
  );

  if (!runId) {
    return (
      <div className="space-y-6">
        {header}
        <p className="py-12 text-center text-sm text-gray-400">
          runId가 없습니다. 시뮬레이션 페이지에서 실행 후 결과 보기를 클릭해주세요.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="py-12 text-center text-sm text-gray-400">결과 로딩 중…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        {header}
        <p className="py-12 text-center text-sm text-red-500">
          결과 로딩 실패. AI 엔진 서버가 실행 중인지 확인해주세요.
        </p>
      </div>
    );
  }

  const { comparison, distributions, results } = data;

  return (
    <div className="space-y-6">
      {header}

      {/* 개선율 요약 배지 */}
      {comparison && (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            반송 시간 {comparison.transferTimeReduction.toFixed(1)}% 단축
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            가동률 {comparison.utilizationIncrease.toFixed(1)}% 향상
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            교착 발생 {comparison.deadlockElimination.toFixed(0)}% 제거
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            처리량 {comparison.throughputIncrease.toFixed(1)}% 증가
          </span>
        </div>
      )}

      {/* A* vs AI 비교 테이블 */}
      {comparison && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-800">성과 지표 비교</CardTitle>
          </CardHeader>
          <CardContent>
            <ComparisonTable results={results} comparison={comparison} />
          </CardContent>
        </Card>
      )}

      {/* 차트 2개 그리드 */}
      {distributions && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-800">반송 시간 분포</CardTitle>
            </CardHeader>
            <CardContent>
              <TransferTimeChart data={distributions.transferTime} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-800">장비별 가동률</CardTitle>
            </CardHeader>
            <CardContent>
              <UtilizationChart data={distributions.equipmentUtilization} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function SimulationResultPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-sm text-gray-400">로딩 중…</div>}>
      <SimulationResultContent />
    </Suspense>
  );
}
