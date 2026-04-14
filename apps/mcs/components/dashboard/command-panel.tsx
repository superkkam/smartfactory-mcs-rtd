'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { useActiveMacroCommands } from '@/lib/api/macro-commands';
import { useMicroCommandsByMacro } from '@/lib/api/micro-commands';
import type { MacroCommand, MicroCommand } from '@workspace/types/mcs';

/** 명령 상태 → 배지 스타일 */
const STATE_BADGE: Record<string, { style: string; label: string }> = {
  Pending:    { style: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: '대기' },
  InProgress: { style: 'bg-blue-100   text-blue-700   border-blue-200',   label: '진행중' },
  Completed:  { style: 'bg-green-100  text-green-700  border-green-200',  label: '완료' },
  Failed:     { style: 'bg-red-100    text-red-600    border-red-200',    label: '실패' },
};

/** MicroCommand 단계 목록 */
function MicroSteps({ macroId }: { macroId: string }) {
  const { data: micros = [] } = useMicroCommandsByMacro(macroId);
  if (micros.length === 0) return null;
  return (
    <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100 pl-3">
      {micros.map((m: MicroCommand) => {
        const badge = STATE_BADGE[m.state] ?? STATE_BADGE.Pending;
        return (
          <div key={m.id} className="flex items-center justify-between text-[10px]">
            <span className="text-gray-500">
              {m.sequence}. {m.departureUnitId} → {m.arrivalUnitId}
            </span>
            <span className={`rounded border px-1 py-0.5 text-[9px] ${badge.style}`}>
              {badge.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** MacroCommand 단일 카드 */
function MacroCard({ cmd }: { cmd: MacroCommand }) {
  const [expanded, setExpanded] = useState(cmd.state === 'InProgress');
  const badge = STATE_BADGE[cmd.state] ?? STATE_BADGE.Pending;

  return (
    <div className="rounded-md border border-gray-200 bg-white p-2 shadow-sm">
      {/* 헤더 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
        )}
        <span className="flex-1 text-xs font-medium text-gray-800">{cmd.commandId}</span>
        <span className={`rounded border px-1 py-0.5 text-[9px] font-medium ${badge.style}`}>
          {badge.label}
        </span>
      </button>

      {/* 요약 */}
      <div className="mt-1 ml-4 space-y-0.5 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
          <span className="font-medium text-gray-700">{cmd.carrierId}</span>
          <span>→</span>
          <span className="truncate">{cmd.destUnitId}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          <span>{cmd.createdAt ? new Date(cmd.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
        </div>
      </div>

      {/* MicroCommand 단계 (펼침) */}
      {expanded && <MicroSteps macroId={cmd.id} />}
    </div>
  );
}

/** 우측 명령 현황 패널 */
export function CommandPanel() {
  const { data: activeCommands = [] } = useActiveMacroCommands();
  const activeCount = activeCommands.length;

  const pendingCount    = activeCommands.filter((c) => c.state === 'Pending').length;
  const inProgressCount = activeCommands.filter((c) => c.state === 'InProgress').length;

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border border-gray-200 bg-gray-50">
      {/* 패널 헤더 */}
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5">
        <h3 className="text-sm font-semibold text-gray-800">반송 명령 현황</h3>
        {activeCount > 0 && (
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </div>

      {/* 명령 목록 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {activeCommands.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">진행 중인 명령 없음</p>
        ) : (
          activeCommands.map((cmd) => <MacroCard key={cmd.id} cmd={cmd} />)
        )}
      </div>

      {/* 통계 요약 */}
      <div className="border-t border-gray-200 px-3 py-2">
        <div className="flex justify-between text-[10px] text-gray-500">
          {(['Pending', 'InProgress'] as const).map((s) => {
            const count = s === 'Pending' ? pendingCount : inProgressCount;
            const badge = STATE_BADGE[s];
            return (
              <span key={s} className="flex items-center gap-0.5">
                <span className={`rounded border px-1 py-0.5 ${badge.style}`}>{badge.label}</span>
                <span className="font-medium text-gray-700">{count}</span>
              </span>
            );
          })}
          <span className="flex items-center gap-0.5 text-gray-400">
            활성 합계 <span className="ml-0.5 font-medium text-gray-700">{activeCount}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
