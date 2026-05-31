'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlaygroundGrid, type CellState, type GridCell, type AlgoResult } from '@/components/playground/playground-grid';
import { PlaygroundControls } from '@/components/playground/playground-controls';
import { PlaygroundResults } from '@/components/playground/playground-results';
import { PlaygroundReplay } from '@/components/playground/playground-replay';
import { solvePlayground, type PlaygroundAlgorithm, type PlaygroundResponse } from '@/lib/api/ai-engine';

type ClickMode = 'obstacle' | 'start' | 'goal';

const ALL_ALGOS: PlaygroundAlgorithm[] = ['astar', 'ai_ppo', 'prioritized', 'cbs_ts'];

function buildEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({ col, row, state: 'empty' as CellState }))
  );
}

function cloneGrid(grid: GridCell[][]): GridCell[][] {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

// URL autorun용 X자 교차 샘플 시나리오 생성
function buildSampleGrid(size: number, agentCount: number): GridCell[][] {
  const grid = buildEmptyGrid(size);
  const agents = [
    { start: [0, 0],            goal: [size - 1, size - 1] },
    { start: [size - 1, 0],     goal: [0, size - 1] },
    { start: [0, size - 1],     goal: [size - 1, 0] },
    { start: [size - 1, size - 1], goal: [0, 0] },
  ].slice(0, agentCount);

  for (let i = 0; i < agents.length; i++) {
    const [sc, sr] = agents[i].start;
    const [gc, gr] = agents[i].goal;
    grid[sr][sc] = { col: sc, row: sr, state: 'start', agentIndex: i };
    grid[gr][gc] = { col: gc, row: gr, state: 'goal',  agentIndex: i };
  }

  // 중앙에 장애물 몇 개
  const mid = Math.floor(size / 2);
  if (grid[mid][mid].state === 'empty') grid[mid][mid] = { col: mid, row: mid, state: 'obstacle' };
  if (grid[mid - 1][mid].state === 'empty') grid[mid - 1][mid] = { col: mid, row: mid - 1, state: 'obstacle' };

  return grid;
}

// ── URL 파라미터 읽기 (Suspense 경계 안에서만 useSearchParams 사용) ──
function PlaygroundPageInner() {
  const searchParams = useSearchParams();
  const urlAlgorithms = searchParams.get('algorithms');
  const autorun       = searchParams.get('autorun') === '1';

  const [gridSize, setGridSize]             = useState(10);
  const [cells, setCells]                   = useState<GridCell[][]>(() => buildEmptyGrid(10));
  const [algorithm, setAlgorithm]           = useState<PlaygroundAlgorithm>('astar');
  const [compareMode, setCompareMode]       = useState(false);
  const [compareAlgorithms, setCompareAlgorithms] = useState<PlaygroundAlgorithm[]>(['astar', 'ai_ppo']);
  const [mode, setMode]                     = useState<'single' | 'multi'>('single');
  const [agentCount, setAgentCount]         = useState(1);
  const [clickMode, setClickMode]           = useState<ClickMode>('obstacle');
  const [result, setResult]                 = useState<PlaygroundResponse | null>(null);
  const [comparisonResults, setComparisonResults] = useState<AlgoResult[]>([]);
  const [isRunning, setIsRunning]           = useState(false);
  const [replayStep, setReplayStep]         = useState(-1);
  const [isPlaying, setIsPlaying]           = useState(false);

  // URL 파라미터로 초기 알고리즘 + autorun 처리
  useEffect(() => {
    if (!urlAlgorithms) return;

    const parsed = urlAlgorithms
      .split(',')
      .filter((a): a is PlaygroundAlgorithm => ALL_ALGOS.includes(a as PlaygroundAlgorithm));

    if (parsed.length === 0) return;

    if (parsed.length > 1) {
      setCompareMode(true);
      setCompareAlgorithms(parsed);
      setMode(parsed.some((a) => a === 'cbs_ts' || a === 'prioritized') ? 'multi' : 'single');
      const count = parsed.some((a) => a === 'cbs_ts' || a === 'prioritized') ? 2 : 1;
      setAgentCount(count);
      const sample = buildSampleGrid(10, count);
      setCells(sample);
    } else {
      setAlgorithm(parsed[0]);
      setCompareMode(false);
    }

    if (autorun) {
      // 마운트 후 짧은 딜레이로 자동 실행 트리거
      setTimeout(() => {
        // handleRun은 closure scope 밖이므로 event 방식 활용
        document.dispatchEvent(new CustomEvent('playground:autorun'));
      }, 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 그리드 초기화 ─────────────────────────────────────────────────
  const resetGrid = useCallback(() => {
    setCells(buildEmptyGrid(gridSize));
    setResult(null);
    setComparisonResults([]);
    setReplayStep(-1);
    setIsPlaying(false);
  }, [gridSize]);

  const handleGridSizeChange = useCallback((size: number) => {
    setGridSize(size);
    setCells(buildEmptyGrid(size));
    setResult(null);
    setComparisonResults([]);
    setReplayStep(-1);
    setIsPlaying(false);
  }, []);

  // ── 셀 클릭 ──────────────────────────────────────────────────────
  const applyCell = useCallback((col: number, row: number, drag = false) => {
    setCells((prev) => {
      const next = cloneGrid(prev);
      const cell = next[row][col];

      if (drag) {
        if (cell.state !== 'start' && cell.state !== 'goal')
          next[row][col] = { col, row, state: 'obstacle' };
        return next;
      }

      if (cell.state === 'empty') {
        if (clickMode === 'obstacle') {
          next[row][col] = { col, row, state: 'obstacle' };
        } else if (clickMode === 'start') {
          const agentIdx = next.flat().filter((c) => c.state === 'start').length % agentCount;
          next[row][col] = { col, row, state: 'start', agentIndex: agentIdx };
        } else {
          const agentIdx = next.flat().filter((c) => c.state === 'goal').length % agentCount;
          next[row][col] = { col, row, state: 'goal', agentIndex: agentIdx };
        }
      } else {
        next[row][col] = { col, row, state: 'empty' };
      }
      return next;
    });
  }, [clickMode, agentCount]);

  // ── 에이전트 추가/제거 ────────────────────────────────────────────
  const handleAddAgent = () => setAgentCount((n) => Math.min(n + 1, 8));
  const handleRemoveAgent = () => {
    setAgentCount((n) => {
      const next = Math.max(n - 1, 1);
      setCells((prev) => prev.map((row) =>
        row.map((cell) =>
          (cell.state === 'start' || cell.state === 'goal') && (cell.agentIndex ?? 0) >= next
            ? { col: cell.col, row: cell.row, state: 'empty' as CellState }
            : cell
        )
      ));
      return next;
    });
  };

  // ── 공통 시나리오 추출 ────────────────────────────────────────────
  const buildScenario = (currentCells: GridCell[][]) => {
    const flat      = currentCells.flat();
    const obstacles = flat.filter((c) => c.state === 'obstacle').map((c) => [c.col, c.row] as [number, number]);
    const startsMap = new Map<number, [number, number]>();
    const goalsMap  = new Map<number, [number, number]>();
    flat.forEach((c) => {
      if (c.state === 'start') startsMap.set(c.agentIndex ?? 0, [c.col, c.row]);
      if (c.state === 'goal')  goalsMap.set(c.agentIndex ?? 0,  [c.col, c.row]);
    });

    const effectiveCount = mode === 'single' ? 1 : agentCount;
    const starts: [number, number][] = [];
    const goals:  [number, number][] = [];
    for (let i = 0; i < effectiveCount; i++) {
      if (!startsMap.has(i) || !goalsMap.has(i)) {
        toast.error(`에이전트 ${i + 1}의 시작 또는 목적지가 지정되지 않았습니다.`);
        return null;
      }
      starts.push(startsMap.get(i)!);
      goals.push(goalsMap.get(i)!);
    }
    return { obstacles, starts, goals };
  };

  // ── 실행 ──────────────────────────────────────────────────────────
  const handleRun = useCallback(async (overrideCells?: GridCell[][]) => {
    const scenario = buildScenario(overrideCells ?? cells);
    if (!scenario) return;

    setIsRunning(true);
    setResult(null);
    setComparisonResults([]);
    setReplayStep(-1);
    setIsPlaying(false);

    if (compareMode) {
      // 비교 모드: 선택된 알고리즘 병렬 실행
      try {
        const results = await Promise.all(
          compareAlgorithms.map((alg) =>
            solvePlayground({ grid_size: gridSize, ...scenario, algorithm: alg })
              .then((res) => ({ algorithm: alg, response: res } as AlgoResult))
              .catch(() => null)
          )
        );
        const valid = results.filter((r): r is AlgoResult => r !== null);
        setComparisonResults(valid);
        setReplayStep(0);

        const fallbacks = valid.filter((r) => r.response.fallback).map((r) => r.algorithm);
        if (fallbacks.length > 0) toast.warning(`${fallbacks.join(', ')}: A* 폴백으로 실행됨`);

        const conflicts = valid.filter((r) => r.response.conflict_count > 0);
        if (conflicts.length > 0)
          toast.info(`${conflicts.map((r) => r.algorithm).join(', ')}: 충돌 발생 — CBS-TS 결과와 비교하세요`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '경로 계산 실패');
      }
    } else {
      // 단일 모드
      try {
        const res = await solvePlayground({ grid_size: gridSize, ...scenario, algorithm });
        setResult(res);
        setReplayStep(0);
        if (res.fallback) toast.warning('AI 모델 미로드 — A* 폴백으로 실행되었습니다.');
        if (res.conflict_count > 0) toast.warning(`충돌 ${res.conflict_count}건 발견`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '경로 계산 실패. AI 엔진 서버가 실행 중인지 확인해주세요.');
      }
    }

    setIsRunning(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, algorithm, compareMode, compareAlgorithms, gridSize, mode, agentCount]);

  // autorun 이벤트 리스너
  useEffect(() => {
    const handler = () => handleRun();
    document.addEventListener('playground:autorun', handler);
    return () => document.removeEventListener('playground:autorun', handler);
  }, [handleRun]);

  // ── 클릭 모드 탭 ─────────────────────────────────────────────────
  const CLICK_MODES: { value: ClickMode; label: string; color: string }[] = [
    { value: 'obstacle', label: '장애물', color: 'bg-gray-800 text-white' },
    { value: 'start',    label: '시작(S)', color: 'bg-green-600 text-white' },
    { value: 'goal',     label: '목적(G)', color: 'bg-red-500 text-white' },
  ];

  const activeResult   = comparisonResults.length > 0 ? null : result;
  const activeMakespan = comparisonResults.length > 0
    ? Math.max(...comparisonResults.map((r) => r.response.makespan))
    : (result?.makespan ?? 0);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Algorithm Playground</h1>
        <p className="mt-0.5 text-sm text-gray-500">그리드에서 출발/목적지 지정 후 알고리즘별 경로를 비교하세요</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* 좌측: 그리드 + 재생 */}
        <div className="space-y-4">
          {/* 클릭 모드 선택 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">클릭 모드:</span>
            <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
              {CLICK_MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setClickMode(m.value)}
                  className={`px-3 py-1 font-medium transition-colors ${
                    clickMode === m.value ? m.color : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {compareMode && comparisonResults.length > 0 && (
              <span className="ml-auto text-[10px] text-violet-600 font-medium">
                {comparisonResults.length}개 알고리즘 비교 중
              </span>
            )}
          </div>

          <Card>
            <CardContent className="p-4 flex justify-center overflow-auto">
              <PlaygroundGrid
                gridSize={gridSize}
                cells={cells}
                agentPaths={activeResult?.agent_paths}
                comparisonResults={comparisonResults.length > 0 ? comparisonResults : undefined}
                replayStep={replayStep}
                algorithm={algorithm}
                onCellClick={(col, row) => applyCell(col, row, false)}
                onCellDrag={(col, row) => applyCell(col, row, true)}
              />
            </CardContent>
          </Card>

          {/* 재생 컨트롤 */}
          {activeMakespan > 0 && (result || comparisonResults.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-700">애니메이션 재생</CardTitle>
              </CardHeader>
              <CardContent>
                <PlaygroundReplay
                  makespan={activeMakespan}
                  step={replayStep < 0 ? 0 : replayStep}
                  isPlaying={isPlaying}
                  onStepChange={setReplayStep}
                  onPlayToggle={() => {
                    if (replayStep >= activeMakespan) setReplayStep(0);
                    setIsPlaying((p) => !p);
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* 우측: 컨트롤 + 결과 */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-800">설정</CardTitle>
            </CardHeader>
            <CardContent>
              <PlaygroundControls
                algorithm={algorithm}
                onAlgorithmChange={setAlgorithm}
                compareMode={compareMode}
                onCompareModeChange={setCompareMode}
                compareAlgorithms={compareAlgorithms}
                onCompareAlgorithmsChange={setCompareAlgorithms}
                mode={mode}
                onModeChange={(m) => {
                  setMode(m);
                  if (m === 'single') setAgentCount(1);
                }}
                agentCount={agentCount}
                onAddAgent={handleAddAgent}
                onRemoveAgent={handleRemoveAgent}
                gridSize={gridSize}
                onGridSizeChange={handleGridSizeChange}
                onRun={() => handleRun()}
                onReset={resetGrid}
                isRunning={isRunning}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-800">결과</CardTitle>
            </CardHeader>
            <CardContent>
              <PlaygroundResults
                result={activeResult}
                algorithm={algorithm}
                isRunning={isRunning}
                comparisonResults={comparisonResults.length > 0 ? comparisonResults : undefined}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-gray-400">로딩 중…</div>}>
      <PlaygroundPageInner />
    </Suspense>
  );
}
