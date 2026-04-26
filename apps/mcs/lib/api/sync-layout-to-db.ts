import type { Node, Edge } from '@xyflow/react';
import { createClient } from '@/lib/supabase/client';
import type { PortNodeData, TransferEdgeData } from '@/components/layout-modeler/types';

/**
 * React Flow 노드/엣지 → Supabase 구조화 테이블 동기화
 *
 * 저장 전략: layoutId 기준 전체 delete 후 재삽입 (단순 일관성 유지)
 * 목적: A* 경로 탐색 엔진이 DB에서 그래프를 로드하기 위함
 *
 * 식별자 규칙:
 *  - equipment_id       = data.equipmentId (STK-001 등 친숙 코드). fallback → n.id
 *  - equipment_unit_id  = data.portId / data.nodeId (PORT-001 / ND-001 등). fallback → n.id
 *  - agv body port 의 unit_id = "{data.equipmentId}-body"
 *
 * 내부 React Flow id (n.id = "node-NNN") 는 DB에 노출하지 않음.
 * 대신 codeToRfId 역매핑으로 엣지 소스/타겟(RF id) → DB uuid 를 해소.
 */
export async function syncLayoutToDb(
  layoutId: string,
  nodes: Node[],
  edges: Edge[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseOverride?: any,
): Promise<void> {
  // API Route 등 서버 환경에서는 service_role 클라이언트를 주입, 없으면 브라우저 클라이언트 사용
  const supabase = supabaseOverride ?? createClient();

  // ── 1. 기존 구간 연결 먼저 삭제 (FK 제약: unit 삭제 전 relation 삭제 필요) ─

  const { error: delRelFirst } = await supabase
    .from('mcs_transfer_relation')
    .delete()
    .eq('layout_id', layoutId);
  if (delRelFirst) throw delRelFirst;

  // ── 2. 장비 노드 (stocker / process / agv) 동기화 ──────────────

  const equipmentNodes = nodes.filter(
    (n) => n.type === 'stocker' || n.type === 'process' || n.type === 'agv',
  );
  const agvNodes  = nodes.filter((n) => n.type === 'agv');
  // charge 노드(충전소)는 경로망의 일부 → pathNodes 에 포함
  const pathNodes = nodes.filter((n) => n.type === 'node' || n.type === 'charge');

  // 기존 장비 전체 삭제 (cascade로 unit도 삭제됨)
  const { error: delEqpErr } = await supabase
    .from('mcs_equipment')
    .delete()
    .eq('layout_id', layoutId);
  if (delEqpErr) throw delEqpErr;

  // 새 장비 삽입
  const equipmentRows = equipmentNodes.map((n) => {
    let equipment_type = 'Process';
    if (n.type === 'stocker') equipment_type = 'Stocker';
    else if (n.type === 'agv') equipment_type = 'AGV';
    const d = n.data as { name?: string; systemName?: string; state?: string; equipmentId?: string };

    // equipment_id: 사용자 친숙 코드 (STK-001 등). fallback → RF node.id
    const equipment_id = d.equipmentId?.trim() || n.id;

    // AGV: systemName(ACS-001 등)을 ec_server_name 에 저장 → ACS BFS 필터링
    // Stocker/Process: equipmentId 를 ec_server_name 에 저장 (= 설비 식별자로 활용)
    const ec_server_name = equipment_type === 'AGV'
      ? (d.systemName?.trim() ?? d.name ?? '')
      : equipment_id;

    return {
      equipment_id,
      layout_id:    layoutId,
      equipment_type,
      ec_server_name,
      inline_stocker: false,
      state:          d.state ?? 'Online',
    };
  });

  // RF node.id → DB uuid 매핑 (포트의 parentEquipmentId 는 RF id 기반)
  const nodeIdToDbId: Record<string, string> = {};

  if (equipmentRows.length > 0) {
    const { data: insertedEqp, error: insEqpErr } = await supabase
      .from('mcs_equipment')
      .insert(equipmentRows)
      .select('id, equipment_id');
    if (insEqpErr) throw insEqpErr;

    // equipment_id(친숙 코드) → DB uuid 매핑
    const codeToEqpDbId: Record<string, string> = {};
    (insertedEqp ?? []).forEach((row: { equipment_id: string; id: string }) => {
      codeToEqpDbId[row.equipment_id] = row.id;
    });

    // RF node.id 기준 매핑 구성:
    //   RF id → 친숙 코드 → DB uuid
    equipmentNodes.forEach((n) => {
      const d = n.data as { equipmentId?: string };
      const code = d.equipmentId?.trim() || n.id;
      const dbId = codeToEqpDbId[code];
      if (dbId) {
        nodeIdToDbId[n.id] = dbId;   // RF id → DB uuid (포트 parentEquipmentId 해소용)
        nodeIdToDbId[code] = dbId;   // 친숙 코드 → DB uuid (보조)
      }
    });
  }

  // ── 2-A. Node 전용 navigation equipment 생성 ──────────────────────
  // (mcs_equipment_unit.equipment_id NOT NULL FK 제약 충족을 위해 필요)

  let navEquipmentDbId: string | null = null;

  if (pathNodes.length > 0) {
    const { data: navEqp, error: navEqpErr } = await supabase
      .from('mcs_equipment')
      .insert({
        equipment_id:   `${layoutId}-nav`,
        layout_id:      layoutId,
        equipment_type: 'Navigation',
        ec_server_name: '',
        inline_stocker: false,
        state:          'Online',
      })
      .select('id')
      .single();
    if (navEqpErr) throw navEqpErr;
    navEquipmentDbId = navEqp.id;
  }

  // ── 2-B. 포트 + Node + AGV body port 유닛 동기화 ────────────────

  const portNodes = nodes.filter((n) => n.type === 'port');

  // RF id → 친숙 unit 코드 역매핑 (insert 후 unitIdToDbId 에 RF id 기준 항목도 추가하기 위해)
  const rfToUnitCode = new Map<string, string>();

  const portUnitRows = portNodes
    .filter((n) => !!nodeIdToDbId[(n.data as PortNodeData).parentEquipmentId])
    .map((n) => {
      const pData = n.data as PortNodeData;
      const unitCode = pData.portId?.trim() || n.id;  // PORT-001 등 친숙 코드
      rfToUnitCode.set(n.id, unitCode);
      return {
        equipment_unit_id: unitCode,
        equipment_id:      nodeIdToDbId[pData.parentEquipmentId],
        unit_type:         'Port',
        in_out_mode:       pData.direction === 'IN'  ? 'In'
                         : pData.direction === 'OUT' ? 'Out'
                         : 'Both',
        transfer_state:    'Idle',
      };
    });

  const pathNodeUnitRows = navEquipmentDbId
    ? pathNodes.map((n) => {
        const d = n.data as { nodeId?: string };
        const unitCode = d.nodeId?.trim() || n.id;  // ND-001 등 친숙 코드
        rfToUnitCode.set(n.id, unitCode);
        return {
          equipment_unit_id: unitCode,
          equipment_id:      navEquipmentDbId as string,
          unit_type:         'Node',
          in_out_mode:       'Both',
          transfer_state:    'Idle',
        };
      })
    : [];

  // AGV body port: 각 AGV 장비에 unit_type='AGV' unit 하나 자동 생성 (캐리어 픽업용)
  const agvBodyPortRows = agvNodes
    .filter((n) => !!nodeIdToDbId[n.id])
    .map((n) => {
      const d = n.data as { equipmentId?: string };
      const eqpCode = d.equipmentId?.trim() || n.id;  // AGV-001
      const bodyCode = `${eqpCode}-body`;              // AGV-001-body
      rfToUnitCode.set(`${n.id}-body`, bodyCode);
      return {
        equipment_unit_id: bodyCode,
        equipment_id:      nodeIdToDbId[n.id],
        unit_type:         'AGV',                      // ACS tick-loop.ts 에서 이 type 으로 body port 조회
        in_out_mode:       'Both',
        transfer_state:    'Idle',
      };
    });

  // unit 친숙 코드 → DB uuid 매핑 (+ RF id → DB uuid 역매핑)
  const unitIdToDbId: Record<string, string> = {};

  const allUnitRows = [...portUnitRows, ...pathNodeUnitRows, ...agvBodyPortRows];
  if (allUnitRows.length > 0) {
    const { data: insertedUnits, error: insUnitErr } = await supabase
      .from('mcs_equipment_unit')
      .insert(allUnitRows)
      .select('id, equipment_unit_id');
    if (insUnitErr) throw insUnitErr;

    (insertedUnits ?? []).forEach((row: { equipment_unit_id: string; id: string }) => {
      unitIdToDbId[row.equipment_unit_id] = row.id;
    });

    // RF id → DB uuid 역매핑 추가 (TransferEdge 소스/타겟이 RF id 기준)
    rfToUnitCode.forEach((code, rfId) => {
      const dbId = unitIdToDbId[code];
      if (dbId) unitIdToDbId[rfId] = dbId;
    });
  }

  // ── 2-C. AGV location_id 초기화 (homeNodeId → 충전소 unit DB uuid) ────
  // 저장 시점에 AGV 의 초기 위치를 DB 에 등록. ACS 가 이 값으로 AGV 출발점을 인식함.

  for (const n of agvNodes) {
    const d = n.data as { homeNodeId?: string; equipmentId?: string };
    if (!d.homeNodeId?.trim()) continue;  // homeNodeId 미지정 시 스킵

    const homeUnitDbId = unitIdToDbId[d.homeNodeId.trim()];  // 충전소 unit DB uuid
    const agvEqpCode   = d.equipmentId?.trim() || n.id;
    const agvEqpDbId   = nodeIdToDbId[agvEqpCode] ?? nodeIdToDbId[n.id];

    if (!homeUnitDbId || !agvEqpDbId) continue;

    const { error: locErr } = await supabase
      .from('mcs_equipment')
      .update({ location_id: homeUnitDbId })
      .eq('id', agvEqpDbId);
    if (locErr) throw locErr;
  }

  // ── 3. 구간 연결 (TransferEdge) 동기화 ──────────────────────────

  const transferEdges = edges.filter((e) => e.type === 'transfer');

  const relationRows = transferEdges
    .filter((e) => unitIdToDbId[e.source] && unitIdToDbId[e.target])
    .map((e) => {
      const eData = e.data as TransferEdgeData | undefined;
      return {
        layout_id:         layoutId,
        departure_unit_id: unitIdToDbId[e.source],
        arrival_unit_id:   unitIdToDbId[e.target],
        weight:            eData?.weight ?? 1.0,
      };
    });

  if (relationRows.length > 0) {
    const { error: insRelErr } = await supabase
      .from('mcs_transfer_relation')
      .insert(relationRows);
    if (insRelErr) throw insRelErr;
  } else {
    // 전이 관계 0건: 모든 transfer 엣지의 source/target 이 유닛 매핑에 없음
    console.warn(
      `[syncLayoutToDb] 전이 관계 0건 삽입 — ` +
      `transfer 엣지: ${transferEdges.length}건, ` +
      `매핑된 unitId 수: ${Object.keys(unitIdToDbId).length}`,
    );
  }
}
