'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SimulationResult, SimulationComparison } from '@workspace/types/mcs';

interface CsvExportButtonProps {
  results?: SimulationResult[];
  comparison?: SimulationComparison;
}

/** 시뮬레이션 결과 CSV 내보내기 버튼 */
export function CsvExportButton({ results, comparison }: CsvExportButtonProps) {
  const handleExport = () => {
    const astar = results?.find((r) => r.algorithm === 'astar');
    const ai    = results?.find((r) => r.algorithm === 'ai_ppo');

    const rows = [
      ['지표', 'A*', 'AI', '개선율(%)'],
      ['평균 반송 시간(s)', astar?.avgTransferTime ?? '', ai?.avgTransferTime ?? '', comparison?.transferTimeReduction ?? ''],
      ['장비 가동률(%)',   astar?.equipmentUtilization ?? '', ai?.equipmentUtilization ?? '', comparison?.utilizationIncrease ?? ''],
      ['교착 발생 횟수',  astar?.deadlockCount ?? '',       ai?.deadlockCount ?? '',       comparison?.deadlockElimination ?? ''],
      ['경로 효율 점수',  astar?.routeEfficiencyScore ?? '', ai?.routeEfficiencyScore ?? '', comparison?.efficiencyIncrease ?? ''],
      ['처리량(캐리어/h)', astar?.throughput ?? '',          ai?.throughput ?? '',          comparison?.throughputIncrease ?? ''],
    ];

    const csvContent = rows
      .map((row) => row.map(String).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = 'simulation_comparison.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={!results || results.length === 0}
      className="gap-1.5"
    >
      <Download className="h-4 w-4" />
      CSV 내보내기
    </Button>
  );
}
