'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart2, Map, Truck } from 'lucide-react';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { LayoutViewer } from '@/components/dashboard/layout-viewer';
import { CommandPanel } from '@/components/dashboard/command-panel';
import { useLayouts } from '@/lib/api/layouts';
import { useEquipmentsByLayout } from '@/lib/api/equipment';

/** 에러 장비 알람 배너 */
function AlarmBanner({ layoutId }: { layoutId: string | undefined }) {
  const { data: equipments = [] } = useEquipmentsByLayout(layoutId ?? '');
  const errorEquipments = equipments.filter((e) => e.state === 'Error');
  if (errorEquipments.length === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
      <span className="flex-1 text-red-700">
        <span className="font-semibold">{errorEquipments.length}개 장비</span>에서 에러 발생:{' '}
        {errorEquipments.map((e) => e.equipmentId).join(', ')}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: layouts = [], isLoading: layoutsLoading } = useLayouts();

  // 선택된 레이아웃 ID (기본값: 가장 최근 레이아웃)
  const defaultLayoutId = useMemo(
    () => (layouts.length > 0 ? layouts[0].id : undefined),
    [layouts],
  );
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | undefined>(undefined);
  const layoutId = selectedLayoutId ?? defaultLayoutId;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">대시보드</h1>
          <p className="text-sm text-gray-500">레이아웃 기반 물류 모니터링</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/layout-modeler"
            className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Map className="h-4 w-4" />
            레이아웃 편집
          </Link>
          <Link
            href="/transfer-control"
            className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Truck className="h-4 w-4" />
            반송 제어
          </Link>
          <Link
            href="/simulation"
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <BarChart2 className="h-4 w-4" />
            시뮬레이션
          </Link>
        </div>
      </div>

      {/* 에러 장비 알람 배너 */}
      <AlarmBanner layoutId={layoutId} />

      {/* 통계 카드 */}
      <StatsCards layoutId={layoutId} />

      {/* 메인 영역: 레이아웃 뷰어 + 명령 패널 */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* 레이아웃 영역 */}
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {/* 레이아웃 선택 드롭다운 */}
          <div className="flex items-center gap-2">
            <label htmlFor="layout-select" className="text-sm text-gray-500 shrink-0">
              레이아웃
            </label>
            <select
              id="layout-select"
              value={layoutId ?? ''}
              onChange={(e) => setSelectedLayoutId(e.target.value || undefined)}
              disabled={layoutsLoading || layouts.length === 0}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
            >
              {layouts.length === 0 ? (
                <option value="">저장된 레이아웃 없음</option>
              ) : (
                layouts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.designName} v{l.version}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* React Flow 레이아웃 뷰어 */}
          <LayoutViewer layoutId={layoutId} />
        </div>

        {/* 명령 현황 패널 */}
        <CommandPanel />
      </div>
    </div>
  );
}
