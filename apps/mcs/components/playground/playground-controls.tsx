'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Play, RotateCcw, Plus, Trash2, GitCompare } from 'lucide-react';
import type { PlaygroundAlgorithm } from '@/lib/api/ai-engine';

interface PlaygroundControlsProps {
  algorithm: PlaygroundAlgorithm;
  onAlgorithmChange: (v: PlaygroundAlgorithm) => void;
  compareMode: boolean;
  onCompareModeChange: (v: boolean) => void;
  compareAlgorithms: PlaygroundAlgorithm[];
  onCompareAlgorithmsChange: (v: PlaygroundAlgorithm[]) => void;
  mode: 'single' | 'multi';
  onModeChange: (v: 'single' | 'multi') => void;
  agentCount: number;
  onAddAgent: () => void;
  onRemoveAgent: () => void;
  gridSize: number;
  onGridSizeChange: (v: number) => void;
  onRun: () => void;
  onReset: () => void;
  isRunning: boolean;
}

const ALGO_OPTIONS: { value: PlaygroundAlgorithm; label: string; desc: string }[] = [
  { value: 'astar',       label: 'A* (Dijkstra)',    desc: '최단 경로, 단일 에이전트' },
  { value: 'ai_ppo',      label: 'AI (PPO)',          desc: '강화학습 경로, 단일 에이전트 (smoke 학습)' },
  { value: 'prioritized', label: 'Prioritized',       desc: '우선순위 기반 MAPF 베이스라인' },
  { value: 'cbs_ts',      label: 'CBS-TS',            desc: 'CBS 충돌 없는 MAPF 최적해' },
];

const ALGO_COLORS: Record<PlaygroundAlgorithm, string> = {
  astar:       'bg-red-50 text-red-700 border-red-200',
  ai_ppo:      'bg-blue-50 text-blue-700 border-blue-200',
  prioritized: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cbs_ts:      'bg-violet-50 text-violet-700 border-violet-200',
};

const ALGO_CHECK_COLORS: Record<PlaygroundAlgorithm, string> = {
  astar:       'border-red-300 text-red-700 bg-red-50',
  ai_ppo:      'border-blue-300 text-blue-700 bg-blue-50',
  prioritized: 'border-emerald-300 text-emerald-700 bg-emerald-50',
  cbs_ts:      'border-violet-300 text-violet-700 bg-violet-50',
};

export function PlaygroundControls({
  algorithm, onAlgorithmChange,
  compareMode, onCompareModeChange,
  compareAlgorithms, onCompareAlgorithmsChange,
  mode, onModeChange,
  agentCount, onAddAgent, onRemoveAgent,
  gridSize, onGridSizeChange,
  onRun, onReset,
  isRunning,
}: PlaygroundControlsProps) {

  const toggleCompareAlgo = (v: PlaygroundAlgorithm) => {
    if (compareAlgorithms.includes(v)) {
      if (compareAlgorithms.length > 1)
        onCompareAlgorithmsChange(compareAlgorithms.filter((a) => a !== v));
    } else {
      onCompareAlgorithmsChange([...compareAlgorithms, v]);
    }
  };

  return (
    <div className="space-y-4">
      {/* 비교 모드 토글 */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-gray-700">알고리즘</Label>
        <button
          onClick={() => onCompareModeChange(!compareMode)}
          className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
            compareMode
              ? 'border-violet-300 bg-violet-50 text-violet-700'
              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          <GitCompare className="h-3 w-3" />
          비교 모드
        </button>
      </div>

      {/* 단일 선택 */}
      {!compareMode && (
        <div className="grid grid-cols-2 gap-1.5">
          {ALGO_OPTIONS.map((opt) => (
            <TooltipProvider key={opt.value}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onAlgorithmChange(opt.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onAlgorithmChange(opt.value)}
                      className={`
                        rounded border px-2 py-1.5 text-left text-xs font-medium transition-all cursor-pointer
                        ${algorithm === opt.value
                          ? ALGO_COLORS[opt.value]
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}
                      `}
                    >
                      {opt.label}
                    </div>
                  }
                />
                <TooltipContent side="bottom" className="text-xs">
                  {opt.desc}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      )}

      {/* 비교 모드 — 다중 선택 체크박스 */}
      {compareMode && (
        <div className="space-y-1.5">
          {ALGO_OPTIONS.map((opt) => {
            const checked = compareAlgorithms.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-2 rounded border px-2.5 py-1.5 text-xs font-medium transition-all ${
                  checked ? ALGO_CHECK_COLORS[opt.value] : 'border-gray-200 bg-gray-50 text-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCompareAlgo(opt.value)}
                  className="h-3 w-3 accent-current"
                />
                {opt.label}
              </label>
            );
          })}
          <p className="text-[10px] text-gray-400">
            {compareAlgorithms.length}개 선택 — 동일 시나리오로 동시 실행
          </p>
        </div>
      )}

      {/* 모드 */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">모드</Label>
        <div className="flex rounded border border-gray-200 overflow-hidden text-xs">
          {(['single', 'multi'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`flex-1 py-1.5 font-medium transition-colors ${
                mode === m
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m === 'single' ? 'Single (1 에이전트)' : 'Multi (N 에이전트)'}
            </button>
          ))}
        </div>
      </div>

      {/* 에이전트 수 (multi 모드) */}
      {mode === 'multi' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">에이전트 수: {agentCount}</Label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onRemoveAgent} disabled={agentCount <= 1} className="text-xs">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> 제거
            </Button>
            <Button size="sm" variant="outline" onClick={onAddAgent} disabled={agentCount >= 8} className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> 추가
            </Button>
          </div>
          <p className="text-[10px] text-gray-400">각 에이전트 S/G를 그리드에서 클릭하여 지정</p>
        </div>
      )}

      {/* 그리드 크기 */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">그리드 크기</Label>
        <Select
          value={String(gridSize)}
          onValueChange={(v) => onGridSizeChange(Number(v))}
        >
          <SelectTrigger className="text-xs h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[6, 8, 10, 12, 15].map((s) => (
              <SelectItem key={s} value={String(s)} className="text-xs">
                {s}×{s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 조작 안내 */}
      <div className="rounded bg-gray-50 border border-gray-100 p-2 space-y-0.5">
        <p className="text-[10px] text-gray-500 font-medium">그리드 조작</p>
        <p className="text-[10px] text-gray-400">클릭: 빈칸 → S → G → 장애물 → 빈칸</p>
        <p className="text-[10px] text-gray-400">드래그: 장애물 연속 그리기</p>
      </div>

      {/* 실행/초기화 버튼 */}
      <div className="flex gap-2">
        <Button onClick={onRun} disabled={isRunning} className="flex-1 text-xs gap-1.5">
          <Play className="h-3.5 w-3.5" />
          {isRunning ? '계산 중…' : compareMode ? `비교 실행 (${compareAlgorithms.length}종)` : '실행'}
        </Button>
        <Button onClick={onReset} variant="outline" className="text-xs gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          초기화
        </Button>
      </div>
    </div>
  );
}
