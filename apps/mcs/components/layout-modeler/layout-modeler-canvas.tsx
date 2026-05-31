'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'sonner';

import { DUMMY_NODES, DUMMY_EDGES } from '@/lib/dummy/layout';
import { ProcessGroupNode } from './nodes/process-group-node';
import { StockerGroupNode } from './nodes/stocker-group-node';
import { PortNode }         from './nodes/port-node';
import { PathNode }         from './nodes/path-node';
import { AgvNode }          from './nodes/agv-node';
import { ChargeNode }       from './nodes/charge-node';
import { ObstacleNode }     from './nodes/obstacle-node';
import { TransferEdgeComponent } from './edges/transfer-edge';
import { CanvasContextMenu }     from './canvas-context-menu';
import { BatchRouteDialog }      from './batch-route-dialog';
import type {
  ModelerNode,
  TransferEdge,
  TransferEdgeData,
  PortNodeData,
  ProcessNodeData,
  StockerNodeData,
  PathNodeData,
} from './types';

/* 모듈 레벨 상수 — 매 렌더마다 재생성 방지 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NODE_TYPES: NodeTypes = {
  stocker:   StockerGroupNode as any,
  process:   ProcessGroupNode as any,
  port:      PortNode         as any,
  node:      PathNode         as any,
  agv:       AgvNode          as any,
  charge:    ChargeNode       as any,
  obstacle:  ObstacleNode     as any,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EDGE_TYPES: EdgeTypes = {
  transfer: TransferEdgeComponent as any,
};

/* ─── ID 생성 유틸 ─── */
let nodeCounter = 100;
let edgeCounter = 100;
const genNodeId = () => `node-${++nodeCounter}`;
const genEdgeId = () => `edge-${++edgeCounter}`;

/* ─── 타입별 친숙 코드 생성 (STK-001, PROC-001 …) ─── */
const TYPE_PREFIX: Record<string, string> = {
  stocker: 'STK',
  process: 'PROC',
  port:    'PORT',
  agv:     'AGV',
  node:    'ND',
  charge:  'CHG',
};
const typeCounters: Record<string, number> = { stocker: 0, process: 0, port: 0, agv: 0, node: 0, charge: 0 };
const genCode = (type: string): string => {
  typeCounters[type] = (typeCounters[type] ?? 0) + 1;
  return `${TYPE_PREFIX[type] ?? type.toUpperCase()}-${String(typeCounters[type]).padStart(3, '0')}`;
};

/* ─── ID 카운터 리셋 유틸 ─── */
function resetCounters(nodes: Node[]) {
  const nums = nodes
    .map((n) => parseInt(n.id.replace(/\D/g, ''), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 100;
  nodeCounter = max + 1;
  edgeCounter = max + 1;

  // 타입별 친숙 코드 카운터 재계산 (기존 레이아웃 로드 시 중복 방지)
  Object.keys(typeCounters).forEach((t) => { typeCounters[t] = 0; });
  nodes.forEach((n) => {
    const data = n.data as Record<string, unknown>;
    const code = (data.equipmentId ?? data.portId ?? data.nodeId) as string | undefined;
    if (!code) return;
    for (const [type, pre] of Object.entries(TYPE_PREFIX)) {
      if (code.startsWith(`${pre}-`)) {
        const num = parseInt(code.slice(pre.length + 1), 10);
        if (!isNaN(num)) typeCounters[type] = Math.max(typeCounters[type] ?? 0, num);
      }
    }
  });
}

/* ─── 노드 드롭 생성 헬퍼 ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createDropNodes(type: string, position: { x: number; y: number }): Node<any>[] {
  if (type === 'node') {
    const id   = genNodeId();
    const code = genCode('node');   // 예: ND-001
    return [{
      id,
      type: 'node',
      position,
      data: { nodeId: code, label: code },
    }];
  }

  if (type === 'stocker') {
    const eqpId   = genNodeId();
    const eqpCode = genCode('stocker');  // 예: STK-001
    const p1Id    = genNodeId();
    const p1Code  = genCode('port');     // 예: PORT-001
    const p2Id    = genNodeId();
    const p2Code  = genCode('port');     // 예: PORT-002
    return [
      {
        id: eqpId,
        type: 'stocker',
        position,
        data: { equipmentId: eqpCode, name: eqpCode, state: 'Online', portCount: 2 },
      },
      // 포트는 설비 우측 근처에 독립 배치 — 드래그로 원하는 위치로 이동 가능
      {
        id: p1Id, type: 'port',
        position: { x: position.x + 200, y: position.y },
        data: { portId: p1Code, name: p1Code, direction: 'OUT', parentEquipmentId: eqpId },
      },
      {
        id: p2Id, type: 'port',
        position: { x: position.x + 200, y: position.y + 40 },
        data: { portId: p2Code, name: p2Code, direction: 'IN', parentEquipmentId: eqpId },
      },
    ];
  }

  if (type === 'process') {
    const eqpId   = genNodeId();
    const eqpCode = genCode('process');  // 예: PROC-001
    const p1Id    = genNodeId();
    const p1Code  = genCode('port');
    const p2Id    = genNodeId();
    const p2Code  = genCode('port');
    return [
      {
        id: eqpId,
        type: 'process',
        position,
        data: { equipmentId: eqpCode, name: eqpCode, state: 'Online', portCount: 2 },
      },
      // 포트는 설비 좌측 근처에 독립 배치 — 드래그로 원하는 위치로 이동 가능
      {
        id: p1Id, type: 'port',
        position: { x: position.x - 60, y: position.y + 10 },
        data: { portId: p1Code, name: p1Code, direction: 'BOTH', parentEquipmentId: eqpId },
      },
      {
        id: p2Id, type: 'port',
        position: { x: position.x - 60, y: position.y + 50 },
        data: { portId: p2Code, name: p2Code, direction: 'BOTH', parentEquipmentId: eqpId },
      },
    ];
  }

  if (type === 'charge') {
    const id   = genNodeId();
    const code = genCode('charge');   // 예: CHG-001
    return [{
      id,
      type: 'charge',
      position,
      data: { nodeId: code, label: code },
    }];
  }

  if (type === 'agv') {
    // AGV/AMR: 이동형 장비. body port 는 DB 저장 시 자동 생성(보이지 않는 내부 unit).
    // 캔버스에는 AGV 노드 하나만 배치 — 경로 노드와 TransferEdge 로 연결해 이동 경로 설정.
    const eqpId   = genNodeId();
    const eqpCode = genCode('agv');  // 예: AGV-001
    return [{
      id:   eqpId,
      type: 'agv',
      position,
      data: {
        equipmentId: eqpCode,
        name:        eqpCode,    // 초기값은 코드와 동일, 속성 패널에서 독립 편집 가능
        systemName:  '',         // 속성 패널에서 ACS-001 등 입력
        state:       'Online',
      },
    }];
  }

  return [];
}

/** 저장 함수 반환값 타입 */
export type SaveResult = { nodes: Node[]; edges: Edge[]; viewport: { x: number; y: number; zoom: number } };

/* ─── Props ─── */
interface LayoutModelerCanvasProps {
  onNodeSelect:            (node: ModelerNode | null) => void;
  onEdgeSelect:            (edge: TransferEdge | null) => void;
  onNodesChange:           (nodes: Node[]) => void;
  onEdgesChange:           (edges: Edge[]) => void;
  relationsVisible:        boolean;
  onUndo:                  () => void;
  onRedo:                  () => void;
  /** 부모에게 저장 함수 등록 — 반환값으로 현재 nodes/edges/viewport 전달 */
  setExternalSave:         (fn: () => SaveResult) => void;
  /** 부모에게 엣지 업데이트 함수를 노출 (속성 패널 연동용) */
  setExternalEdgeUpdate:   (fn: (edgeId: string, data: Partial<TransferEdgeData>) => void) => void;
  /** 부모에게 노드 데이터 업데이트 함수를 노출 (속성 패널 연동용) */
  setExternalNodeUpdate:   (fn: (nodeId: string, data: Record<string, unknown>) => void) => void;
  /** 외부에서 로드할 초기 노드/엣지 (버전 변경 시 교체) */
  initialNodes?:           Node[];
  initialEdges?:           Edge[];
}

/**
 * 레이아웃 모델러 메인 캔버스
 * - 드래그앤드롭으로 노드 추가
 * - Port-to-Port 전용 TransferEdge 연결 (방향 검증 포함)
 * - 복수 Port 선택 → 우클릭 컨텍스트 메뉴 → 경로 일괄 생성
 * - 노드/엣지 선택 → 속성 패널로 전달
 */
export function LayoutModelerCanvas({
  onNodeSelect,
  onEdgeSelect,
  onNodesChange: notifyNodesChange,
  onEdgesChange: notifyEdgesChange,
  relationsVisible,
  setExternalSave,
  setExternalEdgeUpdate,
  setExternalNodeUpdate,
  initialNodes,
  initialEdges,
}: LayoutModelerCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes ?? DUMMY_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges ?? DUMMY_EDGES);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfInstanceRef = useRef<any>(null);

  /* 다중 선택된 Port 노드 목록 */
  const [selectedPortNodes, setSelectedPortNodes] = useState<Node[]>([]);

  /* 노드 우클릭 컨텍스트 메뉴 상태 */
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0, y: 0, visible: false,
  });

  /* 엣지 우클릭 컨텍스트 메뉴 상태 */
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    x: number; y: number; visible: boolean; edgeIds: string[];
  }>({ x: 0, y: 0, visible: false, edgeIds: [] });

  /* 시스템 일괄 지정 다이얼로그 */
  const [systemDialogOpen, setSystemDialogOpen] = useState(false);
  const [pendingSystem, setPendingSystem] = useState('');
  const pendingEdgeIdsRef = useRef<string[]>([]);

  /* 일괄 생성 모달 */
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  /* 모달에 전달할 포트 스냅샷 */
  const [batchPorts, setBatchPorts] = useState<Array<{ id: string; data: PortNodeData }>>([]);

  /* 저장 함수를 부모에게 등록 — nodes/edges 변경 시 최신 클로저로 갱신 */
  const registerSave = useCallback(() => {
    setExternalSave((): SaveResult => ({
      nodes,
      edges,
      viewport: rfInstanceRef.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 },
    }));
  }, [nodes, edges, setExternalSave]);

  // nodes/edges 변경될 때마다 저장 함수 갱신 (useEffect로 실제 등록)
  useEffect(() => { registerSave(); }, [registerSave]);

  /* 외부에서 initialNodes/initialEdges 변경 시 캔버스 교체 (버전 로드) */
  useEffect(() => {
    if (initialNodes !== undefined) {
      // 구버전 호환: JSONB에 'waypoint' 타입으로 저장된 노드를 'node'로 마이그레이션
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const migratedNodes = initialNodes.map((n) => {
        if (n.type !== 'waypoint') return n;
        const d = n.data as Record<string, unknown>;
        return {
          ...n,
          type: 'node',
          data: { nodeId: d.nodeId ?? d.waypointId ?? n.id, label: d.label },
        };
      });

      // 노드 ID 집합으로 orphan 엣지 필터링 + hidden 오염 제거
      const nodeIds = new Set(migratedNodes.map((n) => n.id));
      const validEdges = (initialEdges ?? [])
        .filter((e) => {
          const ok = nodeIds.has(e.source) && nodeIds.has(e.target);
          if (!ok) console.warn(`[layout-modeler] orphan 엣지 제거: ${e.id} (${e.source}→${e.target})`);
          return ok;
        })
        // json_data에 hidden이 잔류해도 relationsVisible 토글이 기준이므로 strip
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ hidden: _h, ...rest }) => rest as Edge);

      setNodes(migratedNodes);
      setEdges(validEdges);
      resetCounters(migratedNodes);
    }
  // initialNodes/initialEdges 참조 변경 시에만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodes, initialEdges]);

  /* ─── 엣지 데이터 업데이트 — 속성 패널 편집 시 호출됨 ─── */
  const handleEdgeUpdate = useCallback(
    (edgeId: string, data: Partial<TransferEdgeData>) => {
      setEdges((eds) =>
        (eds.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...(e.data ?? {}), ...data } as TransferEdgeData }
            : e
        )) as Edge<TransferEdgeData>[]
      );
    },
    [setEdges],
  );

  /* 부모에게 엣지 업데이트 함수 노출 (마운트 시 1회 등록) */
  useEffect(() => { setExternalEdgeUpdate(handleEdgeUpdate); }, [handleEdgeUpdate, setExternalEdgeUpdate]);

  /* ─── 노드 데이터 업데이트 — 속성 패널 편집 시 호출됨 ─── */
  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...(n.data as Record<string, unknown>), ...data } }
            : n,
        ),
      );
    },
    [setNodes],
  );

  /* 부모에게 노드 업데이트 함수 노출 */
  useEffect(() => { setExternalNodeUpdate(handleNodeUpdate); }, [handleNodeUpdate, setExternalNodeUpdate]);

  /* ─── Ctrl+A: 전체 릴레이션 선택 ─── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setEdges((eds) => eds.map((edge) => ({ ...edge, selected: true })));
        setNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setEdges, setNodes]);

  /* ─── 연결 유효성 검사 (React Flow isValidConnection prop) ─── */
  // 연결 가능 타입: port / node(경유점) / charge(충전소) 간 자유 연결
  // 포트 방향(IN/OUT)은 물리적 경로 제약이 아니라 ACS 로직 메타데이터 → 여기서 차단하지 않음
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isValidConnection = useCallback((connection: Connection | Edge<any>): boolean => {
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;
    if (connection.source === connection.target) return false;

    const CONNECTABLE = new Set(['port', 'node', 'charge']);
    if (!CONNECTABLE.has(sourceNode.type ?? '')) return false;
    if (!CONNECTABLE.has(targetNode.type ?? '')) return false;

    return true;
  }, [nodes]);

  /* ─── 연결 생성 (토스트 에러 포함) ─── */
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      const CONNECTABLE = new Set(['port', 'node', 'charge']);
      if (!sourceNode || !targetNode ||
          !CONNECTABLE.has(sourceNode.type ?? '') ||
          !CONNECTABLE.has(targetNode.type ?? '')) {
        toast.error('Port · 경유노드 · 충전소 간에만 경로를 연결할 수 있습니다.');
        return;
      }

      const edgeId = genEdgeId();
      const newEdge: Edge<TransferEdgeData> = {
        ...params,
        id: edgeId,
        type: 'transfer',
        source: params.source ?? '',
        target: params.target ?? '',
        data: { relationId: edgeId, weight: 5, hidden: false, system: '' },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEdges((eds) => addEdge(newEdge as Edge, eds) as any);
    },
    [setEdges, nodes],
  );

  /* ─── 다중 선택 변경 ─── */
  const onSelectionChange = useCallback(({ nodes: selected }: OnSelectionChangeParams) => {
    setSelectedPortNodes(selected.filter((n) => n.type === 'port'));
  }, []);

  /* ─── 엣지 우클릭 컨텍스트 메뉴 ─── */
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      // rfInstance 에서 직접 selected 엣지 조회 (state 지연 방지)
      const liveSelected = (rfInstanceRef.current?.getEdges() as Edge[] ?? [])
        .filter((e) => e.selected)
        .map((e) => e.id);
      const ids = liveSelected.length > 0
        ? (liveSelected.includes(edge.id) ? liveSelected : [...liveSelected, edge.id])
        : [edge.id];
      setEdgeContextMenu({ x: event.clientX, y: event.clientY, visible: true, edgeIds: ids });
      setContextMenu((prev) => ({ ...prev, visible: false }));
    },
    [],
  );

  /* ─── 시스템 일괄 지정 실행 ─── */
  const handleSystemAssign = useCallback(() => {
    const ids = pendingEdgeIdsRef.current;
    if (ids.length === 0) return;
    setEdges((eds) =>
      eds.map((e) =>
        ids.includes(e.id)
          ? { ...e, data: { ...(e.data ?? {}), system: pendingSystem } as TransferEdgeData }
          : e,
      ),
    );
    toast.success(`${ids.length}개 릴레이션에 시스템 "${pendingSystem}" 지정 완료`);
    setSystemDialogOpen(false);
    setPendingSystem('');
  }, [pendingSystem, setEdges]);

  /* ─── 노드 우클릭 컨텍스트 메뉴 ─── */
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (node.type !== 'port') return;

      // 2개 이상 선택된 포트가 있으면 그 목록을, 아니면 현재 노드만
      const currentPorts = selectedPortNodes.length >= 2
        ? selectedPortNodes
        : [node];
      setBatchPorts(currentPorts.map((n) => ({ id: n.id, data: n.data as PortNodeData })));
      setContextMenu({ x: event.clientX, y: event.clientY, visible: true });
    },
    [selectedPortNodes],
  );

  /* ─── 일괄 경로 생성 확인 ─── */
  const handleBatchRouteConfirm = useCallback(
    ({ system, weight }: { system: string; weight: number }) => {
      const newEdges: Edge<TransferEdgeData>[] = [];

      for (const src of batchPorts) {
        for (const tgt of batchPorts) {
          if (src.id === tgt.id) continue;
          if (src.data.direction === 'IN') continue;
          if (tgt.data.direction === 'OUT') continue;

          const exists = edges.some((e) => e.source === src.id && e.target === tgt.id);
          if (exists) continue;

          const edgeId = genEdgeId();
          newEdges.push({
            id: edgeId,
            source: src.id,
            target: tgt.id,
            type: 'transfer',
            data: { relationId: edgeId, weight, hidden: false, system },
          });
        }
      }

      if (newEdges.length === 0) {
        toast.info('생성할 수 있는 새 경로가 없습니다. (이미 모두 존재)');
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEdges((eds) => [...eds, ...(newEdges as any)]);
      toast.success(`경로 ${newEdges.length}개가 생성되었습니다.`);
    },
    [batchPorts, edges, setEdges],
  );

  /* ─── 드래그 오버 허용 ─── */
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  /* ─── 드롭으로 노드 생성 ─── */
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData('nodeType');
      if (!nodeType || !rfInstanceRef.current) return;

      const position = rfInstanceRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodes = createDropNodes(nodeType, position);
      if (newNodes.length > 0) {
        setNodes((nds) => [...nds, ...newNodes]);
      }
    },
    [setNodes],
  );

  /* ─── 릴레이션 표시 반영 — React Flow 네이티브 hidden 속성 사용 ─── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const displayEdges: Edge<any>[] = edges.map((e) => ({
    ...e,
    hidden: !relationsVisible,
    markerEnd: { type: 'arrowclosed' as const, color: '#94a3b8' },
  }));

  return (
    <div
      className="flex-1 overflow-hidden"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={(changes) => {
          onNodesChange(changes);
          notifyNodesChange(nodes);
        }}
        onEdgesChange={(changes) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onEdgesChange(changes as any);
          notifyEdgesChange(edges);
        }}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onSelectionChange={onSelectionChange}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onInit={(instance) => { rfInstanceRef.current = instance; }}
        onNodeClick={(_, node) => {
          setContextMenu((prev) => ({ ...prev, visible: false }));
          setEdgeContextMenu((prev) => ({ ...prev, visible: false }));
          onEdgeSelect(null);
          onNodeSelect(node as ModelerNode);
        }}
        onEdgeClick={(_, edge) => {
          setContextMenu((prev) => ({ ...prev, visible: false }));
          setEdgeContextMenu((prev) => ({ ...prev, visible: false }));
          onNodeSelect(null);
          onEdgeSelect(edge as TransferEdge);
        }}
        onPaneClick={() => {
          setContextMenu((prev) => ({ ...prev, visible: false }));
          setEdgeContextMenu((prev) => ({ ...prev, visible: false }));
          onNodeSelect(null);
          onEdgeSelect(null);
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          // rfInstance 에서 직접 selected 엣지 조회 (state 지연 방지)
          const liveSelected = (rfInstanceRef.current?.getEdges() as Edge[] ?? [])
            .filter((e) => e.selected)
            .map((e) => e.id);
          if (liveSelected.length > 0) {
            setEdgeContextMenu({ x: event.clientX, y: event.clientY, visible: true, edgeIds: liveSelected });
            setContextMenu((prev) => ({ ...prev, visible: false }));
          }
        }}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        snapToGrid
        snapGrid={[10, 10]}
        minZoom={0.2}
        maxZoom={4}
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e5e7eb" gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const d = node.data as Partial<StockerNodeData & ProcessNodeData & PathNodeData>;
            if (d.state === 'Online')  return '#22c55e';
            if (d.state === 'Error')   return '#ef4444';
            if (d.state === 'Offline') return '#9ca3af';
            return '#fbbf24';
          }}
          pannable
          zoomable
          className="!bottom-2 !right-2"
        />
      </ReactFlow>

      {/* 노드 우클릭 컨텍스트 메뉴 */}
      {contextMenu.visible && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedPortCount={batchPorts.length}
          onBatchRoute={() => {
            setContextMenu((prev) => ({ ...prev, visible: false }));
            setBatchDialogOpen(true);
          }}
          onClose={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
        />
      )}

      {/* 엣지 우클릭 컨텍스트 메뉴 */}
      {edgeContextMenu.visible && (
        <div
          className="fixed z-50 min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-lg text-[12px]"
          style={{ left: edgeContextMenu.x, top: edgeContextMenu.y }}
        >
          <div className="px-3 py-1 text-[10px] text-gray-400 border-b border-gray-100">
            릴레이션 {edgeContextMenu.edgeIds.length}개 선택
          </div>
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-indigo-50 text-left"
            onClick={() => {
              pendingEdgeIdsRef.current = edgeContextMenu.edgeIds;
              setPendingSystem('');
              setEdgeContextMenu((prev) => ({ ...prev, visible: false }));
              setSystemDialogOpen(true);
            }}
          >
            <span className="text-indigo-600">⚙</span> ACS 시스템 일괄 지정
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-red-50 text-left text-red-600"
            onClick={() => {
              const ids = new Set(edgeContextMenu.edgeIds);
              setEdges((eds) => eds.filter((e) => !ids.has(e.id)));
              setEdgeContextMenu((prev) => ({ ...prev, visible: false }));
              toast.success(`릴레이션 ${ids.size}개 삭제`);
            }}
          >
            <span>✕</span> 선택 릴레이션 삭제
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left text-gray-500"
            onClick={() => setEdgeContextMenu((prev) => ({ ...prev, visible: false }))}
          >
            닫기
          </button>
        </div>
      )}

      {/* 시스템 일괄 지정 다이얼로그 */}
      {systemDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold text-gray-800 mb-1">ACS 시스템 일괄 지정</p>
            <p className="text-[11px] text-gray-400 mb-3">
              릴레이션 {pendingEdgeIdsRef.current.length}개에 시스템을 지정합니다.
            </p>
            <input
              type="text"
              placeholder="예: ACS-001"
              value={pendingSystem}
              autoFocus
              onChange={(e) => setPendingSystem(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSystemAssign(); if (e.key === 'Escape') setSystemDialogOpen(false); }}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-300 focus:outline-none mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSystemDialogOpen(false)}
                className="rounded px-3 py-1 text-xs text-gray-500 hover:bg-gray-100"
              >취소</button>
              <button
                onClick={handleSystemAssign}
                disabled={!pendingSystem.trim()}
                className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-40"
              >적용</button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 경로 생성 모달 */}
      <BatchRouteDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        selectedPorts={batchPorts}
        onConfirm={handleBatchRouteConfirm}
      />
    </div>
  );
}
