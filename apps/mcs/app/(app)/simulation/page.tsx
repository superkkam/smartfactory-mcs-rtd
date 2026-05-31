'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScenarioForm, type ScenarioFormParams } from '@/components/simulation/scenario-form';
import { SimulationProgress } from '@/components/simulation/simulation-progress';
import { RunHistoryTable }    from '@/components/simulation/run-history-table';
import { useLayouts }         from '@/lib/api/layouts';
import { runSimulation, useSimulationStatus } from '@/lib/api/ai-engine';

export default function SimulationPage() {
  const { data: layouts = [] } = useLayouts();
  const layoutId = layouts[0]?.id ?? null;

  const [runId, setRunId] = useState<string | null>(null);

  const { data: statusData } = useSimulationStatus(runId, runId !== null);
  const isRunning = statusData?.status === 'Running' || statusData?.status === 'Pending';

  const handleRun = async (formParams: ScenarioFormParams) => {
    if (!layoutId) {
      toast.error('레이아웃이 없습니다. 레이아웃 모델러에서 먼저 저장해주세요.');
      return;
    }
    try {
      const journalSeeds = formParams.journalMode
        ? Array.from({ length: 25 }, (_, i) => i + 1)
        : undefined;

      const res = await runSimulation({
        scenarioParams: {
          layoutId,
          carrierCount:       formParams.carrierCount,
          utilizationRate:    formParams.utilizationRate,
          simulationDuration: formParams.simulationDuration,
          mode:               formParams.mode,
        },
        algorithms: formParams.algorithms,
        seeds: journalSeeds,
      });
      setRunId(res.runId);
      toast.success(
        formParams.journalMode
          ? `저널 실험 시작 — 25시드 × ${formParams.algorithms.length}알고리즘 (${res.runId.slice(0, 8)})`
          : `시뮬레이션 시작 (${res.runId.slice(0, 8)})`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '시뮬레이션 시작 실패');
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">시뮬레이션</h1>
        <p className="mt-0.5 text-sm text-gray-500">시나리오 설정 및 실행</p>
      </div>

      {/* 시나리오 파라미터 폼 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-800">시나리오 파라미터</CardTitle>
        </CardHeader>
        <CardContent>
          <ScenarioForm onRun={handleRun} disabled={isRunning} />
        </CardContent>
      </Card>

      {/* 진행률 바 (runId 있을 때만 표시) */}
      {runId && statusData && (
        <SimulationProgress
          progress={statusData.progress}
          status={statusData.status}
          runId={runId}
        />
      )}

      {/* 최근 실행 이력 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-800">최근 실행 이력</CardTitle>
        </CardHeader>
        <CardContent>
          <RunHistoryTable />
        </CardContent>
      </Card>
    </div>
  );
}
