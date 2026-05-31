'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart2, Map, Truck, Zap, X, Loader2, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { LayoutViewer, type SelectedPortInfo } from '@/components/dashboard/layout-viewer';
import { CommandPanel } from '@/components/dashboard/command-panel';
import { DispatchResultPanel, type DispatchAckInfo } from '@/components/dashboard/dispatch-result-panel';
import { VehiclePathPanel } from '@/components/dashboard/vehicle-path-panel';
import { useLayouts, useLayout } from '@/lib/api/layouts';
import { useEquipmentsByLayout } from '@/lib/api/equipment';
import { useUnitsByLayout } from '@/lib/api/equipment-units';
import { useCarriers } from '@/lib/api/carriers';
import { useActiveMacroCommands } from '@/lib/api/macro-commands';
import { useAcsTickLoop } from '@/lib/acs/tick-loop';
import type { Edge, Node } from '@xyflow/react';
import type { Equipment, EquipmentUnit, Carrier } from '@workspace/types/mcs';

const RTD_ENABLED = process.env.NEXT_PUBLIC_RTD_ENABLED === 'true';

const EMPTY_EQUIPMENTS: Equipment[] = [];
const EMPTY_UNITS: EquipmentUnit[] = [];
const EMPTY_CARRIERS: Carrier[] = [];

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

type TriggerResponse = {
  ok?: boolean;
  error?: string;
  ack?: {
    body?: {
      status?: string;
      ruleGroupId?: string;
      selectedLotId?: string | null;
      destEquipmentId?: string | null;
      reason?: string | null;
    };
  };
};

/** 포트 프로퍼티 + LoadRequest 패널 */
function PortPropertyPanel({
  port,
  onClose,
  onDispatch,
}: {
  port:        SelectedPortInfo;
  onClose:     () => void;
  onDispatch?: (ack: DispatchAckInfo) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleLoadRequest() {
    setLoading(true);
    try {
      const res = await fetch('/api/rtd/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipmentId: port.portId, eventType: 'LOAD_REQUEST' }),
      });
      const data = await res.json() as TriggerResponse;
      if (!res.ok || !data.ok) {
        toast.error(`LoadRequest 실패: ${data.error ?? res.statusText}`);
      } else {
        onDispatch?.({
          portId:           port.portId,
          status:           data.ack?.body?.status ?? 'ACCEPTED',
          ruleGroupId:      data.ack?.body?.ruleGroupId,
          selectedLotId:    data.ack?.body?.selectedLotId,
          destEquipmentId:  data.ack?.body?.destEquipmentId,
          reason:           data.ack?.body?.reason,
        });
        toast.success(`${port.portId} → RTD 디스패칭 요청 전송 완료`);
        onClose();
      }
    } catch (e) {
      toast.error(`연결 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  }

  const dirLabel: Record<string, string> = {
    IN: 'IN (투입)', OUT: 'OUT (반출)', BOTH: 'IN/OUT (양방향)',
  };

  return (
    <div className="flex w-64 shrink-0 flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">포트 정보</span>
        <button onClick={onClose} className="rounded p-0.5 hover:bg-gray-100">
          <X className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </div>

      {/* 프로퍼티 */}
      <div className="space-y-2 rounded-md bg-gray-50 p-3 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Port ID</span>
          <span className="font-mono font-medium text-gray-800">{port.portId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Equipment</span>
          <span className="font-mono font-medium text-gray-800">{port.equipmentId || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">방향</span>
          <span className="font-medium text-gray-700">
            {(dirLabel[port.direction] ?? port.direction) || '-'}
          </span>
        </div>
      </div>

      {/* LoadRequest 버튼 */}
      {RTD_ENABLED ? (
        <button
          onClick={handleLoadRequest}
          disabled={loading}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Zap className="h-3.5 w-3.5" />}
          LoadRequest 발생
        </button>
      ) : (
        <p className="text-center text-xs text-gray-400">RTD 연동 비활성 상태</p>
      )}
    </div>
  );
}

/** 반송 명령 플로팅 버튼 */
function CommandFloatingButton({ onClick }: { onClick: () => void }) {
  const { data: commands = [] } = useActiveMacroCommands();
  const activeCount = commands.filter((c) => c.state === 'InProgress' || c.state === 'Pending').length;

  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md hover:bg-gray-50"
    >
      <ListOrdered className="h-3.5 w-3.5" />
      반송 명령 현황
      {activeCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
          {activeCount}
        </span>
      )}
    </button>
  );
}

export default function DashboardPage() {
  const { data: layouts = [], isLoading: layoutsLoading } = useLayouts();
  const defaultLayoutId = useMemo(
    () => (layouts.length > 0 ? layouts[0].id : undefined),
    [layouts],
  );
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | undefined>(undefined);
  const layoutId = selectedLayoutId ?? defaultLayoutId;

  const [selectedPort,    setSelectedPort]    = useState<SelectedPortInfo | null>(null);
  const [commandPanelOpen, setCommandPanelOpen] = useState(false);
  const [dispatchAck,      setDispatchAck]     = useState<DispatchAckInfo | null>(null);
  const [dispatchAckAt,    setDispatchAckAt]   = useState<number | null>(null);
  const [dispatchPanelOpen, setDispatchPanelOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined);

  // AMR tick-loop 마운트 — leader-lock으로 중복 실행 방지
  const { data: layout }                      = useLayout(layoutId ?? '');
  const { data: equipments = EMPTY_EQUIPMENTS } = useEquipmentsByLayout(layoutId ?? '');
  const { data: units = EMPTY_UNITS }           = useUnitsByLayout(layoutId ?? '');
  const { data: carriers = EMPTY_CARRIERS }     = useCarriers();

  const layoutEdges = useMemo<Edge[]>(() => {
    const json = layout?.jsonData as { edges?: Edge[] } | null | undefined;
    return json?.edges ?? [];
  }, [layout]);

  const layoutNodes = useMemo<Node[]>(() => {
    const json = layout?.jsonData as { nodes?: Node[] } | null | undefined;
    return json?.nodes ?? [];
  }, [layout]);

  const { acsState, isLeaderTab, start, requestReturnHome } = useAcsTickLoop({
    layoutNodes,
    layoutEdges,
    equipments,
    units,
    carriers,
    layoutId: layoutId ?? undefined,
  });

  useEffect(() => {
    if (layoutNodes.length > 0) start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutNodes.length]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">대시보드</h1>
            {acsState.isRunning && (
              <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                isLeaderTab
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}>
                tick:{isLeaderTab ? 'leader' : 'follower'}
              </span>
            )}
          </div>
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

      {/* 에러 알람 배너 */}
      <AlarmBanner layoutId={layoutId} />

      {/* 통계 카드 */}
      <StatsCards layoutId={layoutId} />

      {/* 메인 영역 */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* 레이아웃 영역 */}
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {/* 레이아웃 선택 + 반송 명령 플로팅 버튼 */}
          <div className="flex items-center justify-between gap-2">
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
            <CommandFloatingButton onClick={() => setCommandPanelOpen((v) => !v)} />
          </div>

          {/* React Flow 레이아웃 뷰어 */}
          <LayoutViewer
            layoutId={layoutId}
            acsVehicles={acsState.vehicles}
            selectedVehicleId={selectedVehicleId}
            onAgvClick={(id) => {
              setSelectedVehicleId(id);
              setSelectedPort(null);
              setCommandPanelOpen(false);
              setDispatchPanelOpen(false);
            }}
            onPortClick={(info) => {
              setSelectedPort(info);
              setSelectedVehicleId(undefined);
              setCommandPanelOpen(false);
              setDispatchPanelOpen(false);
            }}
          />
        </div>

        {/* 우측 패널: 포트 프로퍼티 / 디스패칭 결과 / 차량 경로 / 반송 명령 현황 */}
        {selectedVehicleId && !commandPanelOpen && !dispatchPanelOpen && !selectedPort && (() => {
          const vehicle = acsState.vehicles.get(selectedVehicleId);
          if (!vehicle) return null;
          return (
            <VehiclePathPanel
              vehicle={vehicle}
              units={units}
              onClose={() => setSelectedVehicleId(undefined)}
              onReturnHome={() => requestReturnHome(vehicle.equipmentId)}
            />
          );
        })()}
        {selectedPort && !commandPanelOpen && !dispatchPanelOpen && (
          <PortPropertyPanel
            port={selectedPort}
            onClose={() => setSelectedPort(null)}
            onDispatch={(ack) => {
              setDispatchAck(ack);
              setDispatchAckAt(Date.now());
              setDispatchPanelOpen(true);
              setSelectedPort(null);
            }}
          />
        )}
        {dispatchPanelOpen && !commandPanelOpen && (
          <DispatchResultPanel
            ack={dispatchAck}
            ackAt={dispatchAckAt}
            units={units}
            acsVehicles={acsState.vehicles}
            onClose={() => { setDispatchPanelOpen(false); setDispatchAck(null); setDispatchAckAt(null); }}
          />
        )}
        {commandPanelOpen && (
          <div className="flex w-72 shrink-0 flex-col rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-800">반송 명령 현황</span>
              <button
                onClick={() => setCommandPanelOpen(false)}
                className="rounded p-0.5 hover:bg-gray-100"
              >
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CommandPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
