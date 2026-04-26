'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { useRuleRelations, useUpdateRuleRelation } from '@/lib/api/rule-relations';
import { useRuleDefs, useUpdateRuleDef } from '@/lib/api/rule-defs';
import { useRuleObjects } from '@/lib/api/rule-objects';
import { useRuleQuery, useUpsertRuleQuery, useDeleteRuleQuery } from '@/lib/api/rule-queries';
import { RULE_TYPES, MANDATORY_VALUES } from '@workspace/types/constants';
import {
  MCS_TABLES,
  MCS_TABLE_NAMES,
  MCS_COLUMN_LABELS,
  MES_EVENT_PARAMS,
} from '@/lib/rule-engine/mcs-schema-catalog';
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

/**
 * 저장된 SQL을 조건 상태로 파싱 (NodeConfigPanel 이 생성하는 포맷 기준).
 * SELECT * FROM {table}[ JOIN ...] [WHERE\n  col op val\n  AND col op val]
 */
function parseSqlToConditions(sql: string): { tables: string[]; conditions: Condition[] } | null {
  const fromMatch = sql.match(/FROM\s+(mcs_\w+)/i);
  if (!fromMatch) return null;

  const mainTable = fromMatch[1];
  const joinMatches = [...sql.matchAll(/JOIN\s+(mcs_\w+)/gi)].map((m) => m[1]);
  const tables = [mainTable, ...joinMatches];

  const conditions: Condition[] = [];
  const whereMatch = sql.match(/WHERE\s*\n([\s\S]+)$/i);
  if (whereMatch) {
    const clauses = whereMatch[1].split(/\n\s*AND\s+/i);
    for (const clause of clauses) {
      const trimmed = clause.trim().replace(/^\s*AND\s+/i, '');
      // IS NULL / IS NOT NULL
      const nullMatch = trimmed.match(/^(\w+)\s+(IS NULL|IS NOT NULL)$/i);
      if (nullMatch) {
        conditions.push({ column: nullMatch[1], operator: nullMatch[2].toUpperCase(), valueType: 'direct', value: '' });
        continue;
      }
      // col op value
      const opMatch = trimmed.match(/^(\w+)\s+(=|!=|>=|<=|>|<|LIKE|IN)\s+(.+)$/i);
      if (opMatch) {
        const [, column, operator, rawVal] = opMatch;
        const trimmedVal = rawVal.trim();
        if (trimmedVal.startsWith(':')) {
          conditions.push({ column, operator, valueType: 'eventParam', value: trimmedVal.slice(1) });
        } else {
          const value = trimmedVal.replace(/^'(.*)'$/, '$1');
          conditions.push({ column, operator, valueType: 'direct', value });
        }
      }
    }
  }

  return { tables, conditions };
}

/** 노드 설정 사이드 패널 — 룰 유형별 분기 + 파라미터 바인딩 */
export function NodeConfigPanel({ nodeId, groupId, onClose, onDelete }: NodeConfigPanelProps) {
  // 실데이터 조회 (React Query 캐시 공유 — 네트워크 중복 없음)
  const { data: relations = [] } = useRuleRelations(groupId);
  const { data: ruleDefs = [] } = useRuleDefs();
  const { data: ruleObjects = [] } = useRuleObjects(groupId);
  const updateRelation = useUpdateRuleRelation();
  const updateRuleDef = useUpdateRuleDef();
  const upsertQuery = useUpsertRuleQuery();
  const deleteQuery = useDeleteRuleQuery();

  const relation = relations.find((r) => String(r.sequence) === nodeId);
  const ruleDef = ruleDefs.find((d) => d.ruleId === relation?.ruleId);

  // 저장된 쿼리 조회 (rule_query 테이블)
  const { data: savedQuery } = useRuleQuery(relation?.ruleId);

  const [ruleName, setRuleName] = useState(ruleDef?.ruleName ?? '');
  const [ruleType, setRuleType] = useState(ruleDef?.ruleType ?? 'Data');
  const [mandatory, setMandatory] = useState<string>(relation?.isMandatory ?? 'N');
  const [jumpTarget, setJumpTarget] = useState<string>(
    relation?.jumpNextSequence != null ? String(relation.jumpNextSequence) : 'none'
  );
  const [jumpCond, setJumpCond] = useState<string>(
    relation?.jumpNextSequenceCondition ?? 'COUNT>0'
  );

  // 테이블 선택 (Data / SubData)
  const [selectedTables, setSelectedTables] = useState<string[]>(['mcs_carrier']);

  // 조건 행 (Data / Filter / SubData)
  const [conditions, setConditions] = useState<Condition[]>([
    { column: '', operator: '=', valueType: 'direct', value: '' },
  ]);

  // 정렬 행 (Sort)
  const [sortRows, setSortRows] = useState<SortRow[]>([
    { sortColumn: 'PRIORITY', orderBy: 'DESC', weightValue: '100' },
  ]);

  // 저장된 SQL이 있으면 조건 상태로 복원
  useEffect(() => {
    if (!savedQuery?.ruleQueryString) return;
    const parsed = parseSqlToConditions(savedQuery.ruleQueryString);
    if (!parsed) return;
    if (parsed.tables.length > 0) setSelectedTables(parsed.tables);
    if (parsed.conditions.length > 0) setConditions(parsed.conditions);
  }, [savedQuery]);

  // SQL 펼치기 여부
  const [sqlOpen, setSqlOpen] = useState(false);

  // 편집 모달 상태
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [paramModalOpen, setParamModalOpen] = useState(false);
  const [queryModalOpen, setQueryModalOpen] = useState(false);

  // 현재 룰 그룹에 연결된 이벤트 파라미터 조회 (MES 파라미터 바인딩 힌트)
  const eventParams = useMemo(() => {
    // ruleObjects 가 있으면 MES 파라미터 힌트 제공
    const hasBinding = ruleObjects.some((o) => o.ruleGroupId === groupId);
    if (!hasBinding) return [];
    return MES_EVENT_PARAMS.map((p) => ({ key: p.replace(':', ''), label: p }));
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

  // 선택된 mcs_* 테이블들의 컬럼 목록
  const availableColumns = useMemo(() => {
    return selectedTables.flatMap((tableName) =>
      (MCS_TABLES[tableName] ?? []).map((col) => ({
        name: col,
        label: MCS_COLUMN_LABELS[tableName]?.[col] ?? col,
        type: 'string' as const,
      }))
    );
  }, [selectedTables]);

  // Filter일 때는 mcs_carrier 공통 컬럼 제공 (이전 시퀀스 결과는 carrier 기반)
  const filterColumns = useMemo(() => {
    if (ruleType !== 'Filter') return [];
    return (MCS_TABLES['mcs_carrier'] ?? []).map((col) => ({
      name: col,
      label: MCS_COLUMN_LABELS['mcs_carrier']?.[col] ?? col,
      type: 'string' as const,
    }));
  }, [ruleType]);

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

  // SQL 미리보기 생성 (쿼리 빌더에서 저장된 SQL 이 우선 — 이건 시각 참고용)
  const generatedSQL = useMemo(() => {
    if (ruleType === 'Sort') {
      const orderBy = sortRows.map((r) => `${r.sortColumn} ${r.orderBy}`).join(', ');
      return `-- 이전 룰 결과에 정렬 적용\nORDER BY ${orderBy || 'priority ASC'}`;
    }
    if (ruleType === 'Filter') {
      // Filter 타입: 이전 시퀀스 결과(carrier_id 집합)를 엔진이 IN 절로 자동 주입.
      // 이 SQL 자체는 mcs_carrier 기반 SELECT 로 작성하면 되고,
      // 엔진이 filterSequence 체인에서 "WHERE carrier_id IN (...)" 를 감싼다.
      const where = conditions
        .filter((c) => c.column)
        .map((c) => {
          const val =
            c.valueType === 'eventParam' ? `:${c.value}` :
            c.valueType === 'prevResult' ? `-- @${c.value}` :
            `'${c.value}'`;
          return `  ${c.column} ${c.operator} ${val}`;
        })
        .join('\n  AND ');
      return `SELECT *\nFROM mcs_carrier${where ? `\nWHERE\n${where}` : ''}`;
    }
    const mainTable = selectedTables[0] ?? 'mcs_carrier';
    const joins = selectedTables.slice(1).map((tbl) =>
      `JOIN ${tbl} USING (carrier_id)`
    );
    const where = conditions
      .filter((c) => c.column)
      .map((c) => {
        const val =
          c.valueType === 'eventParam' ? `:${c.value}` :
          c.valueType === 'prevResult' ? `-- @${c.value}` :
          `'${c.value}'`;
        return `  ${c.column} ${c.operator} ${val}`;
      })
      .join('\n  AND ');
    const fromPart = [`FROM ${mainTable}`, ...joins].join('\n');
    return `SELECT *\n${fromPart}${where ? `\nWHERE\n${where}` : ''}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleType, selectedTables, conditions, sortRows]);

  async function handleSave() {
    if (!relation) return;

    // 1. 이름 변경 시 rule_def 갱신
    if (ruleName && ruleName !== ruleDef?.ruleName) {
      await updateRuleDef.mutateAsync({ ruleId: relation.ruleId, ruleName });
    }

    // 2. rule_relation 갱신 (isMandatory + jumpNextSequence)
    await updateRelation.mutateAsync({
      ...relation,
      isMandatory: mandatory,
      jumpNextSequence: jumpTarget !== 'none' ? parseInt(jumpTarget, 10) : null,
      jumpNextSequenceCondition: jumpTarget !== 'none' ? jumpCond : null,
    });

    // 2. 쿼리 저장/삭제 판단
    //    - Data/SubData: 테이블이 1개 이상 선택되면 조건 없어도 SELECT * FROM 을 저장
    //      (조건 없는 Data 는 "전체 조회" 가 정상 동작)
    //    - Filter: 조건이 있어야만 의미 있음. 엔진이 carrier_id IN (prev) 자동 주입.
    //    - Sort: 현재 스코프에서는 rule_query 로 저장하지 않음 (rule_sort 별도 경로)
    const hasConditions = conditions.some((c) => c.column);
    let shouldSave = false;
    if (ruleType === 'Data' || ruleType === 'SubData') {
      shouldSave = selectedTables.length > 0; // 테이블만 선택돼도 저장
    } else if (ruleType === 'Filter') {
      shouldSave = hasConditions;
    }

    if (shouldSave && relation.ruleId) {
      await upsertQuery.mutateAsync({ ruleId: relation.ruleId, sql: generatedSQL });
    } else if (!shouldSave && savedQuery?.ruleQueryString && relation.ruleId) {
      // 저장할 대상이 없는데 DB에 기존 SQL 이 있음 → 삭제
      await deleteQuery.mutateAsync(relation.ruleId);
    }

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

        {/* ── 조건부 점프 설정 ── */}
        <section className="space-y-2">
          <Label className="text-xs font-semibold text-gray-700">조건부 점프 (jumpNextSequence)</Label>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-gray-500">점프 목적지</Label>
              <Select value={jumpTarget} onValueChange={(v) => v && setJumpTarget(v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음</SelectItem>
                  {relations
                    .filter((r) => r.sequence > (relation?.sequence ?? 0))
                    .map((r) => (
                      <SelectItem key={r.sequence} value={String(r.sequence)}>
                        #{r.sequence} ({r.ruleId})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {jumpTarget !== 'none' && (
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-gray-500">발동 조건</Label>
                <Select value={jumpCond} onValueChange={(v) => v && setJumpCond(v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COUNT>0">COUNT &gt; 0</SelectItem>
                    <SelectItem value="COUNT=0">COUNT = 0</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {jumpTarget !== 'none' && (
            <p className="text-xs text-amber-600">
              결과가 <strong>{jumpCond}</strong>일 때 #{jumpTarget}로 건너뜁니다
            </p>
          )}
        </section>

        {/* ── Data / SubData: 데이터 대상 테이블 선택 (실제 mcs_* 테이블) ── */}
        {(ruleType === 'Data' || ruleType === 'SubData') && (
          <section className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">데이터 대상 (MCS 테이블)</Label>
            <p className="text-xs text-gray-400">복수 선택 시 carrier_id 기준 JOIN</p>
            <div className="space-y-1.5">
              {MCS_TABLE_NAMES.map((tName) => (
                <div key={tName} className="flex items-center gap-2">
                  <Checkbox
                    id={`table-${tName}`}
                    checked={selectedTables.includes(tName)}
                    onCheckedChange={() => toggleTable(tName)}
                  />
                  <label htmlFor={`table-${tName}`} className="text-sm font-mono cursor-pointer select-none">
                    {tName}
                  </label>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Filter: 이전 룰 결과 기반 안내 문구 ── */}
        {ruleType === 'Filter' && (
          <section className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 space-y-1">
            <p>이전 룰(#{relation?.filterSequence})의 carrier_id 집합을 엔진이 자동으로 IN 절로 주입합니다.</p>
            <p className="text-blue-500">아래 조건은 <strong>mcs_carrier</strong> 기준 추가 필터입니다.</p>
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
                    {/* lot_state 컬럼이면 빠른 선택 목록 제공 */}
                    {c.column === 'lot_state' && (
                      <SelectGroup>
                        <SelectLabel className="text-xs">직접 선택</SelectLabel>
                        {['WAIT', 'PROCESSING', 'DONE', 'HOLD'].map((opt) => (
                          <SelectItem key={opt} value={`direct::${opt}`}>{opt}</SelectItem>
                        ))}
                      </SelectGroup>
                    )}

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

                {/* 직접 입력 (lot_state 드롭다운 선택이 아닐 때) */}
                {c.valueType === 'direct' && c.column !== 'lot_state' && (
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

        {/* ── 미리보기 안내 — 실제 실행 결과는 시뮬레이터에서 확인 ── */}
        {ruleType !== 'Sort' && (
          <section className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            실제 실행 결과는 <strong>시뮬레이터</strong> 탭에서 확인하세요.
            이 패널의 SQL은 참고용이며, 저장은 아래 &quot;쿼리 편집&quot; 버튼을 사용하세요.
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
          <Button variant="outline" size="sm" onClick={onClose} disabled={updateRelation.isPending || updateRuleDef.isPending || upsertQuery.isPending || deleteQuery.isPending}>취소</Button>
          <Button size="sm" onClick={handleSave} disabled={!relation || updateRelation.isPending || updateRuleDef.isPending || upsertQuery.isPending || deleteQuery.isPending}>
            {(updateRelation.isPending || updateRuleDef.isPending || upsertQuery.isPending || deleteQuery.isPending) ? '저장 중...' : '저장'}
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
