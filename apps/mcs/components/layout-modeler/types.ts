/**
 * 레이아웃 모델러 노드/엣지 타입 정의
 * AMR 기반 반송: Process+Port 그룹, Node(경유점), TransferRelation 엣지
 */

// React Flow Node 타입과 도메인 PathNode 충돌 방지를 위해 별칭 사용
import type { Node as RFNode, Edge } from '@xyflow/react';
import type { SymbolState } from '@/components/symbols';

/* ─── 노드 데이터 타입 ─── */

export type ProcessNodeData = {
  equipmentId: string;
  name: string;
  state: SymbolState;
  portCount: number;
};

export type StockerNodeData = {
  equipmentId: string;
  name: string;
  state: SymbolState;
  portCount: number;
};

export type PortNodeData = {
  portId: string;
  name: string;
  direction: 'IN' | 'OUT' | 'BOTH';
  parentEquipmentId: string;
};

/** AMR 경로망 경유 노드 (구 Waypoint) */
export type PathNodeData = {
  nodeId: string;
  label?: string;
};

/** 하위 호환: 구버전 JSONB 데이터의 waypointId 필드 처리용 */
export type LegacyWaypointData = PathNodeData & { waypointId?: string };

/* ─── 엣지 데이터 타입 ─── */

export type TransferEdgeData = {
  relationId: string;
  weight: number;    // 거리/가중치 (미터 단위)
  hidden: boolean;   // 릴레이션 보이기/숨기기 토글
  system?: string;   // 반송 담당 ACS 시스템 ID (transportEquipmentId 대응)
};

/** AGV/AMR 이동형 장비 노드 데이터 */
export type AgvNodeData = {
  equipmentId: string;
  name: string;
  /** ACS 시스템 이름 (예: ACS-001). 이 이름과 같은 시스템의 경로만 사용. */
  systemName: string;
  state: string;
  /** 홈 노드 ID (충전소). 저장 시 mcs_equipment.location_id 로 세팅됨. */
  homeNodeId?: string;
};

/** 충전소 노드 데이터 (경로망 경유 노드 + AGV 홈 위치) */
export type ChargeNodeData = {
  nodeId: string;
  label?: string;
};

/* ─── React Flow Node/Edge 타입 별칭 ─── */

export type ProcessNode = RFNode<ProcessNodeData, 'process'>;
export type StockerNode = RFNode<StockerNodeData, 'stocker'>;
export type PortNode    = RFNode<PortNodeData,    'port'>;
export type PathNode    = RFNode<PathNodeData,    'node'>;
export type AgvNode     = RFNode<AgvNodeData,    'agv'>;
export type ChargeNode  = RFNode<ChargeNodeData, 'charge'>;

export type ModelerNode = ProcessNode | StockerNode | PortNode | PathNode | AgvNode | ChargeNode;
export type TransferEdge = Edge<TransferEdgeData>;
