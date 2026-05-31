/**
 * MAPF (Multi-Agent Path Finding) 시나리오용 그리드 레이아웃
 *
 * 구성 (8×8 그리드, 완전 연결):
 *  - Path Node × 64  (ND-R1C1 ~ ND-R8C8, 4-connected 양방향 — 모든 셀 연결)
 *  - Stocker   × 4   (모서리 배치, STK-M1~M4)
 *  - Process   × 6   (상단 3 + 하단 3, PROC-M1~M6)
 *  - Charge    × 4   (좌우 중간, CHG-M1~M4)
 *  - AGV       × 8   (MAPF 최소 스케일, AMR-M01~M08)
 *
 * 장애물 설계 방침:
 *  - 레이아웃에는 장애물 없음 (완전 연결 그리드)
 *  - 장애물은 시뮬레이션 런타임에 랜덤 생성 → blockedNodes 파라미터로 전달
 *  - A* / PPO / CACTUS / CBS-TS 알고리즘이 동일 장애물 상황에서
 *    어떻게 우회하는지 비교 (논문 실험 시나리오)
 *
 * 좌표 체계:
 *  그리드 원점: (200, 200), 셀 크기: 120px × 120px
 *  설비 여백: 상하좌우 200px
 */

import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type {
  StockerNodeData,
  ProcessNodeData,
  PortNodeData,
  PathNodeData,
  ChargeNodeData,
  AgvNodeData,
  TransferEdgeData,
} from '@/components/layout-modeler/types';

/* ────────────────────────────────────────────────
   레이아웃 상수
──────────────────────────────────────────────── */
const GRID_ROWS = 8;
const GRID_COLS = 8;
const CELL = 120;       // 셀 간격 (px)
const ORIGIN_X = 200;   // 그리드 시작 X
const ORIGIN_Y = 200;   // 그리드 시작 Y
const EQ_MARGIN = 160;  // 장비 여백 (그리드 외곽)

/* ────────────────────────────────────────────────
   헬퍼
──────────────────────────────────────────────── */
const BIDIR = { type: MarkerType.ArrowClosed, width: 12, height: 12 };

function ndId(r: number, c: number): string {
  return `mapf-nd-r${r + 1}c${c + 1}`;
}
function ndCode(r: number, c: number): string {
  return `MAPF-ND-R${r + 1}C${c + 1}`;
}
function gridX(c: number): number {
  return ORIGIN_X + c * CELL;
}
function gridY(r: number): number {
  return ORIGIN_Y + r * CELL;
}

/* ────────────────────────────────────────────────
   노드 생성
──────────────────────────────────────────────── */
let _idSeq = 1000;
const uid = () => `mapf-${_idSeq++}`;
let _edgeSeq = 1000;
const eid = () => `mapf-e${_edgeSeq++}`;

const _nodes: Node[] = [];
const _edges: Edge[] = [];

/* 1. Path Node 그리드 — 64개 전체, 장애물 없음 */
for (let r = 0; r < GRID_ROWS; r++) {
  for (let c = 0; c < GRID_COLS; c++) {
    _nodes.push({
      id:       ndId(r, c),
      type:     'node',
      position: { x: gridX(c), y: gridY(r) },
      data:     { nodeId: ndCode(r, c) } satisfies PathNodeData,
    });
  }
}

/* 2. 4-connected 양방향 엣지 — 모든 인접 셀 완전 연결 */
for (let r = 0; r < GRID_ROWS; r++) {
  for (let c = 0; c < GRID_COLS; c++) {
    // 오른쪽 이웃
    if (c + 1 < GRID_COLS) {
      _edges.push({
        id:          eid(),
        type:        'transfer',
        source:      ndId(r, c),
        target:      ndId(r, c + 1),
        markerEnd:   BIDIR,
        markerStart: BIDIR,
        data:        { weight: 1, hidden: false } as TransferEdgeData,
      });
    }
    // 아래쪽 이웃
    if (r + 1 < GRID_ROWS) {
      _edges.push({
        id:          eid(),
        type:        'transfer',
        source:      ndId(r, c),
        target:      ndId(r + 1, c),
        markerEnd:   BIDIR,
        markerStart: BIDIR,
        data:        { weight: 1, hidden: false } as TransferEdgeData,
      });
    }
  }
}

/* ────────────────────────────────────────────────
   장비 배치 헬퍼
──────────────────────────────────────────────── */
function addEquipment(
  id: string,
  type: 'stocker' | 'process',
  eqpId: string,
  name: string,
  x: number,
  y: number,
  ports: Array<{ portId: string; dir: 'IN' | 'OUT' | 'BOTH'; ox: number; oy: number; gridConnectId: string }>,
) {
  const eqpData = type === 'stocker'
    ? { equipmentId: eqpId, name, state: 'Online', portCount: ports.length } satisfies StockerNodeData
    : { equipmentId: eqpId, name, state: 'Online', portCount: ports.length } satisfies ProcessNodeData;

  _nodes.push({ id, type, position: { x, y }, data: eqpData });

  ports.forEach((p) => {
    const portNodeId = `${id}-port-${p.portId.toLowerCase()}`;
    _nodes.push({
      id:       portNodeId,
      type:     'port',
      position: { x: x + p.ox, y: y + p.oy },
      data:     { portId: p.portId, name: p.portId, direction: p.dir, parentEquipmentId: id } satisfies PortNodeData,
    });
    // 포트 ↔ 그리드 노드 연결
    _edges.push({
      id:         eid(),
      type:       'transfer',
      source:     portNodeId,
      target:     p.gridConnectId,
      markerEnd:  BIDIR,
      markerStart: BIDIR,
      data:       { weight: 1, hidden: false } as TransferEdgeData,
    });
  });
}

/* ────────────────────────────────────────────────
   3. Stocker × 4 (모서리)
──────────────────────────────────────────────── */
// STK-M1: 상단-좌측 (r=0, c=0 외곽)
addEquipment(uid(), 'stocker', 'STK-M1', '스토커 M1',
  ORIGIN_X - EQ_MARGIN - 100, ORIGIN_Y - EQ_MARGIN - 60,
  [
    { portId: 'STK-M1-P1', dir: 'BOTH', ox: 40, oy: 120, gridConnectId: ndId(0, 0) },
    { portId: 'STK-M1-P2', dir: 'BOTH', ox: 90, oy: 120, gridConnectId: ndId(0, 1) },
  ],
);
// STK-M2: 상단-우측
addEquipment(uid(), 'stocker', 'STK-M2', '스토커 M2',
  gridX(GRID_COLS - 1) + EQ_MARGIN, ORIGIN_Y - EQ_MARGIN - 60,
  [
    { portId: 'STK-M2-P1', dir: 'BOTH', ox: -20, oy: 120, gridConnectId: ndId(0, GRID_COLS - 2) },
    { portId: 'STK-M2-P2', dir: 'BOTH', ox: 30, oy: 120, gridConnectId: ndId(0, GRID_COLS - 1) },
  ],
);
// STK-M3: 하단-좌측
addEquipment(uid(), 'stocker', 'STK-M3', '스토커 M3',
  ORIGIN_X - EQ_MARGIN - 100, gridY(GRID_ROWS - 1) + EQ_MARGIN,
  [
    { portId: 'STK-M3-P1', dir: 'BOTH', ox: 40, oy: -80, gridConnectId: ndId(GRID_ROWS - 1, 0) },
    { portId: 'STK-M3-P2', dir: 'BOTH', ox: 90, oy: -80, gridConnectId: ndId(GRID_ROWS - 1, 1) },
  ],
);
// STK-M4: 하단-우측
addEquipment(uid(), 'stocker', 'STK-M4', '스토커 M4',
  gridX(GRID_COLS - 1) + EQ_MARGIN, gridY(GRID_ROWS - 1) + EQ_MARGIN,
  [
    { portId: 'STK-M4-P1', dir: 'BOTH', ox: -20, oy: -80, gridConnectId: ndId(GRID_ROWS - 1, GRID_COLS - 2) },
    { portId: 'STK-M4-P2', dir: 'BOTH', ox: 30, oy: -80, gridConnectId: ndId(GRID_ROWS - 1, GRID_COLS - 1) },
  ],
);

/* ────────────────────────────────────────────────
   4. Process × 6 (상단 3 + 하단 3)
──────────────────────────────────────────────── */
const procTopCols  = [1, 4, 6];   // 상단 Process 연결 열 (col)
const procBotCols  = [1, 4, 6];   // 하단 Process 연결 열
procTopCols.forEach((col, i) => {
  const eqpId = `PROC-M${i + 1}`;
  addEquipment(uid(), 'process', eqpId, `공정 M${i + 1}`,
    gridX(col) - 50, ORIGIN_Y - EQ_MARGIN - 80,
    [
      { portId: `${eqpId}-IN`,  dir: 'IN',  ox: 20, oy: 120, gridConnectId: ndId(0, col) },
      { portId: `${eqpId}-OUT`, dir: 'OUT', ox: 70, oy: 120, gridConnectId: ndId(0, col < GRID_COLS - 1 ? col + 1 : col) },
    ],
  );
});
procBotCols.forEach((col, i) => {
  const eqpId = `PROC-M${i + 4}`;
  addEquipment(uid(), 'process', eqpId, `공정 M${i + 4}`,
    gridX(col) - 50, gridY(GRID_ROWS - 1) + EQ_MARGIN + 20,
    [
      { portId: `${eqpId}-IN`,  dir: 'IN',  ox: 20, oy: -80, gridConnectId: ndId(GRID_ROWS - 1, col) },
      { portId: `${eqpId}-OUT`, dir: 'OUT', ox: 70, oy: -80, gridConnectId: ndId(GRID_ROWS - 1, col < GRID_COLS - 1 ? col + 1 : col) },
    ],
  );
});

/* ────────────────────────────────────────────────
   5. Charge × 4 (좌우 중간)
──────────────────────────────────────────────── */
[2, 5].forEach((row, i) => {
  // 좌측 충전소
  const chgLId = `mapf-chg-l${i + 1}`;
  _nodes.push({
    id:       chgLId,
    type:     'charge',
    position: { x: ORIGIN_X - EQ_MARGIN - 40, y: gridY(row) - 20 },
    data:     { nodeId: `CHG-M${i * 2 + 1}` } satisfies ChargeNodeData,
  });
  _edges.push({
    id: eid(), type: 'transfer', source: chgLId, target: ndId(row, 0),
    markerEnd: BIDIR, markerStart: BIDIR,
    data: { weight: 1, hidden: false } as TransferEdgeData,
  });

  // 우측 충전소
  const chgRId = `mapf-chg-r${i + 1}`;
  _nodes.push({
    id:       chgRId,
    type:     'charge',
    position: { x: gridX(GRID_COLS - 1) + EQ_MARGIN, y: gridY(row) - 20 },
    data:     { nodeId: `CHG-M${i * 2 + 2}` } satisfies ChargeNodeData,
  });
  _edges.push({
    id: eid(), type: 'transfer', source: chgRId, target: ndId(row, GRID_COLS - 1),
    markerEnd: BIDIR, markerStart: BIDIR,
    data: { weight: 1, hidden: false } as TransferEdgeData,
  });
});

/* ────────────────────────────────────────────────
   6. AGV × 8 (TYPE_A×3, TYPE_B×3, TYPE_C×2)
──────────────────────────────────────────────── */
const agvDefs: Array<{ id: string; eqpId: string; name: string; homeChgId: string; x: number; y: number }> = [
  { id: 'mapf-agv-01', eqpId: 'AMR-M01', name: 'AMR M01 (A)', homeChgId: 'mapf-chg-l1', x: ORIGIN_X - EQ_MARGIN - 40, y: gridY(2) + 60 },
  { id: 'mapf-agv-02', eqpId: 'AMR-M02', name: 'AMR M02 (A)', homeChgId: 'mapf-chg-l1', x: ORIGIN_X - EQ_MARGIN - 40, y: gridY(2) + 120 },
  { id: 'mapf-agv-03', eqpId: 'AMR-M03', name: 'AMR M03 (A)', homeChgId: 'mapf-chg-r1', x: gridX(GRID_COLS - 1) + EQ_MARGIN + 60, y: gridY(2) + 60 },
  { id: 'mapf-agv-04', eqpId: 'AMR-M04', name: 'AMR M04 (B)', homeChgId: 'mapf-chg-l2', x: ORIGIN_X - EQ_MARGIN - 40, y: gridY(5) + 60 },
  { id: 'mapf-agv-05', eqpId: 'AMR-M05', name: 'AMR M05 (B)', homeChgId: 'mapf-chg-l2', x: ORIGIN_X - EQ_MARGIN - 40, y: gridY(5) + 120 },
  { id: 'mapf-agv-06', eqpId: 'AMR-M06', name: 'AMR M06 (B)', homeChgId: 'mapf-chg-r2', x: gridX(GRID_COLS - 1) + EQ_MARGIN + 60, y: gridY(5) + 60 },
  { id: 'mapf-agv-07', eqpId: 'AMR-M07', name: 'AMR M07 (C)', homeChgId: 'mapf-chg-r1', x: gridX(GRID_COLS - 1) + EQ_MARGIN + 60, y: gridY(2) + 120 },
  { id: 'mapf-agv-08', eqpId: 'AMR-M08', name: 'AMR M08 (C)', homeChgId: 'mapf-chg-r2', x: gridX(GRID_COLS - 1) + EQ_MARGIN + 60, y: gridY(5) + 120 },
];

agvDefs.forEach((a) => {
  _nodes.push({
    id:       a.id,
    type:     'agv',
    position: { x: a.x, y: a.y },
    data:     {
      equipmentId: a.eqpId,
      name:        a.name,
      systemName:  'ACS-MAPF',
      state:       'Idle',
      homeNodeId:  a.homeChgId,
    } satisfies AgvNodeData,
  });
});

/* ────────────────────────────────────────────────
   내보내기
──────────────────────────────────────────────── */
export const MAPF_NODES: Node[] = _nodes;
export const MAPF_EDGES: Edge[] = _edges;

/** MAPF 시나리오 메타데이터 */
export const MAPF_META = {
  designName:  'MAPF Grid 8×8',
  designId:    'MAPF-LAYOUT-001',
  gridRows:    GRID_ROWS,
  gridCols:    GRID_COLS,
  agvCount:    agvDefs.length,
  amrTypes:    { TYPE_A: 3, TYPE_B: 3, TYPE_C: 2 },
  description: '8×8 완전 연결 그리드 MAPF 시나리오 — 장애물은 런타임 랜덤 생성',
};
