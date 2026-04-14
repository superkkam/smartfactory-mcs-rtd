/**
 * 더미 레이아웃 데이터 (React Flow 형식)
 * Task 006(대시보드), Task 007(레이아웃 모델러) 에서 사용
 *
 * 구조:
 *  - Stocker 노드 × 2 (각각 Port 노드 × 2가 근처에 독립 배치)
 *  - Process 노드 × 2 (각각 Port 노드 × 2가 근처에 독립 배치)
 *  - Node × 3 (AMR 경로 중간 지점)
 *  - TransferEdge: 포트/노드 간 연결, weight/hidden 필드 포함
 *
 * 포트 노드는 설비와 독립된 자유 노드 — 드래그로 원하는 위치에 배치 가능
 */

import type { Node, Edge } from '@xyflow/react';
import type {
  StockerNodeData,
  ProcessNodeData,
  PortNodeData,
  PathNodeData,
  TransferEdgeData,
} from '@/components/layout-modeler/types';

/* ─── 대시보드 호환 타입 (레거시) ─── */
export type EquipmentNodeData = {
  equipmentId: string;
  name: string;
  equipmentType: 'STOCKER' | 'PROCESS' | 'PORT' | 'CRANE';
  state: 'Online' | 'Offline' | 'Error';
};

export type { TransferEdgeData };

/* ─── 노드 정의 ─── */

// Stocker A (Bay-1 West)
const STK_A: Node<StockerNodeData> = {
  id: 'stk-001',
  type: 'stocker',
  position: { x: 40, y: 120 },
  data: { equipmentId: 'EQP-001', name: 'STOCKER-A', state: 'Online', portCount: 2 },
};
// Stocker-A 포트 — 설비 우측 근처에 독립 배치
const STK_A_PORT1: Node<PortNodeData> = {
  id: 'stk-001-port-1',
  type: 'port',
  position: { x: 240, y: 120 },
  data: { portId: 'PORT-A1', name: 'PORT-A1', direction: 'OUT', parentEquipmentId: 'EQP-001' },
};
const STK_A_PORT2: Node<PortNodeData> = {
  id: 'stk-001-port-2',
  type: 'port',
  position: { x: 240, y: 160 },
  data: { portId: 'PORT-A2', name: 'PORT-A2', direction: 'IN', parentEquipmentId: 'EQP-001' },
};

// Stocker B (Bay-2 West)
const STK_B: Node<StockerNodeData> = {
  id: 'stk-002',
  type: 'stocker',
  position: { x: 40, y: 340 },
  data: { equipmentId: 'EQP-002', name: 'STOCKER-B', state: 'Offline', portCount: 2 },
};
const STK_B_PORT1: Node<PortNodeData> = {
  id: 'stk-002-port-1',
  type: 'port',
  position: { x: 240, y: 340 },
  data: { portId: 'PORT-B1', name: 'PORT-B1', direction: 'OUT', parentEquipmentId: 'EQP-002' },
};
const STK_B_PORT2: Node<PortNodeData> = {
  id: 'stk-002-port-2',
  type: 'port',
  position: { x: 240, y: 380 },
  data: { portId: 'PORT-B2', name: 'PORT-B2', direction: 'IN', parentEquipmentId: 'EQP-002' },
};

// Process 1 (Bay-1 Center)
const PROC_1: Node<ProcessNodeData> = {
  id: 'proc-001',
  type: 'process',
  position: { x: 540, y: 100 },
  data: { equipmentId: 'EQP-004', name: 'PROCESS-01', state: 'Online', portCount: 2 },
};
// Process-1 포트 — 설비 좌측 근처에 독립 배치
const PROC_1_PORT1: Node<PortNodeData> = {
  id: 'proc-001-port-1',
  type: 'port',
  position: { x: 480, y: 110 },
  data: { portId: 'PORT-P1L', name: 'PORT-P1L', direction: 'BOTH', parentEquipmentId: 'EQP-004' },
};
const PROC_1_PORT2: Node<PortNodeData> = {
  id: 'proc-001-port-2',
  type: 'port',
  position: { x: 480, y: 150 },
  data: { portId: 'PORT-P1R', name: 'PORT-P1R', direction: 'BOTH', parentEquipmentId: 'EQP-004' },
};

// Process 2 (Bay-2 Center)
const PROC_2: Node<ProcessNodeData> = {
  id: 'proc-002',
  type: 'process',
  position: { x: 540, y: 310 },
  data: { equipmentId: 'EQP-005', name: 'PROCESS-02', state: 'Error', portCount: 2 },
};
const PROC_2_PORT1: Node<PortNodeData> = {
  id: 'proc-002-port-1',
  type: 'port',
  position: { x: 480, y: 320 },
  data: { portId: 'PORT-P2L', name: 'PORT-P2L', direction: 'BOTH', parentEquipmentId: 'EQP-005' },
};
const PROC_2_PORT2: Node<PortNodeData> = {
  id: 'proc-002-port-2',
  type: 'port',
  position: { x: 480, y: 360 },
  data: { portId: 'PORT-P2R', name: 'PORT-P2R', direction: 'BOTH', parentEquipmentId: 'EQP-005' },
};

// Node (AMR 경로 중간 지점)
const ND_1: Node<PathNodeData> = {
  id: 'nd-001',
  type: 'node',
  position: { x: 360, y: 120 },
  data: { nodeId: 'ND-001', label: 'ND-1' },
};
const ND_2: Node<PathNodeData> = {
  id: 'nd-002',
  type: 'node',
  position: { x: 360, y: 230 },
  data: { nodeId: 'ND-002', label: 'ND-2' },
};
const ND_3: Node<PathNodeData> = {
  id: 'nd-003',
  type: 'node',
  position: { x: 360, y: 350 },
  data: { nodeId: 'ND-003', label: 'ND-3' },
};

/** 레이아웃 모델러 전체 노드 목록 */
export const DUMMY_NODES: Node[] = [
  STK_A, STK_A_PORT1, STK_A_PORT2,
  STK_B, STK_B_PORT1, STK_B_PORT2,
  PROC_1, PROC_1_PORT1, PROC_1_PORT2,
  PROC_2, PROC_2_PORT1, PROC_2_PORT2,
  ND_1, ND_2, ND_3,
];

/* ─── 엣지 정의 ─── */

/** 더미 반송 관계 엣지 (AMR 경로) */
export const DUMMY_EDGES: Edge<TransferEdgeData>[] = [
  {
    id: 'tr-001',
    source: 'stk-001-port-1',
    target: 'nd-001',
    type: 'transfer',
    data: { relationId: 'TR-001', weight: 8.5, hidden: false, system: 'ACS-001' },
  },
  {
    id: 'tr-002',
    source: 'nd-001',
    target: 'proc-001-port-1',
    type: 'transfer',
    data: { relationId: 'TR-002', weight: 12.0, hidden: false, system: 'ACS-001' },
  },
  {
    id: 'tr-003',
    source: 'nd-001',
    target: 'nd-002',
    type: 'transfer',
    data: { relationId: 'TR-003', weight: 6.0, hidden: false, system: 'ACS-001' },
  },
  {
    id: 'tr-004',
    source: 'nd-002',
    target: 'proc-001-port-2',
    type: 'transfer',
    data: { relationId: 'TR-004', weight: 10.5, hidden: false, system: 'ACS-001' },
  },
  {
    id: 'tr-005',
    source: 'stk-002-port-1',
    target: 'nd-003',
    type: 'transfer',
    data: { relationId: 'TR-005', weight: 9.0, hidden: false, system: 'ACS-002' },
  },
  {
    id: 'tr-006',
    source: 'nd-003',
    target: 'proc-002-port-1',
    type: 'transfer',
    data: { relationId: 'TR-006', weight: 11.5, hidden: false, system: 'ACS-002' },
  },
];
