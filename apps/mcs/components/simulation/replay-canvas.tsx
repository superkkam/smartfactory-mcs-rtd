'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { animate } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { useLayout } from '@/lib/api/layouts';
import { useUnitsByLayout } from '@/lib/api/equipment-units';
import type { SimulationResult, AgentTrace, ConflictEvent } from '@workspace/types/mcs';

const ALG_COLORS: Record<string, string> = {
  astar:       '#ef4444',
  ai_ppo:      '#3b82f6',
  cbs_ts:      '#8b5cf6',
  prioritized: '#10b981',
};

// 캐리어별 고유 색상 (최대 20대 구분)
const CARRIER_PALETTE = [
  '#e11d48','#f97316','#eab308','#16a34a','#0ea5e9',
  '#6366f1','#a855f7','#ec4899','#14b8a6','#84cc16',
  '#dc2626','#ea580c','#ca8a04','#15803d','#0284c7',
  '#4f46e5','#9333ea','#db2777','#0d9488','#65a30d',
];

const ALG_LABELS: Record<string, string> = {
  astar:       'A*',
  ai_ppo:      'AI (PPO)',
  cbs_ts:      'CBS-TS',
  prioritized: 'Prioritized',
};

function nodeCenter(n: {
  position: { x: number; y: number };
  width?: number | null; height?: number | null;
  measured?: { width?: number; height?: number } | null;
}) {
  const w = (n.measured?.width  ?? n.width  ?? 40) as number;
  const h = (n.measured?.height ?? n.height ?? 40) as number;
  return { x: n.position.x + w / 2, y: n.position.y + h / 2 };
}

function lineSamples(
  from: { x: number; y: number },
  to:   { x: number; y: number },
  n = 8,
): Array<{ x: number; y: number }> {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  });
}

function buildWaypoints(
  path: string[],
  nodeMap: Map<string, { x: number; y: number }>,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (const nodeId of path) {
    const pos = nodeMap.get(nodeId);
    if (!pos) continue;
    if (pts.length === 0) pts.push(pos);
    else pts.push(...lineSamples(pts[pts.length - 1], pos));
  }
  return pts;
}


function carrierPositionAt(
  globalProgress: number,
  globalStart: number,
  globalEnd: number,
  trace: AgentTrace,
  waypoints: Array<{ x: number; y: number }>,
): { x: number; y: number } | null {
  if (waypoints.length === 0) return null;

  const totalTime   = Math.max(globalEnd - globalStart, 1);
  const currentTime = globalStart + globalProgress * totalTime;

  if (currentTime < trace.startTime) return null;                   // 출발 전 → 숨김
  if (currentTime >= trace.endTime)  return null;                   // 완료 → 숨김

  // 이동 중: 캐리어 내 상대적 progress
  const localProgress = (currentTime - trace.startTime) /
                        Math.max(trace.endTime - trace.startTime, 0.001);
  const idx = Math.min(
    Math.floor(localProgress * waypoints.length),
    waypoints.length - 1,
  );
  return waypoints[idx];
}

interface ReplayCanvasProps {
  layoutId: string;
  algorithms: string[];
  results: SimulationResult[];
}

export function ReplayCanvas({ layoutId, algorithms, results }: ReplayCanvasProps) {
  const { data: layout, isLoading: layoutLoading } = useLayout(layoutId);
  const { data: units = [], isLoading: unitsLoading } = useUnitsByLayout(layoutId);

  const [activeAlg, setActiveAlg] = useState(algorithms[0] ?? '');
  const [playing,   setPlaying]   = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [speed,     setSpeed]     = useState(0.5);
  const animRef = useRef<{ stop: () => void } | null>(null);

  // ── DB UUID → RF 위치 매핑 ────────────────────────────────────
  const nodeMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    if (!layout?.jsonData) return map;

    const rfNodes = ((layout.jsonData as { nodes?: unknown[] }).nodes ?? []) as Array<{
      id: string; position: { x: number; y: number };
      width?: number | null; height?: number | null;
      measured?: { width?: number; height?: number } | null;
      data?: Record<string, unknown>;
    }>;

    const rfById   = new Map<string, { x: number; y: number }>();
    const rfByCode = new Map<string, { x: number; y: number }>();
    for (const n of rfNodes) {
      const c = nodeCenter(n);
      rfById.set(n.id, c);
      const portId = n.data?.portId as string | undefined;
      const nodeId = n.data?.nodeId as string | undefined;
      if (portId) rfByCode.set(portId, c);
      if (nodeId) rfByCode.set(nodeId, c);
    }

    for (const unit of units) {
      const pos = rfById.get(unit.id) ?? rfByCode.get(unit.equipmentUnitId);
      if (pos) map.set(unit.id, pos);
    }
    return map;
  }, [layout, units]);

  // ── 활성 알고리즘 traces + 글로벌 시간 범위 ──────────────────
  const activeResult = results.find((r) => r.algorithm === activeAlg);
  const traces: AgentTrace[] = activeResult?.agentTraces ?? [];

  const { globalStart, globalEnd } = useMemo(() => {
    if (traces.length === 0) return { globalStart: 0, globalEnd: 1 };
    const globalStart = Math.min(...traces.map((t) => t.startTime));
    const globalEnd   = Math.max(...traces.map((t) => t.endTime));
    return { globalStart, globalEnd: Math.max(globalEnd, globalStart + 1) };
  }, [traces]);

  // ── 각 trace의 waypoints 미리 계산 ───────────────────────────
  const waypointsCache = useMemo(() =>
    traces.map((t) => buildWaypoints(t.path, nodeMap)),
  [traces, nodeMap]);

  // ── 실제 충돌 이벤트 (백엔드에서 SimPy 실행 중 기록) ────────
  const conflictEvents: ConflictEvent[] = activeResult?.conflictEvents ?? [];

  // ── SVG 범위 ─────────────────────────────────────────────────
  const { minX, minY, svgW, svgH } = useMemo(() => {
    const positions = [...nodeMap.values()];
    if (positions.length === 0) return { minX: 0, minY: 0, svgW: 400, svgH: 300 };
    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    const minX = Math.min(...xs) - 40;
    const minY = Math.min(...ys) - 40;
    return {
      minX, minY,
      svgW: Math.max(Math.max(...xs) - minX + 40, 300),
      svgH: Math.max(Math.max(...ys) - minY + 40, 200),
    };
  }, [nodeMap]);

  // ── 재생 제어 ─────────────────────────────────────────────────
  useEffect(() => {
    animRef.current?.stop();
    if (!playing) return;
    const startP   = progress >= 1 ? 0 : progress;
    // 시뮬레이션 총 시간 기준: 1× = 실제 시간의 1/10 속도, 상한 120초
    const simSpan  = Math.max(globalEnd - globalStart, 10);
    const baseDur  = Math.min(simSpan / 10, 120);
    const dur      = Math.max(1, ((1 - startP) / speed) * baseDur);
    const ctrl   = animate(startP, 1, {
      duration: dur, ease: 'linear',
      onUpdate:  (v) => setProgress(v),
      onComplete: () => { setPlaying(false); setProgress(1); },
    });
    animRef.current = ctrl;
    return () => ctrl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, activeAlg, globalStart, globalEnd]);

  // ── 현재 시간 + 캐리어 위치 계산 (조기 반환 전) ─────────────
  const currentTimeSec = globalStart + progress * (globalEnd - globalStart);

  const currentPositions = useMemo(() =>
    traces.map((trace, idx) =>
      carrierPositionAt(progress, globalStart, globalEnd, trace, waypointsCache[idx])
    ),
  [progress, traces, waypointsCache, globalStart, globalEnd]);

  // ── 같은 위치 그룹 (조기 반환 전) ────────────────────────────
  const groupMap = useMemo(() => {
    const quantize = (v: number) => Math.round(v / 12) * 12;
    const m = new Map<string, number[]>();
    currentPositions.forEach((pos, idx) => {
      if (!pos) return;
      const k = `${quantize(pos.x)},${quantize(pos.y)}`;
      const g = m.get(k) ?? [];
      g.push(idx);
      m.set(k, g);
    });
    return m;
  }, [currentPositions]);

  // ── 현재 시각에 충돌 중인 캐리어 ID ─────────────────────────
  // 총 시간의 2% 창 안에 있는 이벤트를 "지금 충돌"로 간주
  const conflictingNow = useMemo(() => {
    const win = (globalEnd - globalStart) * 0.02;
    const set = new Set<string>();
    for (const ev of conflictEvents) {
      if (Math.abs(ev.time - currentTimeSec) < win) {
        set.add(ev.carrierId);
      }
    }
    return set;
  }, [conflictEvents, currentTimeSec, globalStart, globalEnd]);

  const handleReset = () => { animRef.current?.stop(); setPlaying(false); setProgress(0); };
  const handleAlgChange = (alg: string) => { handleReset(); setActiveAlg(alg); };

  if (layoutLoading || unitsLoading) {
    return <div className="py-6 text-center text-sm text-gray-400">레이아웃 로딩 중…</div>;
  }

  const hasTraces      = traces.length > 0;
  const hasMappedNodes = waypointsCache.some((wps) => wps.length > 0);
  const color          = ALG_COLORS[activeAlg] ?? '#6b7280';

  // ── SVG 배경 ─────────────────────────────────────────────────
  const rfNodes = ((layout?.jsonData as { nodes?: unknown[] } | undefined)?.nodes ?? []) as Array<{
    id: string; position: { x: number; y: number };
    width?: number | null; height?: number | null;
    measured?: { width?: number; height?: number } | null;
  }>;
  const rfEdges = ((layout?.jsonData as { edges?: Array<{ id: string; source: string; target: string }> } | undefined)?.edges ?? []);

  const bgEdges = rfEdges.map((e) => {
    const s = rfNodes.find((n) => n.id === e.source);
    const t = rfNodes.find((n) => n.id === e.target);
    if (!s || !t) return null;
    const sp = nodeCenter(s); const tp = nodeCenter(t);
    return <line key={e.id} x1={sp.x - minX} y1={sp.y - minY} x2={tp.x - minX} y2={tp.y - minY} stroke="#e5e7eb" strokeWidth={1.5} />;
  });

  const bgDots = rfNodes.map((n) => {
    const c = nodeCenter(n);
    return <circle key={n.id} cx={c.x - minX} cy={c.y - minY} r={4} fill="#d1d5db" />;
  });

  // ── 캐리어 점 렌더 ───────────────────────────────────────────
  const SPREAD_R = 10; // 겹침 시 펼치는 반경(px)
  const quantize = (v: number) => Math.round(v / 12) * 12;
  const carrierDots = traces.map((trace, idx) => {
    const pos = currentPositions[idx];
    if (!pos) return null;

    const key     = `${quantize(pos.x)},${quantize(pos.y)}`;
    const group   = groupMap.get(key) ?? [idx];
    const posInGrp = group.indexOf(idx);
    const total   = group.length;

    // 여러 캐리어가 같은 위치 → 균등 각도로 펼침
    let dx = 0, dy = 0;
    if (total > 1) {
      const angle = (2 * Math.PI * posInGrp) / total - Math.PI / 2;
      dx = Math.cos(angle) * SPREAD_R;
      dy = Math.sin(angle) * SPREAD_R;
    }

    const cx           = pos.x - minX + dx;
    const cy           = pos.y - minY + dy;
    const fill         = CARRIER_PALETTE[idx % CARRIER_PALETTE.length];
    const isConflict   = conflictingNow.has(trace.agentId);

    return (
      <g key={`${trace.agentId}-${idx}`}>
        {isConflict && (
          <circle cx={cx} cy={cy} r={9} fill="none"
            stroke="#ef4444" strokeWidth={2} strokeOpacity={0.8}
            style={{
              animation: 'pulse-ring 0.7s ease-out infinite',
              transformOrigin: `${cx}px ${cy}px`,
            }}
          />
        )}
        <circle
          cx={cx} cy={cy}
          r={isConflict ? 6 : 4}
          fill={isConflict ? '#ef4444' : fill}
          fillOpacity={0.92}
          stroke="white" strokeWidth={1.2}
        />
      </g>
    );
  });

  const activeCount = traces.filter((_, i) => currentPositions[i] !== null).length;
  const metricConflictCount = activeResult?.conflictCount ?? 0;

  return (
    <div className="space-y-3" data-testid="replay-canvas">
      {/* 알고리즘 탭 */}
      <Tabs value={activeAlg} onValueChange={handleAlgChange}>
        <TabsList>
          {algorithms.map((alg) => (
            <TabsTrigger key={alg} value={alg} className="text-xs">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: ALG_COLORS[alg] ?? '#6b7280' }} />
              {ALG_LABELS[alg] ?? alg}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* 진단 메시지 */}
      {!hasTraces && (
        <p className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          경로 데이터 없음 — AI 엔진이 재기동되었거나 이전에 실행된 결과입니다. 시뮬레이션을 다시 실행해 주세요.
        </p>
      )}
      {hasTraces && !hasMappedNodes && (
        <p className="rounded bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-700">
          노드 매핑 실패 — 경로 ID와 레이아웃 노드가 일치하지 않습니다.
          (샘플 경로 ID: {traces[0]?.path[0] ?? '-'})
        </p>
      )}

      {/* SVG 캔버스 */}
      <div className="relative rounded-lg border border-gray-100 bg-gray-50 overflow-hidden">
        <style>{`@keyframes pulse-ring{0%{transform:scale(1);opacity:.8}100%{transform:scale(2);opacity:0}}`}</style>
        <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ maxHeight: 420, display: 'block' }}>
          {bgEdges}
          {bgDots}
          {hasTraces && hasMappedNodes && carrierDots}
        </svg>
        {!hasTraces && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            시뮬레이션 후 경로가 표시됩니다
          </div>
        )}
      </div>

      {/* 재생 컨트롤 */}
      {hasTraces && hasMappedNodes && (
        <>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => { if (progress >= 1) setProgress(0); setPlaying((v) => !v); }}>
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? '일시정지' : '재생'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            {[0.5, 1, 2, 4].map((s) => (
              <button key={s} onClick={() => setSpeed(s)}
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  speed === s ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'
                }`}>{s}×</button>
            ))}
            <span className="ml-auto flex items-center gap-2 text-xs text-gray-400">
              {metricConflictCount > 0 && (
                <span className="flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-red-600 font-medium">
                  ⚡ 충돌 {metricConflictCount}회
                </span>
              )}
              이동 중 {activeCount}대 / 전체 {traces.length}대 · {Math.round(currentTimeSec)}s
            </span>
          </div>
          {/* 진행 바 */}
          <div className="h-1.5 w-full rounded-full bg-gray-100 cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const p = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
              animRef.current?.stop();
              setPlaying(false);
              setProgress(p);
            }}>
            <div className="h-1.5 rounded-full"
              style={{ width: `${progress * 100}%`, backgroundColor: color, transition: 'none' }} />
          </div>
        </>
      )}
    </div>
  );
}
