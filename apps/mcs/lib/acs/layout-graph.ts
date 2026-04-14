/**
 * ACS — 레이아웃 그래프 유틸리티
 * mcs_layout.json_data 를 MCS 가 이미 읽어둔 useLayout() 결과로부터 받아
 * BFS 경로 탐색에 필요한 인접 리스트로 변환한다.
 *
 * MCS 와 같은 Supabase 테이블/React Query 캐시를 소비하므로
 * 별도 구독 없이 레이아웃 모델러 저장 → 자동 invalidate → ACS 즉시 새 경로.
 */

import type { Edge, Node } from '@xyflow/react';
import type { EquipmentUnit } from '@workspace/types/mcs';

/** 인접 리스트: mcs_equipment_unit.id (DB UUID) → 연결된 DB UUID[] */
export type AdjList = Map<string, string[]>;

/**
 * React Flow json_data 의 edges 배열을 인접 리스트로 변환
 *
 * - TransferEdge 의 source/target 은 RF node.id (예: "node-105")
 * - nodes + units 를 함께 전달해 RF ID → 친숙 코드 → DB UUID 로 변환
 * - adj 의 키/값은 모두 mcs_equipment_unit.id (DB UUID) — tick-loop/seeder 와 동일 체계
 * - bidirectional: true 시 역방향 엣지도 추가
 * - systemName 지정 시 edge.data.system 필터 적용
 */
export function buildAdjList(
  edges: Edge[],
  nodes: Node[],
  units: EquipmentUnit[],
  { bidirectional = false, systemName }: { bidirectional?: boolean; systemName?: string } = {},
): AdjList {
  // 1. RF 노드 ID → 친숙 코드 (PORT-001, ND-001 등) 매핑
  const rfToCode = new Map<string, string>();
  for (const n of nodes) {
    const d = n.data as Record<string, unknown>;
    const code = ((d.portId as string) || (d.nodeId as string) || n.id).trim();
    rfToCode.set(n.id, code);
  }

  // 2. 친숙 코드 → DB UUID 매핑
  const codeToDbId = new Map<string, string>();
  for (const u of units) {
    codeToDbId.set(u.equipmentUnitId, u.id);
  }

  // 3. RF ID → DB UUID 변환 헬퍼
  const toDbId = (rfId: string): string | null => {
    const code = rfToCode.get(rfId);
    if (!code) return null;
    return codeToDbId.get(code) ?? null;
  };

  const adj: AdjList = new Map();
  const addEdge = (from: string, to: string) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push(to);
  };

  for (const e of edges) {
    // 시스템 필터: systemName 이 지정되고 edge 에 다른 system 이 있으면 스킵
    if (systemName) {
      const edgeSystem = (e.data as Record<string, unknown> | undefined)?.system as string | undefined;
      if (edgeSystem && edgeSystem !== systemName) continue;
    }

    const fromId = toDbId(e.source);
    const toId   = toDbId(e.target);
    if (!fromId || !toId) continue; // DB 에 없는 노드 → 스킵

    addEdge(fromId, toId);
    if (bidirectional) addEdge(toId, fromId);
  }

  return adj;
}

/**
 * BFS 최단 경로 탐색
 * @returns 출발 → 목적지 node.id 배열 (출발·목적지 포함), 경로 없으면 null
 */
export function bfsPath(
  adj: AdjList,
  from: string,
  to: string,
): string[] | null {
  if (from === to) return [from];

  const visited = new Set<string>([from]);
  const queue: Array<string[]> = [[from]];

  while (queue.length > 0) {
    const path = queue.shift()!;
    const node = path[path.length - 1];
    const neighbors = adj.get(node) ?? [];

    for (const next of neighbors) {
      if (next === to) return [...path, next];
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }

  return null; // 경로 없음
}
