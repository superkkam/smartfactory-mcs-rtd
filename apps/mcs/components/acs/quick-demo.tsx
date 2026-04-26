'use client';

import { useMemo, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { buildAdjList } from '@/lib/acs/layout-graph';
import type { Edge, Node } from '@xyflow/react';
import type { Equipment, EquipmentUnit, Carrier } from '@workspace/types/mcs';

/** AGV 이동 간격 (ms) — SPEED_PX_PER_SEC=120 기준 ~240px 엣지 애니메이션 여유 */
const MOVE_INTERVAL_MS = 2000;

interface QuickDemoProps {
  equipments:  Equipment[];
  units:       EquipmentUnit[];
  carriers:    Carrier[];
  layoutEdges: Edge[];
  layoutNodes: Node[];
}

/**
 * 퀵 데모 패널
 * - AGV 한 대를 전이 관계 그래프를 따라 순환 이동
 * - pathUnits: 알파벳순 정렬 → 그래프 greedy DFS 걷기로 교체
 *   → 연속된 두 유닛이 항상 직접 연결 → BFS 길이=2 → framer-motion 부드러운 보간
 * - Supabase Realtime → useLayoutMonitor HopEvent → useCarrierAnimations 보간 표시
 *
 * 전제조건: 레이아웃 모델러에서 AGV + ND/CHG 노드를 포함해 저장(syncLayoutToDb) 되어 있어야 함
 */
export function QuickDemo({ equipments, units, carriers, layoutEdges, layoutNodes }: QuickDemoProps) {
  const [running, setRunning] = useState(false);
  const [log, setLog]       = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 양방향 인접 리스트 — 순환 경로 생성용 (단방향이면 역주행 불가)
  const adj = useMemo(
    () => buildAdjList(layoutEdges, layoutNodes, units, { bidirectional: true }),
    [layoutEdges, layoutNodes, units],
  );

  // 전이 관계 그래프를 따라 greedy DFS 걷기 → 연속 유닛이 항상 인접 보장
  const pathUnits = useMemo(() => {
    const nodeUnits = units.filter((u) => u.unitType === 'Node');
    if (nodeUnits.length === 0) return [];

    const unitMap = new Map(nodeUnits.map(u => [u.id, u]));
    const start   = nodeUnits[0];
    const visited = new Set<string>([start.id]);
    const path    = [start];
    let current   = start.id;

    while (true) {
      const neighbors = adj.get(current) ?? [];
      const next = neighbors.find(n => !visited.has(n) && unitMap.has(n));
      if (!next) break;
      visited.add(next);
      path.push(unitMap.get(next)!);
      current = next;
    }
    return path;
  }, [units, adj]);

  const agv = equipments.find((e) => e.equipmentType === 'AGV');

  const handleStart = async () => {
    const supabase = createClient();

    if (!agv) {
      setLog('오류: AGV 장비 없음. 레이아웃에 AGV를 추가하고 저장하세요.');
      return;
    }
    if (pathUnits.length === 0) {
      setLog('오류: 경유 노드(ND/CHG) 없음. 레이아웃에 경유점을 추가하고 저장하세요.');
      return;
    }

    // ── 캐리어 준비 ──────────────────────────────────────────────────
    // 첫 번째 기존 캐리어 사용. 없으면 첫 번째 path unit 위치로 즉시 생성.
    let carrierId: string;
    const existing = carriers[0];
    if (existing) {
      carrierId = existing.id;
      setLog(`기존 캐리어 사용: ${existing.carrierId}`);
    } else {
      const demoTag = `DEMO-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase
        .from('mcs_carrier')
        .insert({
          carrier_id:    demoTag,
          carrier_type:  'FOUP',
          material_type: 'Wafer',
          state:         'Installed',
          // location_id 는 INSERT 시 바로 설정해 레이스 컨디션 방지
          location_id:   pathUnits[0].id,
        })
        .select('id')
        .single();
      if (error || !data) {
        setLog(`캐리어 생성 실패: ${error?.message}`);
        return;
      }
      carrierId = data.id;
      setLog(`임시 캐리어 생성: ${demoTag}`);
    }

    // ── AGV 초기 위치 설정 ────────────────────────────────────────────
    await supabase
      .from('mcs_equipment')
      .update({ location_id: pathUnits[0].id })
      .eq('id', agv.id);

    // ── 캐리어 초기 위치 설정 (기존 캐리어는 이미 어딘가에 있을 수 있음) ──
    if (existing) {
      await supabase
        .from('mcs_carrier')
        .update({ location_id: pathUnits[0].id })
        .eq('id', carrierId);
    }

    // ── 캐리어를 AGV에 탑재 상태로 설정 ────────────────────────────────────────
    // current_equipment_id = AGV ID, state = 'Transferring'
    // → useCarrierAnimations 가 parentAgv 를 식별하여 AGV 위에 캐리어 렌더링
    await supabase
      .from('mcs_carrier')
      .update({
        state:                'Transferring',
        current_equipment_id: agv.id,
        location_id:          pathUnits[0].id,
      })
      .eq('id', carrierId);

    setRunning(true);
    setLog(`데모 시작 ▶  AGV=${agv.equipmentId}  경유=${pathUnits.length}노드`);

    let idx = 0;
    intervalRef.current = setInterval(async () => {
      idx = (idx + 1) % pathUnits.length;
      const unit = pathUnits[idx];

      // AGV 위치만 업데이트 → useLayoutMonitor 가 equipment hop event emit
      // → useCarrierAnimations 가 AGV 를 전이 관계 엣지 경로로 보간
      // 캐리어는 current_equipment_id(AGV)를 따라 자동 렌더링되므로 별도 업데이트 불필요
      await supabase
        .from('mcs_equipment')
        .update({ location_id: unit.id })
        .eq('id', agv.id);

      setLog(`이동 → ${unit.equipmentUnitId}  (${idx + 1} / ${pathUnits.length})`);
    }, MOVE_INTERVAL_MS);
  };

  const handleStop = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
    setLog('데모 정지');

    // 캐리어 상태 원복 (Transferring → Installed)
    const supabase = createClient();
    const existing = carriers[0];
    if (existing) {
      await supabase
        .from('mcs_carrier')
        .update({ state: 'Installed', current_equipment_id: null })
        .eq('id', existing.id);
    }
  };

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 shadow-sm">
      <h3 className="mb-0.5 text-sm font-semibold text-indigo-800">퀵 데모 — AGV 실시간 이동</h3>
      <p className="mb-3 text-[10px] text-indigo-400 leading-relaxed">
        대시보드를 옆에 열어둔 뒤 실행하세요.<br />
        AGV + 캐리어가 경유 노드를 1초 간격으로 순환합니다.
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleStart}
          disabled={running}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          <Play className="h-3 w-3" />
          데모 시작
        </button>
        <button
          onClick={handleStop}
          disabled={!running}
          className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40"
        >
          <Square className="h-3 w-3" />
          정지
        </button>
      </div>

      {log && (
        <p className={`mt-2 text-[10px] leading-relaxed ${running ? 'text-indigo-600' : 'text-gray-500'}`}>
          {log}
        </p>
      )}

      {/* 사전 조건 경고 */}
      {!agv && (
        <p className="mt-2 text-[10px] text-amber-600">
          ⚠ AGV 없음 — 레이아웃 모델러에서 AGV를 추가하고 저장하세요.
        </p>
      )}
      {agv && pathUnits.length === 0 && (
        <p className="mt-2 text-[10px] text-amber-600">
          ⚠ 경유 노드 없음 — ND / CHG 노드를 추가하고 저장하세요.
        </p>
      )}
      {agv && pathUnits.length > 0 && !running && (
        <p className="mt-2 text-[10px] text-green-600">
          ✓ AGV={agv.equipmentId}  경유={pathUnits.length}노드  준비됨
        </p>
      )}
    </div>
  );
}
