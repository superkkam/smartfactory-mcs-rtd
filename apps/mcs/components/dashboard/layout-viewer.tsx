'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useLayout } from '@/lib/api/layouts';
import { useLayoutMonitor } from '@/lib/api/layout-monitor';
import { useCarrierAnimations } from '@/lib/monitor/use-carrier-animations';
import { getEquipmentMiniMapColor } from '@/lib/monitor/state-colors';
import { ProcessGroupNode } from '@/components/layout-modeler/nodes/process-group-node';
import { StockerGroupNode } from '@/components/layout-modeler/nodes/stocker-group-node';
import { PortNode }         from '@/components/layout-modeler/nodes/port-node';
import { PathNode }         from '@/components/layout-modeler/nodes/path-node';
import { ChargeNode }       from '@/components/layout-modeler/nodes/charge-node';
import { TransferEdgeComponent } from '@/components/layout-modeler/edges/transfer-edge';
import { CarrierNode }     from '@/components/dashboard/carrier-node';
import { DashboardAgvNode } from '@/components/dashboard/agv-node';
import type { StockerNodeData, ProcessNodeData, PortNodeData, PathNodeData } from '@/components/layout-modeler/types';

/** React Flow 커스텀 노드/엣지 타입 등록 (대시보드 전용) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NODE_TYPES: NodeTypes = {
  stocker: StockerGroupNode  as any,
  process: ProcessGroupNode  as any,
  port:    PortNode          as any,
  node:    PathNode          as any,
  charge:  ChargeNode        as any,
  agv:     DashboardAgvNode  as any,  // 라벨 없는 SVG 전용 렌더러
  carrier: CarrierNode       as any,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EDGE_TYPES: EdgeTypes = {
  transfer: TransferEdgeComponent as any,
};

/** 연결 상태 배지 스타일 */
const CONNECTION_BADGE: Record<string, { style: string; label: string }> = {
  subscribed:  { style: 'bg-green-100 text-green-700 border-green-300', label: '실시간 연결됨' },
  connecting:  { style: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: '연결 중...' },
  error:       { style: 'bg-red-100 text-red-600 border-red-300', label: '연결 오류' },
  closed:      { style: 'bg-gray-100 text-gray-500 border-gray-300', label: '연결 끊김' },
};

interface LayoutViewerProps {
  layoutId: string | undefined;
}

/**
 * 레이아웃 읽기 전용 뷰어 (React Flow) — Supabase Realtime 실시간 바인딩
 * - DB에서 지정된 layoutId의 노드/엣지 로드
 * - 장비 상태 및 캐리어 위치를 실시간으로 덮어씀
 */
export function LayoutViewer({ layoutId }: LayoutViewerProps) {
  const { data: layout, isLoading: layoutLoading } = useLayout(layoutId ?? '');
  const {
    equipments,
    units,
    carriers,
    connectionStatus,
    isLoading: monitorLoading,
    hopEvents,
    ackHopEvent,
  } = useLayoutMonitor(layoutId);

  const rfRef = useRef<ReactFlowInstance | null>(null);

  /** 릴레이션 표시 여부 토글 */
  const [relationsVisible, setRelationsVisible] = useState(true);

  // 레이아웃 JSON에서 기본 노드 추출 (agv 는 useCarrierAnimations 가 애니메이션으로 대체)
  const baseNodes = useMemo<Node[]>(() => {
    const json = layout?.jsonData as { nodes?: Node[] } | null | undefined;
    return (json?.nodes ?? []).filter((n) => n.type !== 'agv');
  }, [layout]);

  // Transfer Relation 엣지 — BFS 경로 추적 + 렌더링 공용
  const rawEdges = useMemo<Edge[]>(() => {
    const json = layout?.jsonData as { edges?: Edge[] } | null | undefined;
    return (json?.edges ?? []).map((e) => ({
      ...e,
      type: 'transfer',
      data: { ...(e.data ?? {}), hidden: false },
      markerEnd: { type: 'arrowclosed' as const, color: '#94a3b8' },
    }));
  }, [layout]);

  // DB 장비 맵: node.id === mcs_equipment.equipment_id (syncLayoutToDb: equipment_id = n.id)
  const equipmentMap = useMemo(() => {
    const map = new Map<string, (typeof equipments)[number]>();
    for (const eq of equipments) {
      map.set(eq.equipmentId, eq); // equipment_id = node.id
      map.set(eq.id, eq);          // DB uuid 보조 키
    }
    return map;
  }, [equipments]);

  const mergedNodes = useMemo<Node[]>(() => {
    return baseNodes.map((node) => {
      const nodeData = node.data as Record<string, unknown>;
      // DB 매칭: data.equipmentId(STK-001 등 친숙 코드) 우선, fallback node.id(RF id)
      const lookupKey = (nodeData.equipmentId as string | undefined) ?? node.id;
      const eq = equipmentMap.get(lookupKey) ?? equipmentMap.get(node.id);
      // equipment 노드(stocker/process)의 실시간 상태만 DB 값으로 덮어쓰기.
      if (eq && nodeData.state !== undefined) {
        return {
          ...node,
          data: { ...nodeData, state: eq.state },
        };
      }
      return node;
    });
  }, [baseNodes, equipmentMap]);

  // framer-motion 기반 위치 보간 — AMR + 캐리어 animated nodes
  const { animatedNodes } = useCarrierAnimations({
    hopEvents,
    ackHopEvent,
    equipmentNodes: mergedNodes,
    layoutEdges: rawEdges,   // Transfer Relation 엣지 — BFS 경로 추적용
    units,
    equipments,
    carriers,
  });

  const allNodes = useMemo(
    () => [...mergedNodes, ...animatedNodes],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mergedNodes, animatedNodes],
  );

  // 릴레이션 표시 토글: React Flow 네이티브 hidden 속성 사용 (가장 확실)
  const edges = useMemo<Edge[]>(
    () => rawEdges.map((e) => ({ ...e, hidden: !relationsVisible })),
    [rawEdges, relationsVisible],
  );

  const isLoading = layoutLoading || monitorLoading;
  const badge = CONNECTION_BADGE[connectionStatus] ?? CONNECTION_BADGE.closed;

  if (isLoading) {
    return (
      <div className="relative flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white flex items-center justify-center text-sm text-gray-400">
        레이아웃 불러오는 중...
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="relative flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white flex items-center justify-center text-sm text-gray-400">
        저장된 레이아웃이 없습니다. 레이아웃 모델러에서 먼저 저장해주세요.
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <ReactFlow
        nodes={allNodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        minZoom={0.3}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        onInit={(inst) => { rfRef.current = inst; }}
      >
        <Background color="#e5e7eb" gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'carrier') return '#6366f1';
            if (node.type === 'agv')     return '#3b82f6';
            const d = node.data as Partial<StockerNodeData & ProcessNodeData & PortNodeData & PathNodeData>;
            return getEquipmentMiniMapColor(d.state ?? '');
          }}
          pannable
          zoomable
          className="!bottom-2 !right-2"
        />
      </ReactFlow>

      {/* 실시간 연결 상태 배지 + 릴레이션 토글 */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <button
          onClick={() => setRelationsVisible((v) => !v)}
          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
            relationsVisible
              ? 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
              : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
          }`}
          title="릴레이션 표시/숨김"
        >
          {relationsVisible ? '━' : '╌'} 경로 {relationsVisible ? '숨김' : '표시'} ({rawEdges.length})
        </button>
        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium ${badge.style}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connectionStatus === 'subscribed' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'}`} />
          {badge.label}
        </span>
      </div>


{/* 범례 */}
      <div className="absolute bottom-2 left-2 flex gap-2 rounded-md border border-gray-200 bg-white/90 px-2 py-1 text-[10px] shadow-sm">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />운영중</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-400"  />중지</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500"   />에러</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500"  />AGV</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500"/>캐리어</span>
      </div>
    </div>
  );
}
