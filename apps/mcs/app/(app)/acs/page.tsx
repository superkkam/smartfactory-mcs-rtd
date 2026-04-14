'use client';

import { useMemo, useState } from 'react';
import { Bot, Play, Square, Wifi, WifiOff } from 'lucide-react';
import { VehicleCard } from '@/components/acs/vehicle-card';
import { ScenarioPanel } from '@/components/acs/scenario-panel';
import { QuickDemo }     from '@/components/acs/quick-demo';
import { CommandQueuePanel } from '@/components/acs/command-queue-panel';
import { buildAdjList } from '@/lib/acs/layout-graph';
import { useAcsTickLoop } from '@/lib/acs/tick-loop';
import { useLayouts, useLayout } from '@/lib/api/layouts';
import { useEquipmentsByLayout } from '@/lib/api/equipment';
import { useUnitsByLayout } from '@/lib/api/equipment-units';
import { useCarriers } from '@/lib/api/carriers';
import type { Edge, Node } from '@xyflow/react';
import type { Equipment, EquipmentUnit, Carrier } from '@workspace/types/mcs';

// 모듈 수준 빈 배열 상수 — 데이터 로딩 중 undefined 기본값으로 사용.
// 매 렌더마다 새 참조가 생기면 useEffect([equipments]) 가 무한 루프에 빠짐.
const EMPTY_EQUIPMENTS: Equipment[] = [];
const EMPTY_UNITS: EquipmentUnit[] = [];
const EMPTY_CARRIERS: Carrier[] = [];

/**
 * ACS (AMHS Control System) 층 — 상태 패널
 *
 * - AMR/AGV 차량 상태 표시 (SEMI E82 축소판 state machine)
 * - ACS 시작/정지 토글 + localStorage leader lock (멀티탭 중복 방지)
 * - 반송 시나리오 시더 (임시 RTD 역할)
 * - 실제 RTD 연동 → Task 022 에서 구현
 */
export default function AcsPage() {
  const { data: layouts = [] } = useLayouts();
  const defaultLayoutId = useMemo(
    () => (layouts.length > 0 ? layouts[0].id : undefined),
    [layouts],
  );
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | undefined>(undefined);
  const layoutId = selectedLayoutId ?? defaultLayoutId;

  const { data: layout } = useLayout(layoutId ?? '');
  const { data: equipments = EMPTY_EQUIPMENTS } = useEquipmentsByLayout(layoutId ?? '');
  const { data: units = EMPTY_UNITS } = useUnitsByLayout(layoutId ?? '');
  const { data: carriers = EMPTY_CARRIERS } = useCarriers();

  // 레이아웃 JSON 에서 nodes/edges 추출 (MCS 와 동일한 json_data 소비)
  const layoutEdges = useMemo<Edge[]>(() => {
    const json = layout?.jsonData as { edges?: Edge[] } | null | undefined;
    return json?.edges ?? [];
  }, [layout]);

  const layoutNodes = useMemo<Node[]>(() => {
    const json = layout?.jsonData as { nodes?: Node[] } | null | undefined;
    return json?.nodes ?? [];
  }, [layout]);

  // ACS 인접 리스트 — RF ID → DB UUID 변환 포함 (ScenarioPanel에서 경로 검증용)
  // bidirectional: false → 실제 엣지 방향대로만 경로 탐색 (역방향 명령 차단)
  const adj = useMemo(
    () => buildAdjList(layoutEdges, layoutNodes, units),
    [layoutEdges, layoutNodes, units],
  );

  const { acsState, isLeaderTab, start, stop } = useAcsTickLoop({
    layoutNodes,
    layoutEdges,
    equipments,
    units,
    carriers,
  });

  const mobileVehicles = [...acsState.vehicles.values()];

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-indigo-600" />
          <h1 className="text-lg font-semibold text-gray-800">ACS — 차량 제어</h1>
          <span className="text-xs text-gray-400">(MCS 내부 SEMI E82 축소판)</span>
        </div>

        {/* Leader 상태 배지 */}
        <div className="flex items-center gap-2">
          {acsState.isRunning && (
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
              isLeaderTab
                ? 'bg-green-50 text-green-700 border-green-300'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}>
              {isLeaderTab ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isLeaderTab ? '리더 탭 (DB Write 활성)' : '팔로워 탭'}
            </span>
          )}

          {/* 시작/정지 토글 */}
          {acsState.isRunning ? (
            <button
              onClick={stop}
              className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
            >
              <Square className="h-3 w-3" />
              ACS 정지
            </button>
          ) : (
            <button
              onClick={start}
              className="flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <Play className="h-3 w-3" />
              ACS 시작
            </button>
          )}
        </div>
      </div>

      {/* 레이아웃 선택 */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">레이아웃</label>
        <select
          value={layoutId ?? ''}
          onChange={(e) => setSelectedLayoutId(e.target.value || undefined)}
          className="rounded border border-gray-200 px-2 py-1 text-xs"
        >
          {layouts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.designName} v{l.version}
            </option>
          ))}
        </select>
      </div>

      {/* 에러 배너 */}
      {acsState.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          오류: {acsState.error}
        </div>
      )}

      <div className="flex flex-1 gap-4 overflow-auto">
        {/* 차량 상태 카드 목록 */}
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">AMR/AGV 현황</h2>
            <span className="text-[10px] text-gray-400">
              Tick #{acsState.tickCount}
              {acsState.lastTickAt && ` · ${new Date(acsState.lastTickAt).toLocaleTimeString()}`}
            </span>
          </div>

          {mobileVehicles.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
              레이아웃에 AGV/AMR 장비가 없습니다
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mobileVehicles.map((v) => (
                <VehicleCard key={v.equipmentId} vehicle={v} />
              ))}
            </div>
          )}
        </div>

        {/* 시나리오 시더 패널 */}
        <div className="w-72 shrink-0 space-y-4">
          {/* 퀵 데모: 대시보드 실시간 확인용 */}
          <QuickDemo equipments={equipments} units={units} carriers={carriers} />

          {/* 반송 명령 현황 + 취소 */}
          <CommandQueuePanel units={units} />

          <h2 className="text-sm font-medium text-gray-700">반송 명령 생성</h2>
          <ScenarioPanel units={units} carriers={carriers} adj={adj} />

          <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 p-3 text-[10px] text-gray-400">
            <p className="font-medium text-gray-500 mb-1">동작 방식</p>
            <p>① 캐리어·출발지·목적지 선택 후 명령 생성</p>
            <p>② ACS tick loop 이 Idle AMR 에 자동 할당</p>
            <p>③ AMR 이 SEMI E82 state machine 에 따라 이동</p>
            <p className="mt-1 text-gray-300">실제 RTD 연동 → Task 022</p>
          </div>
        </div>
      </div>
    </div>
  );
}
