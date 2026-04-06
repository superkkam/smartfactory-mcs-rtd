'use client';

import { useState, useMemo } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TABLE_METADATA,
  EVENT_METADATA,
  DUMMY_QUERY_PREVIEWS,
} from '@/lib/dummy';
import { useRuleRelations, useUpdateRuleRelation } from '@/lib/api/rule-relations';
import { useRuleDefs } from '@/lib/api/rule-defs';
import { useRuleObjects } from '@/lib/api/rule-objects';
import { RULE_TYPES, MANDATORY_VALUES } from '@workspace/types/constants';
import { SortEditorModal } from '@/components/rule-builder/sort-editor-modal';
import { ParamEditorModal } from '@/components/rule-builder/param-editor-modal';
import { QueryBuilderModal } from '@/components/rule-builder/query-builder-modal';

const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN'];

// 조건 값 소스 타입
type ValueType = 'direct' | 'eventParam' | 'prevResult';

interface Condition {
  column: string;
  operator: string;
  valueType: ValueType;
  value: string; // direct: 실제 값, eventParam: param key, prevResult: ruleId
}

// Sort 행 타입
interface SortRow {
  sortColumn: string;
  orderBy: 'ASC' | 'DESC';
  weightValue: string;
}

interface NodeConfigPanelProps {
  nodeId: string;   // React Flow 노드 ID (= sequence 번호 문자열)
  groupId: string;
  onClose: () => void;
  onDelete: () => void;
}

/** 노드 설정 사이드 패널 — 룰 유형별 분기 + 파라미터 바인딩 */
export function NodeConfigPanel({ nodeId, groupId, onClose, onDelete }: NodeConfigPanelProps) {
  // 실데이터 조회 (React Query 캐시 공유 — 네트워크 중복 없음)
  const { data: relations = [] } = useRuleRelations(groupId);
  const { data: ruleDefs = [] } = useRuleDefs();
  const { data: ruleObjects = [] } = useRuleObjects(groupId);
  const updateRelation = useUpdateRuleRelation();

  const relation = relations.find((r) => String(r.sequence) === nodeId);
  const ruleDef = ruleDefs.find((d) => d.ruleId === relation?.ruleId);

  const [ruleName, setRuleName] = useState(ruleDef?.ruleName ?? '');
  const [ruleType, setRuleType] = useState(ruleDef?.ruleType ?? 'Data');
  const [mandatory, setMandatory] = useState<string>(relation?.isMandatory ?? 'N');

  // 테이블 선택 (Data / SubData)
  const [selectedTables, setSelectedTables] = useState<string[]>(['LOT']);

  // 조건 행 (Data / Filter / SubData)
  const [conditions, setConditions] = useState<Condition[]>([
    { column: '', operator: '=', valueType: 'direct', value: '' },
  ]);

  // 정렬 행 (Sort)
  const [sortRows, setSortRows] = useState<SortRow[]>([
    { sortColumn: 'PRIORITY', orderBy: 'DESC', weightValue: '100' },
  ]);

  // SQL 펼치기 여부
  const [sqlOpen, setSqlOpen] = useState(false);

  // 편집 모달 상태
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [paramModalOpen, setParamModalOpen] = useState(false);
  const [queryModalOpen, setQueryModalOpen] = useState(false);

  // 현재 룰 그룹에 연결된 이벤트 파라미터 조회
  const eventParams = useMemo(() => {
    const ruleObj = ruleObjects.find((o) => o.ruleGroupId === groupId);
    if (!ruleObj) return [];
    const eventMeta = EVENT_METADATA.find((e) => e.eventId === ruleObj.ruleEventId);
    return eventMeta?.params ?? [];
  }, [groupId, ruleObjects]);

  // 현재 시퀀스보다 앞선 룰들 (이전 룰 결과 바인딩용)
  const prevRules = useMemo(() => {
    const currentSeq = Number(nodeId);
    return relations
      .filter((r) => r.sequence < currentSeq)
      .map((r) => {
        const def = ruleDefs.find((d) => d.ruleId === r.ruleId);
        return { ruleId: r.ruleId, label: `#${r.sequence} ${def?.ruleName ?? r.ruleId} 결과` };
      });
  }, [relations, ruleDefs, nodeId]);

  // 선택된 테이블들의 컬럼 목록
  const availableColumns = useMemo(() => {
    return TABLE_METADATA.filter((t) => selectedTables.includes(t.id)).flatMap((t) => t.columns);
  }, [selectedTables]);

  // Filter일 때는 이전 룰 결과 컬럼을 가상으로 제공 (이전 룰의 결과 미리보기 컬럼)
  const filterColumns = useMemo(() => {
    if (ruleType !== 'Filter') return [];
    const prevSeq = relation?.filterSequence;
    if (!prevSeq) return [];
    const prevRel = relations.find((r) => r.sequence === prevSeq);
    if (!prevRel) return [];
    const preview = DUMMY_QUERY_PREVIEWS[prevRel.ruleId];
    return preview?.columns.map((c) => ({ name: c, label: c, type: 'string' as const })) ?? [];
  }, [ruleType, relation, relations]);

  const conditionColumns = ruleType === 'Filter' ? filterColumns : availableColumns;

  function toggleTable(tableId: string) {
    setSelectedTables((prev) =>
      prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]
    );
    setConditions([{ column: '', operator: '=', valueType: 'direct', value: '' }]);
  }

  function addCondition() {
    setConditions([...conditions, { column: '', operator: '=', valueType: 'direct', value: '' }]);
  }

  function removeCondition(idx: number) {
    setConditions(conditions.filter((_, i) => i !== idx));
  }

  function updateCondition<K extends keyof Condition>(idx: number, field: K, val: Condition[K]) {
    setConditions(conditions.map((c, i) => (i === idx ? { ...c, [field]: val } : c)));
  }

  function getColumnMeta(colName: string) {
    return conditionColumns.find((c) => c.name === colName);
  }

  // 조건 행의 값 레이블 (미리보기용)
  function getValueLabel(c: Condition): string {
    if (c.valueType === 'eventParam') {
      return eventParams.find((p) => p.key === c.value)?.label ?? c.value;
    }
    if (c.valueType === 'prevResult') {
      return prevRules.find((r) => r.ruleId === c.value)?.label ?? c.value;
    }
    return c.value;
  }

  // Sort 행 업데이트
  function updateSortRow<K extends keyof SortRow>(idx: number, field: K, val: SortRow[K]) {
    setSortRows(sortRows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  }

  // 더미 SQL 생성 (개발자용)
  const generatedSQL = useMemo(() => {
    if (ruleType === 'Sort') {
      const orderBy = sortRows.map((r) => `${r.sortColumn} ${r.orderBy}`).join(', ');
      return `-- 이전 룰 결과에 정렬 적용\nORDER BY ${orderBy || 'PRIORITY DESC'}`;
    }
    if (ruleType === 'Filter') {
      const where = conditions
        .filter((c) => c.column)
        .map((c) => `  ${c.column} ${c.operator} '${getValueLabel(c)}'`)
        .join('\n  AND ');
      return `-- 이전 룰 결과에서 필터\nWHERE\n${where || '  (조건 없음)'}`;
    }
    const mainTable = selectedTables[0] ?? 'LOT';
    const joins = selectedTables.slice(1).map((tId) => {
      const t = TABLE_METADATA.find((m) => m.id === tId);
      const main = TABLE_METADATA.find((m) => m.id === mainTable);
      return `JOIN DMS_${tId} ON DMS_${mainTable}.${main?.joinKey} = DMS_${tId}.${t?.joinKey}`;
    });
    const where = conditions
      .filter((c) => c.column)
      .map((c) => {
        const val =
          c.valueType === 'eventParam' ? `{{${c.value}}}` :
          c.valueType === 'prevResult' ? `@${c.value}` :
          `'${c.value}'`;
        return `  ${c.column} ${c.operator} ${val}`;
      })
      .join('\n  AND ');
    const fromPart = [`FROM DMS_${mainTable}`, ...joins].join('\n');
    return `SELECT *\n${fromPart}${where ? `\nWHERE\n${where}` : ''}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleType, selectedTables, conditions, sortRows]);

  const preview = relation?.ruleId ? DUMMY_QUERY_PREVIEWS[relation.ruleId] : undefined;

  async function handleSave() {
    if (!relation) return;
    await updateRelation.mutateAsync({
      ...relation,
      isMandatory: mandatory,
    });
    onClose();
  }

  return (
    <div className="w-80 flex-shrink-0 rounded-lg border border-gray-200 bg-white flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-800">
          블록 설정 — {relation?.ruleId ?? `#${nodeId}`}
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">

        {/* 기본 정보 */}
        <section className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">블록 이름</Label>
            <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-gray-500">룰 유형</Label>
              <Select value={ruleType} onValueChange={(v) => v && setRuleType(v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(RULE_TYPES).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-gray-500">필수 여부</Label>
              <Select value={mandatory} onValueChange={(v) => v && setMandatory(v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MANDATORY_VALUES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* ── Data / SubData: 데이터 대상 테이블 선택 ── */}
        {(ruleType === 'Data' || ruleType === 'SubData') && (
          <section className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">데이터 대상</Label>
            <p className="text-xs text-gray-400">복수 선택 시 자동 JOIN</p>
            <div className="space-y-1.5">
              {TABLE_METADATA.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`table-${t.id}`}
                    checked={selectedTables.includes(t.id)}
                    onCheckedChange={() => toggleTable(t.id)}
                  />
                  <label htmlFor={`table-${t.id}`} className="text-sm cursor-pointer select-none">
                    {t.label}
                  </label>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Filter: 이전 룰 결과 기반 안내 문구 ── */}
        {ruleType === 'Filter' && (
          <section className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
            이전 룰(#{relation?.filterSequence})의 조회 결과에서 필터링합니다.
          </section>
        )}

        {/* ── Sort: 정렬 조건 편집 ── */}
        {ruleType === 'Sort' && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-700">정렬 조건</Label>
              <Button
                variant="ghost" size="sm" className="h-6 text-xs px-2"
                onClick={() => setSortRows([...sortRows, { sortColumn: '', orderBy: 'ASC', weightValue: '' }])}
              >
                <Plus className="h-3 w-3 mr-0.5" />추가
              </Button>
            </div>
            {/* 헤더 */}
            <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-1 text-xs text-gray-400 px-0.5">
              <span>컬럼</span><span>방향</span><span>가중치</span><span />
            </div>
            {sortRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-1 items-center">
                <Input
                  className="h-7 text-xs" placeholder="PRIORITY"
                  value={row.sortColumn}
                  onChange={(e) => updateSortRow(idx, 'sortColumn', e.target.value)}
                />
                <Select value={row.orderBy} onValueChange={(v) => v && updateSortRow(idx, 'orderBy', v as 'ASC' | 'DESC')}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASC">ASC</SelectItem>
                    <SelectItem value="DESC">DESC</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="h-7 text-xs" type="number" placeholder="100"
                  value={row.weightValue}
                  onChange={(e) => updateSortRow(idx, 'weightValue', e.target.value)}
                />
                <button className="text-red-400 hover:text-red-600 p-0.5" onClick={() => setSortRows(sortRows.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </section>
        )}

        {/* ── Data / Filter / SubData: 조건 (문장형 + 파라미터 바인딩) ── */}
        {ruleType !== 'Sort' && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-700">조건</Label>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={addCondition}>
                <Plus className="h-3 w-3 mr-0.5" />추가
              </Button>
            </div>

            {conditionColumns.length === 0 && ruleType !== 'Filter' && (
              <p className="text-xs text-gray-400">데이터 대상을 먼저 선택하세요</p>
            )}

            {conditions.map((c, idx) => (
              <div key={idx} className="space-y-1 rounded-md border border-gray-100 bg-gray-50 p-2">
                {/* 1행: 컬럼 + 연산자 */}
                <div className="flex items-center gap-1">
                  <Select value={c.column} onValueChange={(v) => v && updateCondition(idx, 'column', v)}>
                    <SelectTrigger className="flex-1 h-7 text-xs">
                      <SelectValue placeholder="컬럼 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {conditionColumns.map((col) => (
                        <SelectItem key={col.name} value={col.name}>{col.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={c.operator} onValueChange={(v) => v && updateCondition(idx, 'operator', v)}>
                    <SelectTrigger className="w-16 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op} value={op}>{op}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button className="text-red-400 hover:text-red-600 p-0.5" onClick={() => removeCondition(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                {/* 2행: 값 소스 선택 (드롭다운 그룹) */}
                <Select
                  value={`${c.valueType}::${c.value}`}
                  onValueChange={(v) => {
                    if (!v) return;
                    const [type, val] = v.split('::') as [ValueType, string];
                    updateCondition(idx, 'valueType', type);
                    updateCondition(idx, 'value', val ?? '');
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-full">
                    <SelectValue placeholder="값 선택">
                      {c.value ? (
                        <span className={
                          c.valueType === 'eventParam' ? 'text-blue-600' :
                          c.valueType === 'prevResult' ? 'text-purple-600' : ''
                        }>
                          {getValueLabel(c) || '값 선택'}
                        </span>
                      ) : '값 선택'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {/* 직접 입력: select 타입이면 옵션 목록, 아니면 생략 */}
                    {(() => {
                      const meta = getColumnMeta(c.column);
                      if (meta?.type === 'select' && 'options' in meta && meta.options) {
                        return (
                          <SelectGroup>
                            <SelectLabel className="text-xs">직접 선택</SelectLabel>
                            {meta.options.map((opt: string) => (
                              <SelectItem key={opt} value={`direct::${opt}`}>{opt}</SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      }
                      return null;
                    })()}

                    {/* MES 요청 정보 */}
                    {eventParams.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs text-blue-600">MES 요청 정보</SelectLabel>
                        {eventParams.map((p) => (
                          <SelectItem key={p.key} value={`eventParam::${p.key}`}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}

                    {/* 이전 룰 결과 */}
                    {prevRules.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs text-purple-600">이전 룰 결과</SelectLabel>
                        {prevRules.map((r) => (
                          <SelectItem key={r.ruleId} value={`prevResult::${r.ruleId}`}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>

                {/* 직접 입력 (select 타입이 아닐 때) */}
                {c.valueType === 'direct' && getColumnMeta(c.column)?.type !== 'select' && (
                  <Input
                    className="h-7 text-xs"
                    placeholder="직접 입력"
                    value={c.value}
                    onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                  />
                )}

                {/* 선택된 값 레이블 표시 */}
                {c.valueType !== 'direct' && c.value && (
                  <p className={`text-xs px-1 ${c.valueType === 'eventParam' ? 'text-blue-500' : 'text-purple-500'}`}>
                    {c.valueType === 'eventParam' ? '📡 MES 요청 정보' : '🔗 이전 룰 결과'}: {getValueLabel(c)}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {/* ── 결과 미리보기 (Sort 제외) ── */}
        {ruleType !== 'Sort' && (
          <section className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">결과 미리보기</Label>
            {preview ? (
              <>
                <div className="overflow-x-auto rounded border border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        {preview.columns.map((col) => (
                          <th key={col} className="px-2 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          {row.map((cell, j) => (
                            <td key={j} className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400">{preview.rows.length}건 조회됨 (더미)</p>
              </>
            ) : (
              <p className="text-xs text-gray-400">미리보기 데이터 없음</p>
            )}
          </section>
        )}

        {/* ── SQL 개발자용 토글 ── */}
        <section>
          <button
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            onClick={() => setSqlOpen(!sqlOpen)}
          >
            {sqlOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            SQL 보기 (개발자용)
          </button>
          {sqlOpen && (
            <pre className="mt-2 rounded bg-gray-900 p-3 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap">
              {generatedSQL}
            </pre>
          )}
        </section>
      </div>

      {/* 편집 버튼 (Data 계열만 표시) */}
      {(ruleType === 'Data' || ruleType === 'SubData') && (
        <div className="flex flex-col gap-1 px-4 pb-2 border-t border-gray-100 pt-2">
          <p className="text-xs text-gray-400 mb-1">고급 편집</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setQueryModalOpen(true)}>
              쿼리 편집
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setParamModalOpen(true)}>
              파라미터
            </Button>
          </div>
        </div>
      )}
      {ruleType === 'Sort' && (
        <div className="flex flex-col gap-1 px-4 pb-2 border-t border-gray-100 pt-2">
          <p className="text-xs text-gray-400 mb-1">고급 편집</p>
          <Button variant="outline" size="sm" className="text-xs w-full" onClick={() => setSortModalOpen(true)}>
            정렬 조건 편집
          </Button>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="flex justify-between px-4 py-3 border-t border-gray-100">
        <Button
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={onDelete}
        >
          블록 삭제
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={updateRelation.isPending}>취소</Button>
          <Button size="sm" onClick={handleSave} disabled={!relation || updateRelation.isPending}>
            {updateRelation.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

      {/* 편집 모달 */}
      <SortEditorModal
        open={sortModalOpen}
        onClose={() => setSortModalOpen(false)}
        relation={relation}
      />
      <ParamEditorModal
        open={paramModalOpen}
        onClose={() => setParamModalOpen(false)}
        ruleId={relation?.ruleId}
      />
      <QueryBuilderModal
        open={queryModalOpen}
        onClose={() => setQueryModalOpen(false)}
        ruleId={relation?.ruleId}
      />
    </div>
  );
}
