'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import type { PortNodeData } from './types';

export interface BatchRouteConfig {
  system: string;
  weight: number;
}

interface BatchRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 선택된 Port 노드 (id 포함) */
  selectedPorts: Array<{ id: string; data: PortNodeData }>;
  onConfirm: (config: BatchRouteConfig) => void;
}

/** 방향 제한에 따라 생성 가능한 양방향 경로 목록 계산 */
function computeRoutes(ports: Array<{ id: string; data: PortNodeData }>) {
  const routes: Array<{ sourceId: string; sourceName: string; targetId: string; targetName: string }> = [];
  for (let i = 0; i < ports.length; i++) {
    for (let j = 0; j < ports.length; j++) {
      if (i === j) continue;
      const src = ports[i];
      const tgt = ports[j];
      // IN 포트는 출발 불가
      if (src.data.direction === 'IN') continue;
      // OUT 포트는 도착 불가
      if (tgt.data.direction === 'OUT') continue;
      routes.push({
        sourceId:   src.id,
        sourceName: src.data.name,
        targetId:   tgt.id,
        targetName: tgt.data.name,
      });
    }
  }
  return routes;
}

const DIRECTION_BADGE: Record<string, { label: string; cls: string }> = {
  IN:   { label: 'IN',  cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  OUT:  { label: 'OUT', cls: 'bg-orange-100 text-orange-700 border-orange-300' },
  BOTH: { label: 'I/O', cls: 'bg-purple-100 text-purple-700 border-purple-300' },
};

/**
 * 경로 일괄 생성 모달
 * - 선택된 Port 목록 + 방향 배지 표시
 * - ACS 시스템 + Weight 입력
 * - 생성될 경로 미리보기 테이블
 */
export function BatchRouteDialog({
  open,
  onOpenChange,
  selectedPorts,
  onConfirm,
}: BatchRouteDialogProps) {
  const [system, setSystem] = useState('ACS-001');
  const [weight, setWeight] = useState('5');

  const routes = useMemo(() => computeRoutes(selectedPorts), [selectedPorts]);

  function handleConfirm() {
    const w = parseFloat(weight);
    onConfirm({ system: system.trim(), weight: isNaN(w) ? 5 : w });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>경로 일괄 생성</DialogTitle>
        </DialogHeader>

        {/* 선택된 포트 목록 */}
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              선택된 포트 ({selectedPorts.length}개)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedPorts.map((p) => {
                const dir = DIRECTION_BADGE[p.data.direction] ?? DIRECTION_BADGE['BOTH'];
                return (
                  <span
                    key={p.id}
                    className="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700"
                  >
                    {p.data.name}
                    <span className={`rounded border px-1 py-0 text-[9px] font-medium ${dir.cls}`}>
                      {dir.label}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* 파라미터 입력 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="batch-system" className="text-xs">ACS 시스템</Label>
              <Input
                id="batch-system"
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                placeholder="예: ACS-001"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="batch-weight" className="text-xs">기본 거리(m)</Label>
              <Input
                id="batch-weight"
                type="number"
                min="0"
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* 경로 미리보기 */}
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              생성될 경로 미리보기 ({routes.length}개)
            </p>
            {routes.length === 0 ? (
              <p className="rounded border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400">
                생성 가능한 경로가 없습니다.<br />
                <span className="text-[10px]">IN→IN 또는 OUT→OUT 조합은 제외됩니다.</span>
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded border border-gray-100">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium text-gray-400">#</th>
                      <th className="px-2 py-1 text-left font-medium text-gray-400">출발 포트</th>
                      <th className="px-2 py-1 text-left font-medium text-gray-400">도착 포트</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((r, i) => (
                      <tr key={`${r.sourceId}-${r.targetId}`} className="border-t border-gray-50">
                        <td className="px-2 py-1 text-gray-300">{i + 1}</td>
                        <td className="px-2 py-1 font-medium text-gray-700">{r.sourceName}</td>
                        <td className="px-2 py-1 text-gray-600">→ {r.targetName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            취소
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={routes.length === 0}
            className="text-xs"
          >
            경로 {routes.length}개 생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
