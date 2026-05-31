'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComparisonTable }   from '@/components/simulation/comparison-table';
import { TransferTimeChart } from '@/components/simulation/transfer-time-chart';
import { UtilizationChart }  from '@/components/simulation/utilization-chart';
import { CsvExportButton }   from '@/components/simulation/csv-export-button';
import { useSimulationResult } from '@/lib/api/ai-engine';
import { useSimulationRun }    from '@/lib/api/simulation-runs';
import { ReplayCanvas }        from '@/components/simulation/replay-canvas';

function SimulationResultContent() {
  const params = useSearchParams();
  const runId  = params.get('runId');

  const { data, isLoading, error } = useSimulationResult(runId);
  const { data: runMeta } = useSimulationRun(runId);

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

      {/* 개선율 요약 배지 — 양수일 때만 emerald, 음수면 amber */}
      {comparison && (
        <div className="flex flex-wrap gap-2">
          {[
            { value: comparison.transferTimeReduction, label: (v: number) => `반송 시간 ${v.toFixed(1)}% 단축` },
            { value: comparison.utilizationIncrease,   label: (v: number) => `가동률 ${v.toFixed(1)}% 향상` },
            { value: comparison.deadlockElimination,   label: (v: number) => v === 0 ? '교착 발생 없음' : `교착 ${v.toFixed(0)}% 감소` },
            { value: comparison.throughputIncrease,    label: (v: number) => `처리량 ${v.toFixed(1)}% 변화` },
          ].map(({ value, label }) => {
            const pos = value >= 0;
            return (
              <span
                key={label(value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  pos
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {pos ? '' : '▼ '}{label(value)}
              </span>
            );
          })}
        </div>
      )}

      {/* 알고리즘별 경로 재생 */}
      {runMeta?.layoutId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-800">알고리즘별 경로 재생</CardTitle>
          </CardHeader>
          <CardContent>
            <ReplayCanvas
              layoutId={runMeta.layoutId}
              algorithms={results.map((r) => r.algorithm)}
              results={results}
            />
          </CardContent>
        </Card>
      )}

      {/* A* vs AI 비교 테이블 */}
      {comparison && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-800">성과 지표 비교</CardTitle>
              {comparison.pairwisePvalues && (
                <span className="text-[10px] text-violet-600 bg-violet-50 border border-violet-200 rounded px-2 py-0.5">
                  * p&lt;0.05 &nbsp; ** p&lt;0.01 (Wilcoxon + Bonferroni)
                </span>
              )}
            </div>
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
