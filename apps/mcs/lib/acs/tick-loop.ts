'use client';

/**
 * ACS — Tick Loop 훅
 *
 * SEMI E82 축소판 vehicle state machine 을 브라우저 탭에서 100ms 주기로 구동.
 *
 * 기능:
 * - setInterval(100ms) 기반 tick 루프
 * - localStorage 기반 leader lock: 여러 탭이 열려도 한 탭만 tick 수행
 * - React StrictMode 이중 실행 방지 (useRef 가드)
 * - ACS 상태(vehicles, 에러 등)를 React state 로 노출 → UI 패널에 표시
 *
 * 차량 이동 규칙 (Vehicle Controller):
 * - Pending micro_command 중 미할당(executor_equipment_id IS NULL) 을 Idle AMR 에 할당
 * - 매 tick 마다 각 AMR 의 상태 전이 + path 노드 이동
 * - Supabase 업데이트: mcs_equipment.location_id, mcs_carrier.location_id, mcs_micro_command.state
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  isMobileEquipment,
  shouldAdvancePath,
  nextVehicleState,
  nextUnitId,
  currentUnitId,
} from './vehicle-controller';
import { loadGraphClient } from '@/lib/engine/graph-loader-client';
import { runAstar } from '@/lib/engine/astar';
import type { GraphNode } from '@/lib/engine/types';
import type { AcsVehicle, AcsState, AcsLeaderLock } from './types';
import { ACS_LEADER_KEY } from './types';

import type { Equipment, EquipmentUnit, Carrier } from '@workspace/types/mcs';
import type { Edge, Node } from '@xyflow/react';

const TICK_INTERVAL_MS = 100;
const HEARTBEAT_MS = 500;
const LEADER_TIMEOUT_MS = 1500;

/** directed 그래프를 복사해 역방향 엣지를 추가한 양방향 그래프 반환 */
function makeBidirectional(graph: Map<string, GraphNode>): Map<string, GraphNode> {
  const bi = new Map<string, GraphNode>();
  graph.forEach((node, id) => {
    bi.set(id, { ...node, neighbors: [...node.neighbors] });
  });
  graph.forEach((node) => {
    for (const nb of node.neighbors) {
      const target = bi.get(nb.toUnitId);
      if (target && !target.neighbors.some((n) => n.toUnitId === node.id)) {
        target.neighbors.push({ toUnitId: node.id, weight: nb.weight });
      }
    }
  });
  return bi;
}

// ─── Leader lock helpers ──────────────────────────────────────────

let _tabId: string | null = null;
function getTabId(): string {
  if (!_tabId) _tabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return _tabId;
}

function isLeader(): boolean {
  try {
    const raw = localStorage.getItem(ACS_LEADER_KEY);
    if (!raw) return false;
    const lock: AcsLeaderLock = JSON.parse(raw);
    if (lock.tabId === getTabId()) return true;
    // 리더가 timeout 됐으면 이 탭이 리더로 승계
    if (Date.now() - lock.heartbeat > LEADER_TIMEOUT_MS) return true;
    return false;
  } catch {
    return false;
  }
}

function claimLeader(): boolean {
  try {
    const raw = localStorage.getItem(ACS_LEADER_KEY);
    if (raw) {
      const lock: AcsLeaderLock = JSON.parse(raw);
      // 다른 탭이 살아있으면 claim 실패
      if (lock.tabId !== getTabId() && Date.now() - lock.heartbeat <= LEADER_TIMEOUT_MS) {
        return false;
      }
    }
    const newLock: AcsLeaderLock = { tabId: getTabId(), heartbeat: Date.now() };
    localStorage.setItem(ACS_LEADER_KEY, JSON.stringify(newLock));
    return true;
  } catch {
    return false;
  }
}

function updateHeartbeat() {
  try {
    const raw = localStorage.getItem(ACS_LEADER_KEY);
    if (!raw) return;
    const lock: AcsLeaderLock = JSON.parse(raw);
    if (lock.tabId !== getTabId()) return;
    localStorage.setItem(ACS_LEADER_KEY, JSON.stringify({ ...lock, heartbeat: Date.now() }));
  } catch {
    // 무시
  }
}

function releaseLeader() {
  try {
    const raw = localStorage.getItem(ACS_LEADER_KEY);
    if (!raw) return;
    const lock: AcsLeaderLock = JSON.parse(raw);
    if (lock.tabId === getTabId()) localStorage.removeItem(ACS_LEADER_KEY);
  } catch {
    // 무시
  }
}

// ─── 훅 인터페이스 ────────────────────────────────────────────────

export interface UseAcsTickLoopParams {
  /** 레이아웃 JSON 에서 추출한 nodes (React Flow Node[]) */
  layoutNodes: Node[];
  /** 레이아웃 JSON 에서 추출한 edges (React Flow Edge[]) */
  layoutEdges: Edge[];
  /** 현재 레이아웃의 모든 장비 (mobile + stationary) */
  equipments: Equipment[];
  /** 현재 레이아웃의 모든 equipment_unit */
  units: EquipmentUnit[];
  /** 모든 캐리어 */
  carriers: Carrier[];
  /** 현재 선택된 레이아웃 DB uuid (홈 복귀 경로 계산에 사용) */
  layoutId?: string;
}

export interface UseAcsTickLoopResult {
  acsState: AcsState;
  isLeaderTab: boolean;
  /** 수동 시작 (토글) */
  start: () => void;
  /** 수동 정지 (토글) */
  stop: () => void;
  /** 특정 AGV 를 다음 tick 에 충전소로 복귀시킴 (Idle 일 때만 실제 트리거됨) */
  requestReturnHome: (equipmentId: string) => void;
}

/**
 * ACS 메인 tick loop 훅
 * `/acs` 페이지에서 호출. 리더 탭만 실제 DB write 를 수행.
 */
export function useAcsTickLoop({
  layoutNodes,
  layoutEdges,
  equipments,
  layoutId,
  units,
  carriers,
}: UseAcsTickLoopParams): UseAcsTickLoopResult {
  const [acsState, setAcsState] = useState<AcsState>({
    isRunning: false,
    vehicles: new Map(),
    lastTickAt: null,
    tickCount: 0,
    error: null,
  });
  const [isLeaderTab, setIsLeaderTab] = useState(false);

  // 내부 차량 상태 (렌더 트리거 없이 최신 값 유지)
  const vehiclesRef = useRef<Map<string, AcsVehicle>>(new Map());
  const runningRef = useRef(false);
  const tickBusyRef = useRef(false); // 동시 tick 실행 방지 mutex
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 최신 props 를 ref 로 유지 (클로저 stale 방지)
  const equipmentsRef  = useRef(equipments);
  const unitsRef       = useRef(units);
  const carriersRef    = useRef(carriers);
  const layoutEdgesRef = useRef(layoutEdges);
  const layoutNodesRef = useRef(layoutNodes);
  const layoutIdRef    = useRef(layoutId);

  useEffect(() => { equipmentsRef.current  = equipments;   }, [equipments]);
  useEffect(() => { unitsRef.current       = units;        }, [units]);
  useEffect(() => { carriersRef.current    = carriers;     }, [carriers]);
  useEffect(() => { layoutEdgesRef.current = layoutEdges;  }, [layoutEdges]);
  useEffect(() => { layoutNodesRef.current = layoutNodes;  }, [layoutNodes]);
  useEffect(() => { layoutIdRef.current    = layoutId;     }, [layoutId]);

  // 수동 충전소 복귀 요청 큐 (UI → tick 으로 전달)
  const returnQueueRef = useRef<Set<string>>(new Set());

  const requestReturnHome = useCallback((equipmentId: string) => {
    returnQueueRef.current.add(equipmentId);
    console.log(`[ACS] 충전소 복귀 요청 | agv=${equipmentId.slice(0, 8)}`);
  }, []);

  // mobile equipment ID 집합이 바뀔 때만 vehicles 맵 재초기화
  // (B6) equipments 배열은 매 location_id update 마다 새 reference 가 되므로
  // 직접 dep 으로 쓰면 매 hop 마다 useEffect 가 fire → tick in-flight 중 vehiclesRef 가
  // 교체되어 결과가 detach 되는 race condition 발생. ID 집합 문자열로 안정화.
  const mobileEquipmentKey = useMemo(
    () =>
      equipments
        .filter((e) => isMobileEquipment(e.equipmentType))
        .map((e) => e.id)
        .sort()
        .join(','),
    [equipments],
  );

  useEffect(() => {
    console.log(
      `[ACS] vehiclesRef 재초기화 | mobileIds=${mobileEquipmentKey || '(empty)'}`,
    );
    const newMap = new Map<string, AcsVehicle>();
    for (const eq of equipmentsRef.current) {
      if (!isMobileEquipment(eq.equipmentType)) continue;
      const existing = vehiclesRef.current.get(eq.id);
      newMap.set(eq.id, existing ?? {
        equipmentId:          eq.id,
        equipmentLabel:       eq.equipmentId,
        vehicleState:         'Idle',
        currentCommandId:     null,
        currentMacroCommandId: null,
        carrierId:            null,
        pickupUnitId:         null,
        dropoffUnitId:        null,
        microCommandIds:      [],
        currentPath:          [],
        pathIndex:            0,
        lastHopAt:            0,
        updatedAt:            Date.now(),
      });
    }
    vehiclesRef.current = newMap;
    setAcsState((prev) => ({ ...prev, vehicles: new Map(newMap) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileEquipmentKey]);

  // ─── 메인 tick ────────────────────────────────────────────────
  const tick = useCallback(async () => {
    if (!runningRef.current) return;
    if (tickBusyRef.current) return; // 이전 tick 아직 실행 중 → 스킵
    if (!isLeader()) {
      setIsLeaderTab(false);
      return;
    }
    tickBusyRef.current = true;
    setIsLeaderTab(true);
    updateHeartbeat();

    const supabase = createClient();
    const vehicles = vehiclesRef.current;
    const units    = unitsRef.current;

    // 홈(충전소) 복귀 시작 헬퍼:
    // 자동(Depositing→Idle 직후) 및 수동(requestReturnHome 큐) 양쪽에서 재사용.
    // nextVehicle 을 mutate 하며 성공 시 MovingEmpty + returningHome=true 로 진입.
    async function startHomeReturn(
      nextVehicle: AcsVehicle,
      curUnit: string | null,
    ): Promise<boolean> {
      const currentLId = layoutIdRef.current;
      const agvNode = layoutNodesRef.current.find(
        (n) => (n.data as Record<string, unknown>).equipmentId === nextVehicle.equipmentLabel,
      );
      const homeNodeCode = agvNode
        ? (agvNode.data as Record<string, unknown>).homeNodeId as string | undefined
        : undefined;
      const homeUnit = homeNodeCode
        ? unitsRef.current.find((u) => u.equipmentUnitId === homeNodeCode)
        : undefined;

      if (!currentLId || !homeUnit || !curUnit || curUnit === homeUnit.id) {
        nextVehicle.currentPath  = [];
        nextVehicle.pathIndex    = 0;
        nextVehicle.pickupUnitId = null;
        return false;
      }

      try {
        const graph = await loadGraphClient(currentLId, supabase);
        const { path: homePath } = runAstar(graph, curUnit, homeUnit.id, new Set());
        if (homePath.length >= 2) {
          nextVehicle.vehicleState  = 'MovingEmpty';
          nextVehicle.currentPath   = homePath.map((p) => p.unitId);
          nextVehicle.pathIndex     = 0;
          nextVehicle.pickupUnitId  = homeUnit.id;
          nextVehicle.returningHome = true;
          nextVehicle.lastHopAt     = Date.now();
          nextVehicle.updatedAt     = Date.now();
          console.log(
            `[ACS] 홈복귀 시작 | agv=${nextVehicle.equipmentLabel} home=${homeNodeCode} (${homePath.length}홉)`,
          );
          return true;
        }
        nextVehicle.currentPath  = [];
        nextVehicle.pathIndex    = 0;
        nextVehicle.pickupUnitId = null;
        return false;
      } catch (e) {
        nextVehicle.currentPath  = [];
        nextVehicle.pathIndex    = 0;
        nextVehicle.pickupUnitId = null;
        console.error(
          `[ACS] 홈복귀 A* 실패 | agv=${nextVehicle.equipmentLabel} | ${e instanceof Error ? e.message : e}`,
        );
        return false;
      }
    }

    try {
      // ── 1. Idle AMR 에게 Pending macro_command 할당 ────────────────
      // macro 단위로 처리: macro → micro chain → 전체 경로 복원 → AGV 할당
      const idleVehicles = [...vehicles.values()].filter((v) => v.vehicleState === 'Idle');

      if (idleVehicles.length > 0) {
        // 현재 vehicle 이 처리 중인 macro ID 목록
        const activeMacroIds = new Set(
          [...vehicles.values()]
            .map((v) => v.currentMacroCommandId)
            .filter(Boolean) as string[]
        );

        // Pending + InProgress 모두 조회 (InProgress 중 abandoned 회수)
        const { data: candidateMacros } = await supabase
          .from('mcs_macro_command')
          .select('*')
          .in('state', ['Pending', 'InProgress'])
          .order('priority', { ascending: false })
          .order('created_at');

        // InProgress 중 이미 vehicle 이 처리 중인 것 제외
        const pendingMacros = (candidateMacros ?? []).filter(
          (m: Record<string, unknown>) => !activeMacroIds.has(m.id as string)
        ).slice(0, idleVehicles.length);


        for (let i = 0; i < (pendingMacros?.length ?? 0); i++) {
          const macro = pendingMacros![i] as Record<string, unknown>;
          const vehicle = idleVehicles[i];

          // 해당 macro 의 모든 micro_command 조회 (sequence 순)
          const { data: micros } = await supabase
            .from('mcs_micro_command')
            .select('*')
            .eq('macro_command_id', macro.id as string)
            .order('sequence');

          if (!micros || micros.length === 0) continue;

          type MicroRow = { id: string; sequence: number; departure_unit_id: string; arrival_unit_id: string; state: string };
          let microRows = micros as MicroRow[];

          // abandoned InProgress macro 회수: Completed 가 아닌 micro 만 남김, InProgress → Pending 리셋
          if ((macro.state as string) === 'InProgress') {
            console.log(
              `[ACS] InProgress macro 회수 | macro=${(macro.id as string).slice(0, 8)} totalMicros=${micros.length}`,
            );
            const remaining = microRows.filter((m) => m.state !== 'Completed');
            if (remaining.length === 0) {
              // 모든 micro 가 완료됐는데 macro 만 InProgress 인 경우 → macro Completed 처리
              await supabase.from('mcs_macro_command').update({ state: 'Completed' }).eq('id', macro.id as string);
              void notifyRtdComplete(macro.id as string, supabase);
              continue;
            }
            // 남은 micro 를 모두 Pending 으로 리셋
            const remainingIds = remaining.map((m) => m.id);
            await supabase.from('mcs_micro_command').update({ state: 'Pending' }).in('id', remainingIds);
            // 재처리할 micro rows 는 Pending 으로 간주
            microRows = remaining;
          }

          // micro chain → source~dest 경로 복원
          // [micro[0].departure, micro[0].arrival, micro[1].arrival, ...]
          const sourceToDestPath: string[] = [microRows[0].departure_unit_id];
          for (const m of microRows) sourceToDestPath.push(m.arrival_unit_id);

          const sourceUnitId = macro.source_unit_id as string;
          const destUnitId   = macro.dest_unit_id as string;

          // AGV 현재 위치 조회 (DB)
          const { data: eqRow } = await supabase
            .from('mcs_equipment')
            .select('location_id')
            .eq('id', vehicle.equipmentId)
            .single();
          const agvCurrentUnitId = (eqRow as Record<string, unknown> | null)?.location_id as string | null;

          // AGV 가 출발지(OUT 포트)가 아닌 곳(충전소 등)에 있으면 빈차 이동 경로를 A*로 계산
          // 양방향 그래프 사용: directed 그래프에서 OUT 포트는 port→node 방향만 있을 수 있음
          //
          // 실패 시 폴백: 텔레포트 (시스템 고착 방지)
          //   - 레이아웃에 충전소↔grid transfer_relation 누락 시 fallback
          //   - 빈차 시각화는 안되지만 macro 진행은 계속됨
          let fullPath: string[];
          let useTeleportFallback = false;

          if (agvCurrentUnitId && agvCurrentUnitId !== sourceToDestPath[0]) {
            const currentLId = layoutIdRef.current;
            if (!currentLId) {
              useTeleportFallback = true;
              fullPath = sourceToDestPath;
              console.warn('[ACS] layoutIdRef 미로드 → 텔레포트 폴백');
            } else {
              try {
                const graph = await loadGraphClient(currentLId, supabase);
                const biGraph = makeBidirectional(graph);
                const { path: emptyPath } = runAstar(biGraph, agvCurrentUnitId, sourceToDestPath[0], new Set());
                if (emptyPath.length >= 2) {
                  // emptyPath 끝 노드 = sourceToDestPath[0] → 중복 제거 후 합산
                  fullPath = [...emptyPath.map((p) => p.unitId), ...sourceToDestPath.slice(1)];
                  console.log(
                    `[ACS] 빈차 A* 성공 | agv=${vehicle.equipmentLabel} path=[${fullPath.slice(0, 6).join(',')}${fullPath.length > 6 ? ',...' : ''}] (총 ${fullPath.length}홉)`,
                  );
                } else {
                  useTeleportFallback = true;
                  fullPath = sourceToDestPath;
                  console.warn(
                    `[ACS] 빈차 이동 경로 없음 → 텔레포트 폴백 | agv=${vehicle.equipmentLabel} cur=${agvCurrentUnitId} src=${sourceToDestPath[0]} graphSize=${graph.size}`,
                  );
                }
              } catch (e) {
                useTeleportFallback = true;
                fullPath = sourceToDestPath;
                console.error(
                  `[ACS] 빈차 이동 A* 실패 → 텔레포트 폴백 | agv=${vehicle.equipmentLabel} cur=${agvCurrentUnitId} src=${sourceToDestPath[0]} | ${e instanceof Error ? e.message : e}`,
                );
              }
            }
          } else {
            // AGV 이미 출발지에 있음 (또는 위치 미파악)
            fullPath = sourceToDestPath;
          }

          // 폴백 시: DB location_id 를 sourceToDestPath[0] 으로 텔레포트 (역주행 방지)
          if (useTeleportFallback && agvCurrentUnitId) {
            await supabase
              .from('mcs_equipment')
              .update({ location_id: sourceToDestPath[0] })
              .eq('id', vehicle.equipmentId);
          }

          if (fullPath.length < 2) continue;

          // DB: macro → InProgress, 첫 micro → InProgress + executor 설정
          await supabase
            .from('mcs_macro_command')
            .update({ state: 'InProgress' })
            .eq('id', macro.id as string);
          await supabase
            .from('mcs_micro_command')
            .update({ state: 'InProgress', executor_equipment_id: vehicle.equipmentId })
            .eq('id', microRows[0].id);
          // 나머지 micro 에 executor_equipment_id 설정 (경로 추적 및 패널 표시용)
          if (microRows.length > 1) {
            await supabase
              .from('mcs_micro_command')
              .update({ executor_equipment_id: vehicle.equipmentId })
              .in('id', microRows.slice(1).map((m) => m.id));
          }

          const microCommandIds = microRows.map((m) => ({
            id: m.id,
            departureUnitId: m.departure_unit_id,
            arrivalUnitId:   m.arrival_unit_id,
          }));

          vehicles.set(vehicle.equipmentId, {
            ...vehicle,
            vehicleState:          'Assigned',
            currentCommandId:      microRows[0].id,
            currentMacroCommandId: macro.id as string,
            carrierId:             macro.carrier_id as string,
            pickupUnitId:          sourceUnitId,
            dropoffUnitId:         destUnitId,
            microCommandIds,
            currentPath:           fullPath,
            pathIndex:             0,
            lastHopAt:             Date.now(),
            updatedAt:             Date.now(),
          });
          console.log(
            `[ACS] macro 할당 | macro=${(macro.id as string).slice(0, 8)} ` +
            `carrier=${((macro.carrier_id as string) ?? 'null').slice(0, 8)} ` +
            `src=${sourceUnitId?.slice(0, 8) ?? 'null'} dst=${destUnitId?.slice(0, 8) ?? 'null'} ` +
            `agvCur=${agvCurrentUnitId?.slice(0, 8) ?? 'null'} microRows=${microRows.length} fullPath=${fullPath.length}홉`,
          );
        }
      }

      // ── 2. 각 AMR 상태 전이 + 경로 이동 ─────────────────────────────
      for (const [equipmentId, vehicle] of vehicles) {
        if (vehicle.vehicleState === 'Idle') {
          // 수동 충전소 복귀 요청 처리
          if (returnQueueRef.current.has(equipmentId)) {
            returnQueueRef.current.delete(equipmentId);
            // Idle vehicle 은 currentPath 가 비어 있어 currentUnitId 가 null → DB 에서 직접 조회
            const { data: eqRow } = await supabase
              .from('mcs_equipment')
              .select('location_id')
              .eq('id', equipmentId)
              .single();
            const curUnitForHome = (eqRow as Record<string, unknown> | null)?.location_id as string | null;
            const nextVehicle = { ...vehicle };
            await startHomeReturn(nextVehicle, curUnitForHome);
            vehicles.set(equipmentId, nextVehicle);
          }
          continue;
        }

        const curUnit = currentUnitId(vehicle);

        let nextVehicle = { ...vehicle };

        // 도착 판정 (전진보다 먼저): pickup / dropoff 지점에서 멈춤
        const hasReachedDeparture =
          vehicle.vehicleState === 'MovingEmpty' &&
          curUnit === vehicle.pickupUnitId;
        const hasReachedDestination =
          vehicle.vehicleState === 'MovingLoaded' &&
          curUnit === vehicle.dropoffUnitId;

        // 이동형 상태에서 경로 전진 — 도착 지점이면 전진하지 않음
        if (
          !hasReachedDeparture &&
          !hasReachedDestination &&
          (vehicle.vehicleState === 'MovingEmpty' || vehicle.vehicleState === 'MovingLoaded') &&
          shouldAdvancePath(vehicle.lastHopAt)
        ) {
          const next = nextUnitId(vehicle);
          if (next) {
            nextVehicle.pathIndex++;
            nextVehicle.lastHopAt = Date.now(); // 전진 시간 기록

            // DB: AGV location_id 갱신 → Realtime → 대시보드 애니메이션
            await supabase
              .from('mcs_equipment')
              .update({ location_id: next })
              .eq('id', equipmentId);

            // progressive micro 업데이트: 적재 이동 중에만 추적 (빈차 구간은 micro 와 무관)
            // MovingEmpty 중 경로에 micro.arrivalUnitId 와 동일한 노드가 우연히 겹쳐
            // micro 가 조기 완료되는 버그 방지
            if (vehicle.vehicleState === 'MovingLoaded') {
              const curMicroIdx = vehicle.microCommandIds.findIndex(
                (m) => m.id === vehicle.currentCommandId
              );
              if (curMicroIdx >= 0) {
                const curMicro = vehicle.microCommandIds[curMicroIdx];
                if (curMicro.arrivalUnitId === next) {
                  console.log(
                    `[ACS] micro 진전 | agv=${vehicle.equipmentLabel} micro=${curMicro.departureUnitId?.slice(0, 8)}→${curMicro.arrivalUnitId?.slice(0, 8)} next=${next.slice(0, 8)}`,
                  );
                  // 현재 micro 완료
                  await supabase
                    .from('mcs_micro_command')
                    .update({ state: 'Completed' })
                    .eq('id', curMicro.id);
                  // 다음 micro 가 있으면 InProgress 로
                  const nextMicro = vehicle.microCommandIds[curMicroIdx + 1];
                  if (nextMicro) {
                    await supabase
                      .from('mcs_micro_command')
                      .update({ state: 'InProgress' })
                      .eq('id', nextMicro.id);
                    nextVehicle.currentCommandId = nextMicro.id;
                  }
                }
              }
            }
          }
        }

        const newState = nextVehicleState(nextVehicle, hasReachedDeparture, hasReachedDestination);

        if (newState !== vehicle.vehicleState) {
          console.log(
            `[ACS] state 전이 | agv=${vehicle.equipmentLabel} ${vehicle.vehicleState} → ${newState} pathIndex=${vehicle.pathIndex}/${vehicle.currentPath.length}`,
          );
          nextVehicle.vehicleState = newState;
          nextVehicle.lastHopAt   = Date.now(); // 상태 변경 시 타이머 리셋 (Acquiring/Depositing 대기 시작)
          nextVehicle.updatedAt   = Date.now();

          if (newState === 'Acquiring') {
            // carrier 실제 DB 위치도 함께 로그 (pickup 과 다르면 위치 불일치 진단용)
            let actualCarrierLoc: string | null = null;
            if (vehicle.carrierId) {
              const { data: cRow } = await supabase
                .from('mcs_carrier')
                .select('location_id')
                .eq('id', vehicle.carrierId)
                .maybeSingle();
              actualCarrierLoc = (cRow?.location_id as string | null) ?? null;
            }
            console.log(
              `[ACS] Acquiring 진입 | agv=${vehicle.equipmentLabel} pickup=${vehicle.pickupUnitId?.slice(0, 8)} ` +
              `carrierId=${vehicle.carrierId?.slice(0, 8) ?? 'null'} carrierActualLoc=${actualCarrierLoc?.slice(0, 8) ?? 'null'}`,
            );

            // (B5) 이미 픽업 완료 가드: carrier 가 이미 amrBodyPort 에 있으면
            // 이전 tick 결과가 vehiclesRef race 로 소실된 것 → 픽업은 이미 완료됨
            // → Loaded 로 fast-forward (CANCEL 회피)
            const amrBodyPortForB5 = units.find(
              (u) => u.equipmentId === equipmentId && u.unitType === 'AGV'
            );
            if (
              !vehicle.returningHome &&
              vehicle.carrierId &&
              amrBodyPortForB5 &&
              actualCarrierLoc === amrBodyPortForB5.id
            ) {
              console.log(
                `[ACS] Acquiring SKIP (이미 픽업됨) | agv=${vehicle.equipmentLabel} carrier=${vehicle.carrierId.slice(0, 8)}`,
              );
              nextVehicle.vehicleState = 'Loaded';
              nextVehicle.lastHopAt   = Date.now();
              nextVehicle.updatedAt   = Date.now();
              vehicles.set(equipmentId, nextVehicle);
              continue;
            }

            // 홈 복귀 중 도착 → 캐리어 없이 Idle 복귀
            if (vehicle.returningHome) {
              nextVehicle.vehicleState  = 'Idle';
              nextVehicle.pickupUnitId  = null;
              nextVehicle.currentPath   = [];
              nextVehicle.pathIndex     = 0;
              nextVehicle.returningHome = false;
              vehicles.set(equipmentId, nextVehicle);
              continue;
            }

            // 픽업 포트 위 캐리어를 AMR body port 로 이동
            const amrBodyPort = units.find(
              (u) => u.equipmentId === equipmentId && u.unitType === 'AGV'
            );

            // amrBodyPort 없으면 units 아직 미로드 → 명령 취소 후 Idle 복귀 (고착 방지)
            if (!amrBodyPort || !vehicle.pickupUnitId) {
              console.warn(
                `[ACS] Acquiring CANCEL: amrBodyPort 없음 | agv=${vehicle.equipmentLabel} ` +
                `amrBodyPort=${amrBodyPort ? 'found' : 'null'} pickupUnitId=${vehicle.pickupUnitId?.slice(0, 8) ?? 'null'}`,
              );
              if (vehicle.currentMacroCommandId) {
                await supabase
                  .from('mcs_macro_command')
                  .update({ state: 'Cancelled' })
                  .eq('id', vehicle.currentMacroCommandId);
              }
              for (const m of vehicle.microCommandIds) {
                await supabase
                  .from('mcs_micro_command')
                  .update({ state: 'Cancelled' })
                  .eq('id', m.id);
              }
              // carrier 가 AGV body 에 있으면 출발지로 복원
              if (vehicle.carrierId && vehicle.pickupUnitId) {
                const amrBodyId = units.find(
                  (u) => u.equipmentId === equipmentId && u.unitType === 'AGV',
                )?.id;
                if (amrBodyId) {
                  const { data: cCheck } = await supabase
                    .from('mcs_carrier')
                    .select('location_id')
                    .eq('id', vehicle.carrierId)
                    .maybeSingle();
                  if ((cCheck?.location_id as string | null) === amrBodyId) {
                    await supabase
                      .from('mcs_carrier')
                      .update({ location_id: vehicle.pickupUnitId, current_equipment_id: null, state: 'Installed' })
                      .eq('id', vehicle.carrierId);
                    console.log(
                      `[ACS] CANCEL carrier 복원 | carrier=${vehicle.carrierId.slice(0, 8)} → ${vehicle.pickupUnitId.slice(0, 8)}`,
                    );
                  }
                }
              }
              nextVehicle.vehicleState          = 'Idle';
              nextVehicle.currentCommandId      = null;
              nextVehicle.currentMacroCommandId = null;
              nextVehicle.carrierId             = null;
              nextVehicle.pickupUnitId          = null;
              nextVehicle.dropoffUnitId         = null;
              nextVehicle.microCommandIds       = [];
              nextVehicle.currentPath           = [];
              nextVehicle.pathIndex             = 0;
            } else {
              // 출발지에 실제로 있는 캐리어만 픽업 (위치 검증 필수)
              // carrierId 지정된 경우도 location_id 일치 여부를 DB로 확인
              let carrierId: string | null = null;

              if (vehicle.carrierId) {
                // 지정된 캐리어가 실제로 출발지에 있는지 확인
                const { data: cRow } = await supabase
                  .from('mcs_carrier')
                  .select('id')
                  .eq('id', vehicle.carrierId)
                  .eq('location_id', vehicle.pickupUnitId)
                  .maybeSingle();
                carrierId = cRow?.id ?? null;
              }

              if (!carrierId) {
                // carrierId 없거나 위치 불일치 → 출발지에 있는 캐리어 자동 탐색
                const { data: cRow } = await supabase
                  .from('mcs_carrier')
                  .select('id')
                  .eq('location_id', vehicle.pickupUnitId)
                  .maybeSingle();
                carrierId = cRow?.id ?? null;
              }

              if (carrierId) {
                await supabase
                  .from('mcs_carrier')
                  .update({
                    location_id:          amrBodyPort.id,
                    current_equipment_id: equipmentId,
                    state:                'Transferring',
                  })
                  .eq('id', carrierId);
                // 이후 Depositing→Idle 에서 사용
                nextVehicle.carrierId = carrierId;
              }

              // carrierId 없으면 출발지에 캐리어 없음 → 반송 취소
              if (!carrierId) {
                console.warn(
                  `[ACS] Acquiring CANCEL: 캐리어 없음 | agv=${vehicle.equipmentLabel} pickup=${vehicle.pickupUnitId?.slice(0, 8)}`,
                );
                // carrier 가 AGV body 에 stuck 되어 있으면 출발지(pickupUnitId)로 복원
                if (vehicle.carrierId && vehicle.pickupUnitId && amrBodyPort) {
                  const { data: cCheck } = await supabase
                    .from('mcs_carrier')
                    .select('location_id')
                    .eq('id', vehicle.carrierId)
                    .maybeSingle();
                  if ((cCheck?.location_id as string | null) === amrBodyPort.id) {
                    await supabase
                      .from('mcs_carrier')
                      .update({ location_id: vehicle.pickupUnitId, current_equipment_id: null, state: 'Installed' })
                      .eq('id', vehicle.carrierId);
                    console.log(
                      `[ACS] CANCEL carrier 복원 | carrier=${vehicle.carrierId.slice(0, 8)} → ${vehicle.pickupUnitId.slice(0, 8)}`,
                    );
                  }
                }
                if (vehicle.currentMacroCommandId) {
                  await supabase
                    .from('mcs_macro_command')
                    .update({ state: 'Cancelled' })
                    .eq('id', vehicle.currentMacroCommandId);
                }
                for (const m of vehicle.microCommandIds) {
                  await supabase
                    .from('mcs_micro_command')
                    .update({ state: 'Cancelled' })
                    .eq('id', m.id);
                }
                nextVehicle.vehicleState          = 'Idle';
                nextVehicle.currentCommandId      = null;
                nextVehicle.currentMacroCommandId = null;
                nextVehicle.carrierId             = null;
                nextVehicle.pickupUnitId          = null;
                nextVehicle.dropoffUnitId         = null;
                nextVehicle.microCommandIds       = [];
                nextVehicle.currentPath           = [];
                nextVehicle.pathIndex             = 0;
              }
            }
          } else if (newState === 'Idle') {
            // Depositing → Idle: carrier 를 목적지 port 에 내려놓기
            // ※ carriersRef 는 stale 할 수 있으므로 vehicle.carrierId 로 직접 업데이트
            console.log(
              `[ACS] Depositing→Idle | agv=${vehicle.equipmentLabel} carrier=${vehicle.carrierId?.slice(0, 8) ?? 'null'} dest=${vehicle.dropoffUnitId?.slice(0, 8) ?? 'null'}`,
            );
            const destUnitObj = units.find((u) => u.id === vehicle.dropoffUnitId);
            if (vehicle.carrierId && destUnitObj) {
              await supabase
                .from('mcs_carrier')
                .update({
                  location_id:          destUnitObj.id,
                  current_equipment_id: destUnitObj.equipmentId,
                  state:                'Installed',
                })
                .eq('id', vehicle.carrierId);
            }

            // 남은 micro_command 전체 완료 처리
            for (const m of vehicle.microCommandIds) {
              await supabase
                .from('mcs_micro_command')
                .update({ state: 'Completed' })
                .eq('id', m.id);
            }

            // macro_command 완료
            if (vehicle.currentMacroCommandId) {
              await supabase
                .from('mcs_macro_command')
                .update({ state: 'Completed' })
                .eq('id', vehicle.currentMacroCommandId);

              // RTD 반송 완료 알림 (RTD 원천 macro 만, fire & forget)
              void notifyRtdComplete(vehicle.currentMacroCommandId, supabase);
            }

            // AMR 상태 초기화
            nextVehicle.currentCommandId      = null;
            nextVehicle.currentMacroCommandId = null;
            nextVehicle.carrierId             = null;
            nextVehicle.dropoffUnitId         = null;
            nextVehicle.microCommandIds       = [];
            nextVehicle.returningHome         = false;

            // 홈(충전소)으로 복귀 경로 계산 — startHomeReturn 헬퍼로 위임
            await startHomeReturn(nextVehicle, curUnit);
          }
        }

        vehicles.set(equipmentId, nextVehicle);
      }

      // ── 3. React state 동기화 ─────────────────────────────────────
      setAcsState((prev) => ({
        ...prev,
        vehicles:  new Map(vehicles),
        lastTickAt: Date.now(),
        tickCount:  prev.tickCount + 1,
        error:      null,
      }));
    } catch (err) {
      setAcsState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : '알 수 없는 오류',
      }));
    } finally {
      tickBusyRef.current = false; // mutex 해제
    }
  }, []);

  // ─── 시작 / 정지 ──────────────────────────────────────────────
  const start = useCallback(() => {
    if (runningRef.current) return;

    // Leader lock 선점 시도
    if (!claimLeader()) {
      setIsLeaderTab(false);
      // 리더가 아니어도 running 상태는 켜서 폴로워 표시
    } else {
      setIsLeaderTab(true);
    }

    runningRef.current = true;
    setAcsState((prev) => ({ ...prev, isRunning: true }));

    intervalRef.current = setInterval(tick, TICK_INTERVAL_MS);
    heartbeatRef.current = setInterval(() => {
      if (isLeader()) {
        updateHeartbeat();
        setIsLeaderTab(true);
      } else if (claimLeader()) {
        setIsLeaderTab(true);
      } else {
        setIsLeaderTab(false);
      }
    }, HEARTBEAT_MS);
  }, [tick]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (intervalRef.current)  { clearInterval(intervalRef.current);  intervalRef.current  = null; }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    releaseLeader();
    setIsLeaderTab(false);
    setAcsState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  // cleanup
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { acsState, isLeaderTab, start, stop, requestReturnHome };
}

// ─── RTD 반송 완료 알림 헬퍼 (fire & forget) ─────────────────────────
// Supabase client 타입은 any 허용 (SupabaseClient 가 제네릭)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifyRtdComplete(macroId: string, supabase: any) {
  try {
    const { data: macro } = await supabase
      .from('mcs_macro_command')
      .select('rtd_command_id, correlation_id, algorithm, carrier_id, source_equipment_id, dest_equipment_id, created_at')
      .eq('id', macroId)
      .maybeSingle();

    if (!macro?.rtd_command_id) return;

    const now       = new Date().toISOString();
    const startedAt = (macro.created_at as string | null) ?? now;
    const duration  = Date.now() - new Date(startedAt).getTime();

    await fetch('/api/rtd/notify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandId:         macro.rtd_command_id as string,
        lotId:             (macro.carrier_id as string | null) ?? '',
        sourceEquipmentId: (macro.source_equipment_id as string | null) ?? '',
        destEquipmentId:   (macro.dest_equipment_id as string | null) ?? '',
        startTime:         startedAt,
        endTime:           now,
        transportDuration: duration,
        route:             [] as string[],
        algorithm:         ((macro.algorithm as string | null) ?? 'ASTAR') as 'ASTAR' | 'AI_PPO',
        triggerNextDispatch: false,
        correlationId:     (macro.correlation_id as string | null) ?? undefined,
      }),
    });
  } catch {
    // RTD 미기동 등 네트워크 오류는 무시
  }
}
