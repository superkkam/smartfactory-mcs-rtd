'use client';

import { useState } from 'react';
import { Play, FlaskConical, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label }  from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

type AlgorithmKey = 'astar' | 'ai_ppo' | 'cbs_ts' | 'cactus';
type AlgorithmOption = 'ASTAR' | 'AI' | 'CBS_TS' | 'CACTUS' | 'COMPARE' | 'COMPARE_ALL';

export interface ScenarioFormParams {
  carrierCount: number;
  utilizationRate: number;
  simulationDuration: number;
  algorithms: AlgorithmKey[];
  mode: 'online' | 'batch';
  journalMode: boolean;
}

interface ScenarioFormProps {
  onRun: (params: ScenarioFormParams) => void;
  disabled?: boolean;
}

function toAlgorithms(opt: AlgorithmOption): AlgorithmKey[] {
  switch (opt) {
    case 'ASTAR':       return ['astar'];
    case 'AI':          return ['ai_ppo'];
    case 'CBS_TS':      return ['cbs_ts'];
    case 'CACTUS':      return ['cactus'];
    case 'COMPARE':     return ['astar', 'ai_ppo'];
    case 'COMPARE_ALL': return ['astar', 'ai_ppo', 'cbs_ts', 'cactus'];
  }
}

// 부하율 → 예상 반송 수 (avg_travel_time 30s 기준 프리뷰용)
function estimateRequests(rho: number, carriers: number, duration: number) {
  const AVG_TRAVEL_SEC = 30;
  return Math.max(2, Math.round(rho * carriers * duration / AVG_TRAVEL_SEC));
}

const UTILIZATION_LEVELS = [
  { value: 0.3, label: '저부하 30%', desc: '충돌 희박 — 알고리즘 차이 작음' },
  { value: 0.5, label: '중부하 50%', desc: '균형 — 기본 비교 시나리오' },
  { value: 0.7, label: '고부하 70%', desc: '충돌 빈번 — CBS-TS 우위 가시화' },
  { value: 0.9, label: '과부하 90%', desc: '포화 상태 — 알고리즘 한계점 탐색' },
] as const;

const DURATION_OPTIONS = [
  { value: 180,  label: '3분 (180s) — 빠른 검증' },
  { value: 300,  label: '5분 (300s) — 표준' },
  { value: 600,  label: '10분 (600s) — 정밀 비교' },
  { value: 1200, label: '20분 (1200s) — 논문용' },
] as const;

export function ScenarioForm({ onRun, disabled }: ScenarioFormProps) {
  const [carrierCount,     setCarrierCount]     = useState(10);
  const [utilizationRate,  setUtilizationRate]  = useState<number>(0.5);
  const [simulationDuration, setSimDuration]    = useState(300);
  const [algorithm,        setAlgorithm]        = useState<string>('COMPARE_ALL');
  const [mode,             setMode]             = useState<'online' | 'batch'>('batch');
  const [journalMode,      setJournalMode]      = useState(false);

  const estRequests = estimateRequests(utilizationRate, carrierCount, simulationDuration);

  const handleRun = () => {
    onRun({
      carrierCount,
      utilizationRate,
      simulationDuration,
      algorithms: toAlgorithms((algorithm ?? 'COMPARE_ALL') as AlgorithmOption),
      mode,
      journalMode,
    });
  };

  return (
    <div className="space-y-5">
      {/* 1행: 캐리어 수 + 알고리즘 + 모드 + 시간 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* 캐리어 수 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">캐리어 수 (N)</Label>
          <Select
            value={String(carrierCount)}
            onValueChange={(v) => setCarrierCount(Number(v))}
            disabled={disabled}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 8, 10, 16, 20, 32].map((n) => (
                <SelectItem key={n} value={String(n)} className="text-sm">{n}대</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 시뮬레이션 시간 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">시뮬레이션 시간</Label>
          <Select
            value={String(simulationDuration)}
            onValueChange={(v) => setSimDuration(Number(v))}
            disabled={disabled}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((d) => (
                <SelectItem key={d.value} value={String(d.value)} className="text-sm">{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 알고리즘 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">알고리즘</Label>
          <Select
            onValueChange={(v) => { if (v) setAlgorithm(v); }}
            value={algorithm}
            disabled={disabled}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="알고리즘 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COMPARE_ALL">전체 비교 (A* + AI + CBS-TS + CACTUS)</SelectItem>
              <SelectItem value="COMPARE">A* vs AI 비교</SelectItem>
              <SelectItem value="ASTAR">A* 단독</SelectItem>
              <SelectItem value="AI">AI (PPO) 단독</SelectItem>
              <SelectItem value="CBS_TS">CBS-TS 단독</SelectItem>
              <SelectItem value="CACTUS">CACTUS (Smoke) 단독</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 시뮬레이션 모드 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">시뮬레이션 모드</Label>
          <Select
            onValueChange={(v) => { if (v === 'online' || v === 'batch') setMode(v); }}
            value={mode}
            disabled={disabled}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="online">Online (순차 도착)</SelectItem>
              <SelectItem value="batch">Batch (MAPF 표준)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 부하율 선택 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-medium text-gray-700">부하율 ρ (Traffic Density)</Label>
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
            <Info className="h-3 w-3" />
            캐리어 동시 활성 비율 — 알고리즘 충돌 난이도 결정
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {UTILIZATION_LEVELS.map((lvl) => (
            <button
              key={lvl.value}
              type="button"
              disabled={disabled}
              onClick={() => setUtilizationRate(lvl.value)}
              className={`rounded-md border px-3 py-2 text-left transition-all ${
                utilizationRate === lvl.value
                  ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <p className={`text-xs font-semibold ${utilizationRate === lvl.value ? 'text-indigo-700' : 'text-gray-800'}`}>
                {lvl.label}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{lvl.desc}</p>
            </button>
          ))}
        </div>

        {/* 자동 계산 프리뷰 */}
        <div className="flex items-center gap-2 rounded bg-gray-50 border border-gray-100 px-3 py-1.5 text-xs text-gray-600">
          <span className="font-medium">예상 반송 수:</span>
          <span className="font-semibold text-indigo-700">≈ {estRequests}건</span>
          <span className="text-gray-400 text-[10px]">
            (ρ={utilizationRate} × N={carrierCount} × T={simulationDuration}s / 평균이동30s)
            — 실제 값은 레이아웃 그래프에서 정확히 계산됨
          </span>
        </div>
      </div>

      {mode === 'batch' && (
        <p className="text-[11px] text-blue-600 bg-blue-50 rounded px-2 py-1">
          Batch 모드: 전체 캐리어 경로를 한 번에 계획합니다. CBS-TS가 충돌 없는 경로를 산출해 Makespan·Conflict 지표에서 우위를 보입니다.
        </p>
      )}

      {/* 저널 모드 */}
      <div className="flex items-center gap-3 rounded-md border border-violet-200 bg-violet-50 px-3 py-2">
        <FlaskConical className="h-4 w-4 text-violet-600 shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-medium text-violet-800">저널 실험 모드</p>
          <p className="text-[10px] text-violet-600">
            25시드 반복 실행 + Wilcoxon 검정 + 95% CI — 완료까지 약 5~15분 소요
          </p>
        </div>
        <input
          type="checkbox"
          checked={journalMode}
          onChange={(e) => setJournalMode(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded accent-violet-600 cursor-pointer"
        />
      </div>

      <Button onClick={handleRun} disabled={disabled} className="gap-2">
        <Play className="h-4 w-4" />
        {journalMode ? '저널 실험 실행 (25시드)' : '시뮬레이션 실행'}
      </Button>
    </div>
  );
}
