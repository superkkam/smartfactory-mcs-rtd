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
import { useRuleQueryParams, useSaveRuleQueryParams } from '@/lib/api/rule-query-params';

interface ParamRow {
  paramKey: string;
  paramValue: string;
  targetColumn: string;
}

interface ParamEditorModalProps {
  open: boolean;
  onClose: () => void;
  ruleId?: string;
}

/** 파라미터 바인딩 편집기 모달 */
export function ParamEditorModal({ open, onClose, ruleId }: ParamEditorModalProps) {
  const { data: existingParams = [] } = useRuleQueryParams(ruleId);
  const saveParams = useSaveRuleQueryParams();

  const [rows, setRows] = useState<ParamRow[]>([
    { paramKey: ':LOT_STATE', paramValue: 'WAIT', targetColumn: 'LOT_STATE' },
  ]);

  /** 기존 데이터 로드 */
  useEffect(() => {
    if (existingParams.length > 0) {
      setRows(existingParams.map((p) => ({
        paramKey:     p.paramKey,
        paramValue:   p.paramValue,
        targetColumn: p.targetColumn,
      })));
    }
  }, [existingParams]);

  function addRow() {
    setRows([...rows, { paramKey: '', paramValue: '', targetColumn: '' }]);
  }

  function removeRow(idx: number) {
    setRows(rows.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, field: keyof ParamRow, val: string) {
    setRows(rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  }

  async function handleSave() {
    if (!ruleId) return;
    await saveParams.mutateAsync({
      ruleId,
      params: rows.filter((r) => r.paramKey),
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>파라미터 바인딩 편집기</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* 헤더 */}
          <div className="grid grid-cols-[2fr_2fr_2fr_auto] gap-2 text-xs font-medium text-gray-500 px-1">
            <span>파라미터 키</span>
            <span>바인딩 값</span>
            <span>대상 컬럼</span>
            <span />
          </div>

          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-[2fr_2fr_2fr_auto] gap-2 items-center">
              <Input
                placeholder=":PARAM_KEY"
                value={row.paramKey}
                onChange={(e) => updateRow(idx, 'paramKey', e.target.value)}
              />
              <Input
                placeholder="바인딩 값"
                value={row.paramValue}
                onChange={(e) => updateRow(idx, 'paramValue', e.target.value)}
              />
              <Input
                placeholder="TARGET_COLUMN"
                value={row.targetColumn}
                onChange={(e) => updateRow(idx, 'targetColumn', e.target.value)}
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
          <Button variant="outline" onClick={onClose} disabled={saveParams.isPending}>취소</Button>
          <Button onClick={handleSave} disabled={saveParams.isPending || !ruleId}>
            {saveParams.isPending ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
