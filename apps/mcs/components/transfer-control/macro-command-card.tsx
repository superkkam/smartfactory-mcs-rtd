'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Route } from 'lucide-react';
import type { AstarPathStep } from './astar-route-table';

/** 명령 상태 배지 */
const PENDING_BADGE = { style: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: '대기' };

interface MacroCommandCardProps {
  sourceLabel:  string;
  destLabel:    string;
  path:         AstarPathStep[];
  totalCost:    number;
  algorithm:    'astar' | 'ai_ppo';
}

/** 반송 제어 페이지용 MacroCommand 카드 (경로 탐색 결과로 생성된 명령 표시) */
export function MacroCommandCard({
  sourceLabel,
  destLabel,
  path,
  totalCost,
  algorithm,
}: MacroCommandCardProps) {
  const [expanded, setExpanded] = useState(true);
  const badge = PENDING_BADGE;
  const algo  = algorithm === 'ai_ppo' ? 'AI 추론' : 'A* 탐색';
  const estimateSec = (totalCost / 0.3).toFixed(1); // 0.3 m/s 가정

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">생성된 반송 명령</span>
        <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${badge.style}`}>
          {badge.label}
        </span>
      </div>

      {/* 명령 요약 정보 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-3">
        <div>
          <span className="text-xs text-gray-400">출발 유닛</span>
          <p className="font-medium text-gray-700">{sourceLabel}</p>
        </div>
        <div>
          <span className="text-xs text-gray-400">목적 유닛</span>
          <p className="font-medium text-gray-700">{destLabel}</p>
        </div>
        <div>
          <span className="text-xs text-gray-400">알고리즘</span>
          <p className="font-medium text-indigo-700">{algo}</p>
        </div>
        <div>
          <span className="text-xs text-gray-400">예상 소요</span>
          <p className="flex items-center gap-1 font-medium text-gray-700">
            <Clock className="h-3 w-3" />
            {estimateSec}s
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-400">총 거리</span>
          <p className="flex items-center gap-1 font-medium text-gray-700">
            <Route className="h-3 w-3" />
            {totalCost.toFixed(1)}m
          </p>
        </div>
      </div>

      {/* MicroCommand 분해 시퀀스 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5" />
          : <ChevronRight className="h-3.5 w-3.5" />}
        MicroCommand 시퀀스 ({path.length - 1}구간)
      </button>
      {expanded && (
        <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-100 pl-3">
          {path.slice(0, -1).map((step, idx) => (
            <div key={step.unitId} className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500">
                {idx + 1}. {step.unitLabel} → {path[idx + 1]?.unitLabel}
              </span>
              <span className="rounded border px-1.5 py-0.5 text-[10px] bg-yellow-100 text-yellow-700 border-yellow-200">
                대기
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
