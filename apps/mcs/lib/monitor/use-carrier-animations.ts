'use client';

/**
 * useCarrierAnimations — framer-motion 기반 위치 보간 훅
 *
 * useLayoutMonitor 가 emit 하는 HopEvent 를 소비해
 * AGV 노드 위치를 Transfer Relation 엣지 경로를 따라 부드럽게 보간한다.
 *
 * 핵심 설계 원칙:
 * 1. useLayoutEffect 로 paint 전 positionsRef 설정 → 첫 프레임 순간이동 방지
 * 2. 단일 animate(0→1) 로 X/Y 동시 보간 → 경쟁 조건 없음
 * 3. scheduleRender (RAF 기반) 로 초당 최대 60회 re-render
 * 4. MAX_DURATION=800ms → Quick Demo 1000ms 대비 200ms 여유
 * 5. BFS 로 Transfer Relation 엣지 최단 경로 → waypoint 순서 이동
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';
import { getSmoothStepPath, Position, type Node, type Edge } from '@xyflow/react';
import type { Equipment, EquipmentUnit, Carrier } from '@workspace/types/mcs';
import type { HopEvent } from '@/lib/api/layout-monitor';

/** 이동 속도 및 시간 파라미터 */
const MIN_DURATION_MS  = 400;   // 단일 구간 최소 이동 시간 (ms)
const MAX_DURATION_MS  = 800;   // 단일 구간 최대 이동 시간 — Quick Demo 1000ms 대비 200ms 여유
const SPEED_PX_PER_SEC = 150;   // 픽셀/초
/** 큐 최대 허용 대기 hop 수 (초과 시 오래된 hop ack + 최신 위치로 스냅) */
const MAX_PENDING = 2;

/**
 * AGV 위에 캐리어를 얹을 때의 오프셋 (AGV node top-left 기준)
 * DashboardAgvNode: SVG 44×26px
 * CarrierNode: SVG 20×20px
 */
const CARRIER_ON_AGV_X = 12;
const CARRIER_ON_AGV_Y = -14;

// ─── 경로 탐색 헬퍼 ─────────────────────────────────────────────────────────

function unitIdToRfNode(
  unitId: string,
  units: EquipmentUnit[],
  rfNodes: Node[],
): Node | null {
  const unit = units.find((u) => u.id === unitId);
  if (!unit) return null;

  if (unit.unitType === 'Node') {
    return rfNodes.find((n) =>
      (n.type === 'node' || n.type === 'charge') && (
        (n.data as { nodeId?: string }).nodeId === unit.equipmentUnitId ||
        n.id === unit.equipmentUnitId
      )
    ) ?? null;
  }

  if (unit.unitType === 'Port') {
    return rfNodes.find((n) =>
      n.type === 'port' && (
        (n.data as { portId?: string }).portId === unit.equipmentUnitId ||
        n.id === unit.equipmentUnitId
      )
    ) ?? null;
  }

  return null;
}

/**
 * Transfer Relation 엣지 그래프에서 BFS 최단 경로 탐색 (단방향)
 * 역방향 엣지를 추가하지 않으므로, 텔레포트(역방향 이동) 시 경로 탐색 실패 → 즉시 스냅
 */
function bfsRfPath(fromId: string, toId: string, edges: Edge[]): string[] | null {
  if (fromId === toId) return [fromId];

  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
    // 역방향 엣지 제거 — 텔레포트(역방향 점프) 시 BFS 실패 → 즉시 스냅 처리
  }

  const visited = new Set<string>([fromId]);
  const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    for (const neighbor of adj.get(id) ?? []) {
      if (neighbor === toId) return [...path, neighbor];
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ id: neighbor, path: [...path, neighbor] });
      }
    }
  }
  return null;
}

function rfNodeCenter(node: Node): { x: number; y: number } {
  return { x: node.position.x + 16, y: node.position.y + 16 };
}

/** 핸들 ID ("t"|"l"|"b"|"r") → React Flow Position */
const HANDLE_POSITION: Record<string, Position> = {
  t: Position.Top,
  b: Position.Bottom,
  l: Position.Left,
  r: Position.Right,
};

/**
 * 노드의 특정 핸들 연결 좌표를 반환한다.
 * handle 이 없으면 상대 노드 방향으로 가장 가까운 면을 자동 선택.
 */
function getHandlePoint(
  node: Node,
  handle: string | undefined | null,
  otherNode: Node,
): { x: number; y: number; position: Position } {
  const w  = (node.measured?.width  ?? node.width  ?? 32) as number;
  const h  = (node.measured?.height ?? node.height ?? 32) as number;
  const cx = node.position.x + w / 2;
  const cy = node.position.y + h / 2;

  const pos: Position = (handle && HANDLE_POSITION[handle])
    ? HANDLE_POSITION[handle]
    : (() => {
        // handle 정보 없음 → 상대 노드 방향으로 자동 결정
        const ow = (otherNode.measured?.width  ?? otherNode.width  ?? 32) as number;
        const oh = (otherNode.measured?.height ?? otherNode.height ?? 32) as number;
        const dx = (otherNode.position.x + ow / 2) - cx;
        const dy = (otherNode.position.y + oh / 2) - cy;
        if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? Position.Right : Position.Left;
        return dy >= 0 ? Position.Bottom : Position.Top;
      })();

  switch (pos) {
    case Position.Top:    return { x: cx,                 y: node.position.y,     position: pos };
    case Position.Bottom: return { x: cx,                 y: node.position.y + h, position: pos };
    case Position.Left:   return { x: node.position.x,   y: cy,                  position: pos };
    case Position.Right:  return { x: node.position.x + w, y: cy,                position: pos };
  }
}

/**
 * 두 노드 사이의 Transfer Relation 엣지를 getSmoothStepPath 로 계산하고
 * totalLength 비율로 numSamples 개 좌표를 샘플링해 반환한다.
 *
 * reverse=true 이면 target→source 방향으로 샘플링.
 */
function sampleEdgePath(
  edge: Edge,
  sourceNode: Node,
  targetNode: Node,
  reverse: boolean,
  numSamples: number = 18,
): Array<{ x: number; y: number }> {
  const src = getHandlePoint(sourceNode, edge.sourceHandle, targetNode);
  const tgt = getHandlePoint(targetNode, edge.targetHandle, sourceNode);

  const [pathD] = getSmoothStepPath({
    sourceX:        src.x,
    sourceY:        src.y,
    sourcePosition: src.position,
    targetX:        tgt.x,
    targetY:        tgt.y,
    targetPosition: tgt.position,
    borderRadius:   8,
  });

  // 임시 SVG 엘리먼트로 경로 길이 측정 및 등간격 샘플링
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg   = document.createElementNS(svgNs, 'svg');
  const pathEl = document.createElementNS(svgNs, 'path');
  pathEl.setAttribute('d', pathD);
  svg.appendChild(pathEl);
  // DOM 에 임시 삽입해야 getTotalLength() 동작
  svg.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0;overflow:hidden';
  document.body.appendChild(svg);

  const total  = pathEl.getTotalLength();
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 1; i <= numSamples; i++) {
    const t   = i / numSamples;
    const len = reverse ? total * (1 - t) : total * t;
    const pt  = pathEl.getPointAtLength(len);
    points.push({ x: pt.x, y: pt.y });
  }

  document.body.removeChild(svg);
  return points;
}

function unitToRFPosition(
  unitId: string | null,
  units: EquipmentUnit[],
  rfNodes: Node[],
  equipments: Equipment[],
): { x: number; y: number } | null {
  if (!unitId) return null;

  const unit = units.find((u) => u.id === unitId);
  if (!unit) return null;

  if (unit.unitType === 'Node') {
    const rfNode = rfNodes.find((n) =>
      (n.type === 'node' || n.type === 'charge') && (
        (n.data as { nodeId?: string }).nodeId === unit.equipmentUnitId ||
        n.id === unit.equipmentUnitId
      )
    );
    if (!rfNode) return null;
    return rfNodeCenter(rfNode);
  }

  if (unit.unitType === 'Port') {
    const rfNode = rfNodes.find((n) =>
      n.type === 'port' && (
        (n.data as { portId?: string }).portId === unit.equipmentUnitId ||
        n.id === unit.equipmentUnitId
      )
    );
    if (rfNode) return rfNodeCenter(rfNode);
    // port RF 노드 못찾으면 아래 부모장비 폴백으로 계속
  }

  if (unit.unitType === 'AGV') {
    // AGV body unit → 부모 AGV equipment의 현재 locationId(Node unit)로 재귀 탐색
    const parentEq = equipments.find((e) => e.id === unit.equipmentId);
    if (parentEq?.locationId && parentEq.locationId !== unitId) {
      return unitToRFPosition(parentEq.locationId, units, rfNodes, equipments);
    }
    return null;
  }

  const parentEq = equipments.find((e) => e.id === unit.equipmentId);
  if (!parentEq) return null;

  const parentNode = rfNodes.find((n) =>
    (n.data as Record<string, unknown>)?.equipmentId === parentEq.equipmentId
  );
  if (!parentNode) return null;

  const w = (parentNode.measured?.width  ?? parentNode.width  ?? 200) as number;
  const h = (parentNode.measured?.height ?? parentNode.height ?? 80)  as number;

  return {
    x: parentNode.position.x + w / 2 - 20,
    y: parentNode.position.y + h / 2 - 20,
  };
}

/**
 * progress (0~1) 값을 waypoints 구간 보간으로 변환
 * times[i] = waypoints[i]에 도달하는 정규화 시간 (0~1)
 */
function interpolateWaypoints(
  progress: number,
  from: { x: number; y: number },
  waypoints: Array<{ x: number; y: number }>,
  times: number[],
): { x: number; y: number } {
  const allPoints = [from, ...waypoints];
  const allTimes  = [0,    ...times];

  // progress 가 속하는 구간 탐색
  let segIdx = allTimes.length - 2;
  for (let i = 1; i < allTimes.length; i++) {
    if (progress <= allTimes[i]) {
      segIdx = i - 1;
      break;
    }
  }

  const segStart = allTimes[segIdx];
  const segEnd   = allTimes[segIdx + 1] ?? 1;
  const t        = (progress - segStart) / (segEnd - segStart || 1);

  const p0 = allPoints[segIdx];
  const p1 = allPoints[segIdx + 1] ?? p0;

  return {
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t,
  };
}

// ─── 훅 인터페이스 ───────────────────────────────────────────────────────────

interface UseCarrierAnimationsParams {
  hopEvents:      HopEvent[];
  ackHopEvent:    (id: string) => void;
  equipmentNodes: Node[];
  layoutEdges:    Edge[];
  units:          EquipmentUnit[];
  equipments:     Equipment[];
  carriers:       Carrier[];
}

interface AnimationHandle {
  stop: () => void;
}

export function useCarrierAnimations({
  hopEvents,
  ackHopEvent,
  equipmentNodes,
  layoutEdges,
  units,
  equipments,
  carriers,
}: UseCarrierAnimationsParams): { animatedNodes: Node[] } {
  /** entityId → 현재 보간 좌표 */
  const positionsRef       = useRef<Map<string, { x: number; y: number }>>(new Map());
  /** 캐리어 ID → 마지막으로 렌더링된 위치 (위치 계산 일시 실패 시 fallback — 사라짐 방지) */
  const lastCarrierPosRef  = useRef<Map<string, { x: number; y: number }>>(new Map());
  /**
   * 캐리어 ID → 마지막으로 알려진 parent AMR equipment ID + 안전 deadline.
   *
   * DB 가 Depositing 시점에 carrier.state 를 'Installed' 로 패치하면
   * 현재 렌더링 코드는 AMR 추적을 즉시 중단하고 destination port 위치로 텔레포트한다.
   * 이 ref 는 carrier 가 한 번이라도 AMR 에 올라탔던 사실을 기억하고,
   * AMR 의 framer-motion 애니메이션이 시각적으로 destination 에 도착할 때까지
   * 캐리어를 AMR 위에 계속 sticky 렌더링하기 위한 캐시.
   *
   * deadline: Date.now() + 5000 — 어떤 이유로든 sticky 가 풀리지 않을 때 강제 해제 (5초 안전망)
   */
  const carrierStickyAmrRef = useRef<Map<string, { amrId: string; deadline: number }>>(new Map());
  /** entityId → 현재 실행 중인 framer-motion 핸들 */
  const activeAnimsRef     = useRef<Map<string, AnimationHandle>>(new Map());
  /** 현재 애니메이션 중인 hop ID 집합 */
  const animatingHopIdsRef = useRef<Set<string>>(new Set());
  /** entityId → 현재 애니메이션 중인 hop ID */
  const entityHopMapRef    = useRef<Map<string, string>>(new Map());
  /** requestAnimationFrame handle — re-render 배치용 */
  const tickRafRef         = useRef<number | null>(null);

  // stale 클로저 방지 — 최신 props 를 ref 로 동기화
  const unitsRef          = useRef(units);
  const equipmentNodesRef = useRef(equipmentNodes);
  const equipmentsRef     = useRef(equipments);
  const layoutEdgesRef    = useRef(layoutEdges);

  useEffect(() => { unitsRef.current          = units;          }, [units]);
  useEffect(() => { equipmentNodesRef.current = equipmentNodes; }, [equipmentNodes]);
  useEffect(() => { equipmentsRef.current     = equipments;     }, [equipments]);
  useEffect(() => { layoutEdgesRef.current    = layoutEdges;    }, [layoutEdges]);

  const [tick, setTick] = useState(0);

  /**
   * RAF 기반 re-render 스케줄러
   * — 같은 프레임 내에서 여러 onUpdate 가 호출돼도 re-render 는 한 번만 발생
   */
  function scheduleRender() {
    if (tickRafRef.current !== null) return;
    tickRafRef.current = requestAnimationFrame(() => {
      tickRafRef.current = null;
      setTick((t) => t + 1);
    });
  }

  // ── 초기화: AGV 가 처음 등장할 때 positionsRef 에 현재 위치 설정 ──────────
  // useLayoutEffect → paint 전에 실행되므로 eq.locationId 폴백보다 먼저 값을 채움
  // → 첫 hop 도착 시 한 프레임 동안 목적지에 렌더되는 순간이동 방지
  useLayoutEffect(() => {
    for (const eq of equipments) {
      if (eq.equipmentType !== 'AGV') continue;
      if (positionsRef.current.has(eq.id)) continue; // 이미 애니메이션이 관리 중
      const pos = unitToRFPosition(eq.locationId ?? '', units, equipmentNodes, equipments);
      if (pos) positionsRef.current.set(eq.id, pos);
    }
  }, [equipments, units, equipmentNodes]);

  // ── 메인 hop 처리: useLayoutEffect 로 paint 전에 positionsRef 를 fromPos 로 설정 ──
  useLayoutEffect(() => {
    if (hopEvents.length === 0) return;

    const _units          = unitsRef.current;
    const _equipmentNodes = equipmentNodesRef.current;
    const _equipments     = equipmentsRef.current;
    const _layoutEdges    = layoutEdgesRef.current;

    // ── 1. 캐리어 hop 즉시 ack ─────────────────────────────────────────────
    for (const ev of hopEvents) {
      if (ev.entityType === 'carrier') ackHopEvent(ev.id);
    }

    // ── 2. 엔티티별 장비 hop 수집 ──────────────────────────────────────────
    const hopsByEntity = new Map<string, HopEvent[]>();
    for (const ev of hopEvents) {
      if (ev.entityType === 'carrier') continue;
      if (!hopsByEntity.has(ev.entityId)) hopsByEntity.set(ev.entityId, []);
      hopsByEntity.get(ev.entityId)!.push(ev);
    }

    // ── 3. 엔티티별 처리 ──────────────────────────────────────────────────
    for (const [entityId, hops] of hopsByEntity) {
      // 이미 이 엔티티의 hop 이 애니메이션 중 → 완료될 때까지 대기
      if (entityHopMapRef.current.has(entityId)) continue;

      // 누적 hop 이 MAX_PENDING 초과 → 오래된 것 ack + 최신 위치로 스냅
      if (hops.length > MAX_PENDING) {
        const toSkip = hops.slice(0, hops.length - 1);
        for (const old of toSkip) {
          if (!animatingHopIdsRef.current.has(old.id)) ackHopEvent(old.id);
        }
        const latest   = hops[hops.length - 1];
        const snapPos  = unitToRFPosition(latest.toUnitId, _units, _equipmentNodes, _equipments);
        if (snapPos) {
          positionsRef.current.set(entityId, snapPos);
          ackHopEvent(latest.id);
          setTick((t) => t + 1);
        }
        continue;
      }

      // 처리할 hop: 가장 오래된 것 (큐 직렬화)
      const ev = hops[0];

      // 이미 처리 중인 hop ID → 스킵
      if (animatingHopIdsRef.current.has(ev.id)) continue;

      // fromPos: 현재 보간 위치 → 없으면 DB의 출발 위치
      let fromPos = positionsRef.current.get(entityId) ?? null;
      if (!fromPos && ev.fromUnitId) {
        fromPos = unitToRFPosition(ev.fromUnitId, _units, _equipmentNodes, _equipments);
      }

      const toPos = unitToRFPosition(ev.toUnitId, _units, _equipmentNodes, _equipments);

      if (!toPos) {
        // toPos를 해석할 수 없어도 기존 위치 유지 — 삭제하면 AMR 위 캐리어가 사라짐
        ackHopEvent(ev.id);
        continue;
      }

      if (!fromPos) {
        // 최초 등장 → toPos 로 스냅 후 ack
        positionsRef.current.set(entityId, toPos);
        ackHopEvent(ev.id);
        setTick((t) => t + 1);
        continue;
      }

      // ── 스냅 방지: paint 전에 fromPos 를 positionsRef 에 미리 저장 ────────
      // (useLayoutEffect 내 실행 → render 보다 먼저 반영)
      positionsRef.current.set(entityId, fromPos);

      // ── BFS 경로 탐색 → getSmoothStepPath 기반 엣지 경로 샘플링 ──────
      // 각 엣지의 실제 L자/ㄷ자 SVG 경로를 따라 waypoints 생성
      // → 대각선이 아닌 실제 릴레이션 경로 위를 이동
      const fromNode = ev.fromUnitId ? unitIdToRfNode(ev.fromUnitId, _units, _equipmentNodes) : null;
      const toNode   = ev.toUnitId   ? unitIdToRfNode(ev.toUnitId,   _units, _equipmentNodes) : null;

      const waypoints: Array<{ x: number; y: number }> = [];

      if (fromNode && toNode && fromNode.id !== toNode.id) {
        const rfPath = bfsRfPath(fromNode.id, toNode.id, _layoutEdges);

        // 비인접 hop (텔레포트) → 즉시 스냅 (역주행 방지)
        // 정상 hop: rfPath = [A, B] (길이=2, 직접 연결 엣지)
        // 텔레포트: rfPath = [A, X, Y, B] (길이>2, 다중 hop = 비인접 이동)
        // → 역방향 엣지로 경로를 찾더라도 길이>2이면 역주행 없이 즉시 스냅
        if (rfPath && rfPath.length > 2) {
          positionsRef.current.set(entityId, toPos);
          ackHopEvent(ev.id);
          setTick((t) => t + 1);
          continue;
        }

        // 인접 노드 (길이=2) → 엣지 경로 따라 애니메이션
        if (rfPath && rfPath.length === 2) {
          for (let i = 0; i < rfPath.length - 1; i++) {
            const curId  = rfPath[i];
            const nextId = rfPath[i + 1];

            // 두 노드를 연결하는 Transfer Relation 엣지 탐색
            const edge = _layoutEdges.find(
              (e) => (e.source === curId && e.target === nextId) ||
                     (e.source === nextId && e.target === curId),
            );

            if (edge) {
              const srcNode = _equipmentNodes.find((nd) => nd.id === edge.source);
              const tgtNode = _equipmentNodes.find((nd) => nd.id === edge.target);
              if (srcNode && tgtNode) {
                // 이동 방향이 엣지의 source→target 반대이면 reverse
                const reverse = edge.source !== curId;
                const pts = sampleEdgePath(edge, srcNode, tgtNode, reverse);
                waypoints.push(...pts);
                continue;
              }
            }

            // 엣지를 찾지 못한 경우 → 노드 중심점 직선 폴백
            const n = _equipmentNodes.find((nd) => nd.id === nextId);
            if (n) waypoints.push(rfNodeCenter(n));
          }
        }
      }

      if (waypoints.length === 0) waypoints.push(toPos);

      // BFS 경로를 찾지 못한 경우 (텔레포트 / 역방향 점프) → 즉시 스냅
      // from/to 노드가 다르고 waypoints 가 toPos 하나뿐이면 단방향 BFS 실패를 의미
      const isTeleportSnap =
        fromNode && toNode && fromNode.id !== toNode.id && waypoints.length === 1;

      // ── 거리 기반 duration 산출 ────────────────────────────────────────
      const distances: number[] = [];
      let prevPt = fromPos;
      for (const wp of waypoints) {
        distances.push(Math.hypot(wp.x - prevPt.x, wp.y - prevPt.y) || 1);
        prevPt = wp;
      }
      const totalDist = distances.reduce((a, b) => a + b, 0);

      // 전체 경로 길이 기반 duration 계산 — MIN/MAX 는 "한 홉 전체" 단위로 clamp.
      // (이전 코드: perSegMs에 clamp를 적용하고 waypoints.length를 곱해
      //  홉당 7~14초가 되는 버그가 있었음. MAX_PENDING snap 텔레포트의 근본 원인.)
      const totalMs  = (totalDist / SPEED_PX_PER_SEC) * 1000;
      const clamped  = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, totalMs));
      // 텔레포트는 duration=0 → framer-motion 즉시 완료 (스냅)
      const duration = isTeleportSnap ? 0 : clamped / 1000;

      let cum = 0;
      const times = distances.map((d) => {
        cum += d / totalDist;
        return Math.min(cum, 1);
      });
      times[times.length - 1] = 1;

      const capturedFrom = { ...fromPos };
      const capturedWps  = [...waypoints];
      const capturedTimes = [...times];
      const lastWp   = waypoints[waypoints.length - 1];
      const hopId    = ev.id;

      animatingHopIdsRef.current.add(hopId);
      entityHopMapRef.current.set(entityId, hopId);

      // ── 단일 progress(0→1) 기반 보간 ──────────────────────────────────
      // X/Y 를 하나의 animate 로 동기화 → 경쟁 조건 없음
      const anim = animate(0, 1, {
        duration,
        ease: 'linear',
        onUpdate: (progress: number) => {
          const pos = interpolateWaypoints(progress, capturedFrom, capturedWps, capturedTimes);
          positionsRef.current.set(entityId, pos);
          scheduleRender();
        },
        onComplete: () => {
          positionsRef.current.set(entityId, lastWp);
          activeAnimsRef.current.delete(entityId);
          animatingHopIdsRef.current.delete(hopId);
          entityHopMapRef.current.delete(entityId);
          ackHopEvent(hopId);
          scheduleRender();
        },
      });

      activeAnimsRef.current.set(entityId, { stop: () => anim.stop() });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hopEvents]);

  // 언마운트 시 진행 중 애니메이션 + RAF 정리
  useEffect(() => {
    return () => {
      for (const handle of activeAnimsRef.current.values()) handle.stop();
      if (tickRafRef.current !== null) cancelAnimationFrame(tickRafRef.current);
    };
  }, []);

  // ─── animatedNodes 생성 ───────────────────────────────────────────────────
  const animatedNodes: Node[] = [];

  for (const eq of equipments) {
    if (eq.equipmentType !== 'AGV') continue;

    // positionsRef 우선 — useLayoutEffect 초기화 또는 애니메이션이 항상 값을 보장
    const pos = positionsRef.current.get(eq.id);
    // positionsRef 에 값이 없으면 DB 위치로 최후 폴백 (초기 렌더)
    const currentPos = pos ?? unitToRFPosition(eq.locationId ?? '', units, equipmentNodes, equipments);
    if (!currentPos) continue;

    const agvTopLeft = { x: currentPos.x - 22, y: currentPos.y - 13 };

    animatedNodes.push({
      id:       `amr-${eq.id}`,
      type:     'agv',
      position: agvTopLeft,
      width:    44,
      height:   26,
      measured: { width: 44, height: 26 },
      data: {
        equipmentId: eq.equipmentId,
        name:        eq.equipmentId,
        systemName:  eq.ecServerName ?? '',
        state:       eq.state,
      },
      draggable:  false,
      selectable: false,
      zIndex:     9,
    });
  }

  for (const carrier of carriers) {
    if (!carrier.locationId) continue;

    // ── 1. parent AMR 결정 ───────────────────────────────────────────────────
    // 우선순위 1: state='Transferring' + currentEquipmentId 직접 매칭
    //   → unit cache stale 여부와 무관하게 AMR 을 즉시 특정할 수 있음
    let parentAgv: Equipment | undefined;
    if (carrier.state === 'Transferring' && carrier.currentEquipmentId) {
      parentAgv = equipments.find(
        (e) => e.id === carrier.currentEquipmentId && e.equipmentType === 'AGV',
      );
    }
    // 우선순위 2: unit lookup (state 가 다르거나 currentEquipmentId 누락 시 fallback)
    if (!parentAgv) {
      const unit = units.find((u) => u.id === carrier.locationId);
      if (unit?.unitType === 'AGV') {
        parentAgv = equipments.find(
          (e) => e.id === unit.equipmentId && e.equipmentType === 'AGV',
        );
      }
    }

    // sticky 캐시 갱신 / 우선순위 3 적용 ─────────────────────────────────────
    if (parentAgv) {
      // 활성 parent 발견 → sticky 캐시에 기록 (다음 Installed 전환 시 사용)
      carrierStickyAmrRef.current.set(carrier.id, {
        amrId:    parentAgv.id,
        deadline: Date.now() + 5000,
      });
    } else {
      // 우선순위 3 (Sticky AMR): DB 가 carrier.state 를 'Installed' 로 미리 패치해도
      //   AMR 의 framer-motion 애니메이션이 시각적으로 도착할 때까지 캐리어를 AMR 위에 유지.
      //   → "AMR 은 천천히 가는데 캐리어만 텔레포트" 현상의 핵심 수정.
      const sticky = carrierStickyAmrRef.current.get(carrier.id);
      if (sticky) {
        if (Date.now() >= sticky.deadline) {
          // 5초 안전 deadline 초과 → 강제 해제
          carrierStickyAmrRef.current.delete(carrier.id);
        } else {
          const stickyAmr = equipments.find(
            (e) => e.id === sticky.amrId && e.equipmentType === 'AGV',
          );
          if (stickyAmr) {
            // hop 큐가 아직 처리 중이면 무조건 sticky 유지
            const stillAnimating = entityHopMapRef.current.has(sticky.amrId);
            // positionsRef(현재 보간 좌표) vs unitToRFPosition(DB 목적지) 거리 비교
            const animatedPos = positionsRef.current.get(sticky.amrId);
            const dbTargetPos = unitToRFPosition(
              stickyAmr.locationId ?? '',
              units, equipmentNodes, equipments,
            );
            const visuallyArrived = (() => {
              if (stillAnimating) return false;
              if (!animatedPos || !dbTargetPos) return true; // 위치 모름 → 도착으로 간주
              return Math.hypot(
                animatedPos.x - dbTargetPos.x,
                animatedPos.y - dbTargetPos.y,
              ) < 2;
            })();

            if (!visuallyArrived) {
              // 아직 이동 중 → sticky AMR 위에 렌더 (텔레포트 방지 ★)
              parentAgv = stickyAmr;
            } else {
              // 시각적 도착 완료 → sticky 해제, destination port 로 자연 전환
              carrierStickyAmrRef.current.delete(carrier.id);
            }
          } else {
            // sticky 가 가리키는 AMR 가 더 이상 없음 → 해제
            carrierStickyAmrRef.current.delete(carrier.id);
          }
        }
      }
    }

    if (parentAgv) {
      // ── 2. AGV 중심 위치 4단계 폴백 ─────────────────────────────────────
      // ① positionsRef (framer-motion 실시간 보간 좌표)
      // ② animatedNodes 에 이미 추가된 AMR 노드 position 역산
      // ③ unitToRFPosition (AMR equipment.locationId 기반 정적 좌표)
      // ④ 모두 실패 시 lastCarrierPosRef (직전 렌더 위치 유지 — 사라짐 절대 방지)
      const agvCenter: { x: number; y: number } | null =
        positionsRef.current.get(parentAgv.id) ??
        (() => {
          const n = animatedNodes.find((nd) => nd.id === `amr-${parentAgv!.id}`);
          return n ? { x: n.position.x + 22, y: n.position.y + 13 } : null;
        })() ??
        unitToRFPosition(parentAgv.locationId ?? '', units, equipmentNodes, equipments);

      // ── 3. 캐리어 위치 결정 ──────────────────────────────────────────────
      let carrierPos: { x: number; y: number } | null = null;
      if (agvCenter) {
        // AGV topLeft = center - (22, 13), 오프셋 적용
        carrierPos = {
          x: agvCenter.x - 22 + CARRIER_ON_AGV_X,
          y: agvCenter.y - 13 + CARRIER_ON_AGV_Y,
        };
        lastCarrierPosRef.current.set(carrier.id, carrierPos);
      } else {
        // ④ 폴백: 이전 프레임 위치 유지 (일시적 race condition 흡수)
        carrierPos = lastCarrierPosRef.current.get(carrier.id) ?? null;
      }

      if (!carrierPos) continue;

      animatedNodes.push({
        id:        `carrier-${carrier.id}`,
        type:      'carrier',
        position:  carrierPos,
        width:     20,
        height:    20,
        measured:  { width: 20, height: 20 },
        data:      { carrierId: carrier.carrierId, state: carrier.state },
        draggable:  false,
        selectable: false,
        zIndex:     10,
      });
      continue;
    }

    // ── parentAgv 없음 → 정적 Port/Node 위치 ──────────────────────────────
    const basePos =
      unitToRFPosition(carrier.locationId, units, equipmentNodes, equipments) ??
      lastCarrierPosRef.current.get(carrier.id) ??
      null;
    if (!basePos) continue;
    lastCarrierPosRef.current.set(carrier.id, basePos);
    animatedNodes.push({
      id:       `carrier-${carrier.id}`,
      type:     'carrier',
      position: basePos,
      width:    20,
      height:   20,
      measured: { width: 20, height: 20 },
      data:     { carrierId: carrier.carrierId, state: carrier.state },
      draggable:  false,
      selectable: false,
      zIndex:     10,
    });
  }

  // Fix C: 삭제된 캐리어 ID 를 ref 에서 정리 (메모리 누수 방지)
  const currentCarrierIds = new Set(carriers.map((c) => c.id));
  for (const id of lastCarrierPosRef.current.keys()) {
    if (!currentCarrierIds.has(id)) lastCarrierPosRef.current.delete(id);
  }
  // sticky cache 도 같이 정리
  for (const id of carrierStickyAmrRef.current.keys()) {
    if (!currentCarrierIds.has(id)) carrierStickyAmrRef.current.delete(id);
  }

  void tick;

  return { animatedNodes };
}
