'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRuleSort, useUpsertRuleSort } from '@/lib/api/rule-sorts';
import { useUpdateRuleRelation } from '@/lib/api/rule-relations';
import type { RuleRelation } from '@workspace/types/rtd';

interface SortRow {
  sortColumn: string;
  orderBy: string;
  fromPercent: string;
  toPercent: string;
}

interface SortEditorModalProps {
  open: boolean;
  onClose: () => void;
  /** 편집 대상 릴레이션 (ruleSortId 업데이트용) */
  relation?: RuleRelation;
}

/** 정렬 조건 편집기 모달 */
export function SortEditorModal({ open, onClose, relation }: SortEditorModalProps) {
  const ruleSortId = relation?.ruleSortId ?? null;
  const { data: existingSort } = useRuleSort(ruleSortId);
  const upsertSort = useUpsertRuleSort();
  const updateRelation = useUpdateRuleRelation();

  const [rows, setRows] = useState<SortRow[]>([
    { sortColumn: 'PRIORITY', orderBy: 'DESC', fromPercent: '0', toPercent: '100' },
  ]);

  /** 기존 데이터 로드 */
  useEffect(() => {
    if (existingSort) {
      setRows([{
        sortColumn:  existingSort.sortColumn,
        orderBy:     existingSort.orderBy,
        fromPercent: String(existingSort.fromPercent ?? ''),
        toPercent:   String(existingSort.toPercent ?? ''),
      }]);
    }
  }, [existingSort]);

  function addRow() {
    setRows([...rows, { sortColumn: '', orderBy: 'ASC', fromPercent: '', toPercent: '' }]);
  }

  function removeRow(idx: number) {
    setRows(rows.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, field: keyof SortRow, val: string) {
    setRows(rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  }

  async function handleSave() {
    if (!relation || rows.length === 0 || !rows[0].sortColumn) return;

    // 연구 프로토타입: 첫 번째 정렬 조건만 저장
    const firstRow = rows[0];
    const newSortId = ruleSortId ?? `SORT_${relation.ruleGroupId}_${relation.ruleId}`;

    const saved = await upsertSort.mutateAsync({
      ruleSortId:   newSortId,
      sortColumn:   firstRow.sortColumn,
      orderBy:      firstRow.orderBy,
      fromPercent:  firstRow.fromPercent ? Number(firstRow.fromPercent) : undefined,
      toPercent:    firstRow.toPercent ? Number(firstRow.toPercent) : undefined,
    });

    // relation의 ruleSortId가 아직 없으면 업데이트
    if (!relation.ruleSortId) {
      await updateRelation.mutateAsync({ ...relation, ruleSortId: saved.ruleSortId });
    }

    onClose();
  }

  const isPending = upsertSort.isPending || updateRelation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>정렬 조건 편집기</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-xs text-gray-400">※ 첫 번째 조건이 저장됩니다 (연구 프로토타입)</p>
          {/* 헤더 */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 text-xs font-medium text-gray-500 px-1">
            <span>정렬 컬럼</span>
            <span>방향</span>
            <span>시작(%)</span>
            <span>끝(%)</span>
            <span />
          </div>

          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center">
              <Input
                placeholder="PRIORITY"
                value={row.sortColumn}
                onChange={(e) => updateRow(idx, 'sortColumn', e.target.value)}
              />
              <Select value={row.orderBy} onValueChange={(v) => v && updateRow(idx, 'orderBy', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASC">ASC</SelectItem>
                  <SelectItem value="DESC">DESC</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="0"
                value={row.fromPercent}
                onChange={(e) => updateRow(idx, 'fromPercent', e.target.value)}
              />
              <Input
                type="number"
                placeholder="100"
                value={row.toPercent}
                onChange={(e) => updateRow(idx, 'toPercent', e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500"
                onClick={() => removeRow(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            행 추가
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>취소</Button>
          <Button onClick={handleSave} disabled={isPending || !relation}>
            {isPending ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
