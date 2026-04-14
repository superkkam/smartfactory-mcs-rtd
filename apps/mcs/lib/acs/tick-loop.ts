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

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  isMobileEquipment,
  shouldAdvancePath,
  nextVehicleState,
  nextUnitId,
  currentUnitId,
} from './vehicle-controller';
import type { AcsVehicle, AcsState, AcsLeaderLock } from './types';
import { ACS_LEADER_KEY } from './types';

import type { Equipment, EquipmentUnit, Carrier } from '@workspace/types/mcs';
import type { Edge, Node } from '@xyflow/react';

const TICK_INTERVAL_MS = 100;
const HEARTBEAT_MS = 500;
const LEADER_TIMEOUT_MS = 1500;

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
}

export interface UseAcsTickLoopResult {
  acsState: AcsState;
  isLeaderTab: boolean;
  /** 수동 시작 (토글) */
  start: () => void;
  /** 수동 정지 (토글) */
  stop: () => void;
}

/**
 * ACS 메인 tick loop 훅
 * `/acs` 페이지에서 호출. 리더 탭만 실제 DB write 를 수행.
 */
export function useAcsTickLoop({
  layoutNodes,
  layoutEdges,
  equipments,
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

  useEffect(() => { equipmentsRef.current  = equipments;   }, [equipments]);
  useEffect(() => { unitsRef.current       = units;        }, [units]);
  useEffect(() => { carriersRef.current    = carriers;     }, [carriers]);
  useEffect(() => { layoutEdgesRef.current = layoutEdges;  }, [layoutEdges]);
  useEffect(() => { layoutNodesRef.current = layoutNodes;  }, [layoutNodes]);

  // 초기 vehicles 맵 동기화 (mobile equipment 만)
  useEffect(() => {
    const newMap = new Map<string, AcsVehicle>();
    for (const eq of equipments) {
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
  }, [equipments]);

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
            const remaining = microRows.filter((m) => m.state !== 'Completed');
            if (remaining.length === 0) {
              // 모든 micro 가 완료됐는데 macro 만 InProgress 인 경우 → macro Completed 처리
              await supabase.from('mcs_macro_command').update({ state: 'Completed' }).eq('id', macro.id as string);
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

          // AGV 가 출발지가 아닌 곳에 있으면 즉시 텔레포트 (역주행 방지)
          // 빈차 이동은 시각적으로 생략하고 출발지→목적지 순방향만 애니메이션
          if (agvCurrentUnitId && agvCurrentUnitId !== sourceToDestPath[0]) {
            await supabase
              .from('mcs_equipment')
              .update({ location_id: sourceToDestPath[0] })
              .eq('id', vehicle.equipmentId);
          }
          const fullPath = sourceToDestPath; // forward-only (엣지 방향대로)

          if (fullPath.length < 2) continue;

          // DB: macro → InProgress, 첫 micro → InProgress
          await supabase
            .from('mcs_macro_command')
            .update({ state: 'InProgress' })
            .eq('id', macro.id as string);
          await supabase
            .from('mcs_micro_command')
            .update({ state: 'InProgress' })
            .eq('id', microRows[0].id);

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
        }
      }

      // ── 2. 각 AMR 상태 전이 + 경로 이동 ─────────────────────────────
      for (const [equipmentId, vehicle] of vehicles) {
        if (vehicle.vehicleState === 'Idle') continue;

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

            // progressive micro 업데이트: 현재 micro 의 arrival 에 도달하면 다음 micro 로 전환
            const curMicroIdx = vehicle.microCommandIds.findIndex(
              (m) => m.id === vehicle.currentCommandId
            );
            if (curMicroIdx >= 0) {
              const curMicro = vehicle.microCommandIds[curMicroIdx];
              if (curMicro.arrivalUnitId === next) {
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

        const newState = nextVehicleState(nextVehicle, hasReachedDeparture, hasReachedDestination);

        if (newState !== vehicle.vehicleState) {
          nextVehicle.vehicleState = newState;
          nextVehicle.lastHopAt   = Date.now(); // 상태 변경 시 타이머 리셋 (Acquiring/Depositing 대기 시작)
          nextVehicle.updatedAt   = Date.now();

          if (newState === 'Acquiring') {
            // 픽업 포트 위 캐리어를 AMR body port 로 이동
            const amrBodyPort = units.find(
              (u) => u.equipmentId === equipmentId && u.unitType === 'AGV'
            );

            // amrBodyPort 없으면 units 아직 미로드 → 명령 취소 후 Idle 복귀 (고착 방지)
            if (!amrBodyPort || !vehicle.pickupUnitId) {
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
            }

            // AMR 상태 초기화
            nextVehicle.currentCommandId      = null;
            nextVehicle.currentMacroCommandId = null;
            nextVehicle.pickupUnitId          = null;
            nextVehicle.dropoffUnitId         = null;
            nextVehicle.microCommandIds       = [];
            nextVehicle.currentPath           = [];
            nextVehicle.pathIndex             = 0;
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

  return { acsState, isLeaderTab, start, stop };
}
