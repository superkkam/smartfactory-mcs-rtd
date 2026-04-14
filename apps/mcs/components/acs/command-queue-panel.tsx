'use client';

import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useActiveMacroCommands } from '@/lib/api/macro-commands';
import type { EquipmentUnit } from '@workspace/types/mcs';

interface CommandQueuePanelProps {
  units: EquipmentUnit[];
}

/**
 * 반송 명령 현황 패널
 * - Pending / InProgress 명령 목록 표시 (3초 폴링)
 * - 개별 취소 + 전체 취소 기능
 */
export function CommandQueuePanel({ units }: CommandQueuePanelProps) {
  const { data: commands = [], refetch } = useActiveMacroCommands();
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());

  /** unit id → 라벨 변환 */
  const unitLabel = (id: string) =>
    units.find((u) => u.id === id)?.equipmentUnitId ?? id.slice(0, 8) + '…';

  /** 단건 취소: macro + 하위 micro 전부 Cancelled */
  const cancelOne = async (macroId: string) => {
    setCancelling((prev) => new Set(prev).add(macroId));
    try {
      const supabase = createClient();
      await supabase
        .from('mcs_micro_command')
        .update({ state: 'Cancelled' })
        .eq('macro_command_id', macroId)
        .not('state', 'eq', 'Completed');
      await supabase
        .from('mcs_macro_command')
        .update({ state: 'Cancelled' })
        .eq('id', macroId);
      refetch();
    } finally {
      setCancelling((prev) => {
        const next = new Set(prev);
        next.delete(macroId);
        return next;
      });
    }
  };

  /** 전체 취소 */
  const cancelAll = async () => {
    if (commands.length === 0) return;
    const ids = commands.map((c) => c.id);
    setCancelling(new Set(ids));
    try {
      const supabase = createClient();
      await supabase
        .from('mcs_micro_command')
        .update({ state: 'Cancelled' })
        .in('macro_command_id', ids)
        .not('state', 'eq', 'Completed');
      await supabase
        .from('mcs_macro_command')
        .update({ state: 'Cancelled' })
        .in('id', ids);
      refetch();
    } finally {
      setCancelling(new Set());
    }
  };

  const stateColor = (state: string) => {
    if (state === 'Pending')    return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (state === 'InProgress') return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-gray-50 text-gray-500 border-gray-200';
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          반송 명령 현황
          {commands.length > 0 && (
            <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700">
              {commands.length}
            </span>
          )}
        </h3>
        {commands.length > 0 && (
          <button
            onClick={cancelAll}
            disabled={cancelling.size > 0}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" />
            전체 취소
          </button>
        )}
      </div>

      {commands.length === 0 ? (
        <p className="text-center text-[11px] text-gray-400 py-3">대기 중인 명령 없음</p>
      ) : (
        <ul className="space-y-1.5">
          {commands.map((cmd) => (
            <li
              key={cmd.id}
              className="flex items-center justify-between gap-2 rounded border border-gray-100 bg-gray-50 px-2.5 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium ${stateColor(cmd.state)}`}>
                    {cmd.state}
                  </span>
                  <span className="truncate text-[11px] text-gray-700 font-mono">
                    {unitLabel(cmd.sourceUnitId)} → {unitLabel(cmd.destUnitId)}
                  </span>
                </div>
                <p className="mt-0.5 text-[9px] text-gray-400">
                  {cmd.commandId.slice(0, 24)}
                </p>
              </div>
              <button
                onClick={() => cancelOne(cmd.id)}
                disabled={cancelling.has(cmd.id)}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                title="취소"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
