'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRuleQuery, useUpsertRuleQuery } from '@/lib/api/rule-queries';

/** 더미 테이블 목록 */
const TABLES = ['DMS_LOT', 'DMS_EQUIPMENT', 'DMS_CARRIER', 'DMS_ROUTE'];
/** 더미 연산자 */
const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN'];

interface Condition {
  column: string;
  operator: string;
  value: string;
}

interface QueryBuilderModalProps {
  open: boolean;
  onClose: () => void;
  ruleId?: string;
}

/** 쿼리 빌더 모달 — 테이블/조건/컬럼 선택 → SQL 자동 생성 후 저장 */
export function QueryBuilderModal({ open, onClose, ruleId }: QueryBuilderModalProps) {
  const { data: existingQuery } = useRuleQuery(ruleId);
  const upsertQuery = useUpsertRuleQuery();

  const [table, setTable] = useState('DMS_LOT');
  const [conditions, setConditions] = useState<Condition[]>([
    { column: 'LOT_STATE', operator: '=', value: 'WAIT' },
  ]);
  const [returnColumns, setReturnColumns] = useState('LOT_ID, PRIORITY, EQP_ID');

  /** 기존 SQL이 있으면 SQL 탭에 표시 (파싱 없이 원문 표시) */
  useEffect(() => {
    if (!open) return; // 닫힐 때는 초기화 안 함
  }, [open, existingQuery]);

  function addCondition() {
    setConditions([...conditions, { column: '', operator: '=', value: '' }]);
  }

  function removeCondition(idx: number) {
    setConditions(conditions.filter((_, i) => i !== idx));
  }

  function updateCondition(idx: number, field: keyof Condition, val: string) {
    setConditions(conditions.map((c, i) => (i === idx ? { ...c, [field]: val } : c)));
  }

  // SQL 자동 생성
  const whereClauses = conditions
    .filter((c) => c.column && c.value)
    .map((c) => `  ${c.column} ${c.operator} '${c.value}'`)
    .join('\n  AND ');
  const generatedSQL = `SELECT ${returnColumns}\nFROM ${table}${whereClauses ? `\nWHERE\n${whereClauses}` : ''}`;

  async function handleSave() {
    if (!ruleId) return;
    await upsertQuery.mutateAsync({ ruleId, sql: generatedSQL });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>쿼리 빌더{ruleId ? ` — ${ruleId}` : ''}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="builder" className="mt-2">
          <TabsList>
            <TabsTrigger value="builder">빌더</TabsTrigger>
            <TabsTrigger value="sql">SQL 미리보기</TabsTrigger>
            {existingQuery && <TabsTrigger value="saved">저장된 SQL</TabsTrigger>}
          </TabsList>

          <TabsContent value="builder" className="space-y-4 pt-4">
            {/* Step 1: 기준 테이블 */}
            <div className="space-y-1.5">
              <Label>① 기준 테이블 선택</Label>
              <Select value={table} onValueChange={(v) => v && setTable(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABLES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: 조건 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>② WHERE 조건</Label>
                <Button variant="outline" size="sm" onClick={addCondition}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  조건 추가
                </Button>
              </div>
              {conditions.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="컬럼명"
                    value={c.column}
                    onChange={(e) => updateCondition(idx, 'column', e.target.value)}
                  />
                  <Select
                    value={c.operator}
                    onValueChange={(v) => v && updateCondition(idx, 'operator', v)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op} value={op}>{op}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1"
                    placeholder="값"
                    value={c.value}
                    onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500"
                    onClick={() => removeCondition(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Step 3: 반환 컬럼 */}
            <div className="space-y-1.5">
              <Label>③ 반환 컬럼 (SELECT)</Label>
              <Input
                value={returnColumns}
                onChange={(e) => setReturnColumns(e.target.value)}
                placeholder="LOT_ID, PRIORITY, EQP_ID"
              />
            </div>
          </TabsContent>

          <TabsContent value="sql" className="pt-4">
            <pre className="rounded-md bg-gray-900 p-4 text-sm text-green-400 overflow-x-auto whitespace-pre-wrap">
              {generatedSQL}
            </pre>
          </TabsContent>

          {existingQuery && (
            <TabsContent value="saved" className="pt-4">
              <p className="text-xs text-gray-400 mb-2">DB에 저장된 SQL</p>
              <pre className="rounded-md bg-gray-900 p-4 text-sm text-blue-400 overflow-x-auto whitespace-pre-wrap">
                {existingQuery.ruleQueryString}
              </pre>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={upsertQuery.isPending}>취소</Button>
          <Button onClick={handleSave} disabled={upsertQuery.isPending || !ruleId}>
            {upsertQuery.isPending ? '저장 중...' : 'SQL 저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
