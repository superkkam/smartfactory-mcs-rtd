'use client';

import { use, useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Play, CheckCircle, AlertCircle, AlertTriangle,
  ChevronDown, ChevronRight, Eye,
} from 'lucide-react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SequenceNode } from '@/components/rule-builder/sequence-node';
import type { SequenceNodeData } from '@/components/rule-builder/sequence-node';
import { buildGraph } from '@/lib/rule-builder/build-graph';
import { useRuleGroup, useUpdateRuleGroup } from '@/lib/api/rule-groups';
import { useRuleRelations } from '@/lib/api/rule-relations';
import { useRuleDefs } from '@/lib/api/rule-defs';
import type {
  SimulationResponse,
  SimulationSequenceResult,
  ValidationIssue,
} from '@workspace/types/rtd';
import type { RuleRelation, RuleDef } from '@workspace/types/rtd';

// nodeTypes 는 모듈 레벨 상수로 선언 — React Flow 재생성 경고 방지
const nodeTypes = { sequence: SequenceNode };

const EMPTY_RELATIONS: RuleRelation[] = [];
const EMPTY_RULE_DEFS: RuleDef[] = [];

const PAGE_SIZE = 10;

export default function SimulatorPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);
  const { data: group, isLoading: groupLoading } = useRuleGroup(groupId);
  const { data: relations = EMPTY_RELATIONS, isLoading: relLoading } = useRuleRelations(groupId);
  const { data: ruleDefs = EMPTY_RULE_DEFS } = useRuleDefs();
  const updateGroup = useUpdateRuleGroup();

  const [equipId, setEquipId] = useState('STK01');
  const [eventType, setEventType] = useState('EVT_FULL');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SimulationSequenceResult[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [valid, setValid] = useState(true);
  const [totalDuration, setTotalDuration] = useState(0);
  const [error, setError] = useState('');
  const [rawResponse, setRawResponse] = useState<string>('');
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);

  // ── React Flow 상태 ───────────────────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 릴레이션/룰정의로 기본 그래프 생성 (시뮬레이션 결과 반영 전)
  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => buildGraph(relations, ruleDefs),
    [relations, ruleDefs]
  );

  // 기본 그래프 → nodes/edges 동기화
  useEffect(() => {
    setNodes(baseNodes);
    setEdges(baseEdges);
  }, [baseNodes, baseEdges, setNodes, setEdges]);

  // 시뮬레이션 결과 → 각 노드 data 에 simState 주입
  const hasRun = results.length > 0 || validationIssues.length > 0 || totalDuration > 0;

  useEffect(() => {
    if (!hasRun) {
      // 시뮬레이션 초기화 시 simState 제거
      setNodes((ns) =>
        ns.map((n) => ({
          ...n,
          data: { ...n.data, simState: undefined } as SequenceNodeData,
        }))
      );
      return;
    }

    const resultMap = new Map<number, SimulationSequenceResult>(
      results.map((r) => [r.sequence, r])
    );

    setNodes((ns) =>
      ns.map((n) => {
        const seq = parseInt(n.id, 10);
        const res = resultMap.get(seq);
        const relation = relations.find((r) => r.sequence === seq);
        const isMandatory = relation?.isMandatory === 'Y';

        const simState = res
          ? {
              count:    res.count,
              duration: res.duration,
              executed: true,
              failed:   isMandatory && res.count === 0,
              selected: selectedSeq === seq,
            }
          : {
              count:    null,
              duration: 0,
              executed: false, // 건너뛴 시퀀스 (results 에 없음)
              failed:   false,
              selected: false,
            };

        return {
          ...n,
          data: { ...n.data, simState } as SequenceNodeData,
        };
      })
    );
  }, [hasRun, results, selectedSeq, relations, setNodes]);

  // ── API 호출 ─────────────────────────────────────────────────────

  async function handleRun() {
    if (!equipId || !eventType) {
      setError('장비 ID와 이벤트 유형을 입력하세요.');
      return;
    }
    setError('');
    setRawResponse('');
    setRunning(true);
    setResults([]);
    setValidationIssues([]);
    setSelectedSeq(null);

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleGroupId: groupId, equipId, eventType }),
      });

      const text = await res.text();
      setRawResponse(text);

      if (!res.ok) {
        let errMsg = `서버 오류 (${res.status})`;
        try { errMsg = (JSON.parse(text) as { error?: string }).error ?? errMsg; } catch { /* noop */ }
        throw new Error(errMsg);
      }

      const data: SimulationResponse = JSON.parse(text);
      setResults(data.results);
      setValidationIssues(data.validationIssues);
      setValid(data.valid);
      setTotalDuration(data.totalDuration);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setRunning(false);
    }
  }

  async function handleActivate() {
    if (!group) return;
    await updateGroup.mutateAsync({ ruleGroupId: groupId, isUsable: 'Y' });
    alert('룰 그룹이 활성화되었습니다.');
  }

  // ── 파생 값 ─────────────────────────────────────────────────────

  const errorIssues   = validationIssues.filter((i) => i.severity === 'error');
  const warningIssues = validationIssues.filter((i) => i.severity === 'warning');

  const selectedResult = results.find((r) => r.sequence === selectedSeq) ?? null;

  // ── 로딩 가드 ─────────────────────────────────────────────────────

  if (groupLoading || relLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/rule-groups">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">룰 시뮬레이터</h1>
          <p className="text-sm text-gray-500">{group?.ruleGroupName ?? groupId}</p>
        </div>
        <Badge variant="outline">dry-run</Badge>
      </div>

      {/* 메인 레이아웃 */}
      <div className="flex flex-1 gap-4" style={{ minHeight: 0 }}>
        {/* ── 왼쪽: 입력 패널 ── */}
        <div className="w-64 shrink-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">테스트 입력값</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>룰 그룹</Label>
                <Input value={group?.ruleGroupName ?? groupId} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>장비 ID</Label>
                <Input
                  value={equipId}
                  onChange={(e) => setEquipId(e.target.value)}
                  placeholder="STK01"
                />
              </div>
              <div className="space-y-1.5">
                <Label>이벤트 유형</Label>
                <Input
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  placeholder="EVT_FULL"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <Button className="w-full" onClick={handleRun} disabled={running}>
                <Play className="h-4 w-4 mr-1" />
                {running ? '실행 중...' : '시뮬레이션 실행'}
              </Button>

              <p className="text-xs text-gray-400 text-center">
                실제 DB 기반 · 디스패칭 미수행
              </p>

              {hasRun && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={!valid || updateGroup.isPending}
                  onClick={handleActivate}
                >
                  {updateGroup.isPending ? '적용 중...' : '룰 활성화'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 범례 */}
          {hasRun && (
            <Card>
              <CardContent className="p-4 space-y-1.5 text-xs text-gray-500">
                <p className="font-medium text-gray-700 mb-2">범례</p>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-400" />
                  결과 있음
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-red-400" />
                  필수 룰 실패 (0건)
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-gray-300" />
                  결과 없음
                </div>
                <div className="flex items-center gap-2 opacity-50">
                  <span className="inline-block w-3 h-3 rounded-full border border-dashed border-gray-400" />
                  건너뜀 (jump)
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── 오른쪽: 플로우차트 + 결과 ── */}
        <div className="flex flex-1 flex-col gap-3 min-h-0">
          {/* 유효성 배너 */}
          {hasRun && (
            <div className={`flex items-center gap-2 rounded-md border px-4 py-2.5 shrink-0 ${
              !valid
                ? 'border-red-200 bg-red-50 text-red-700'
                : warningIssues.length > 0
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-green-200 bg-green-50 text-green-700'
            }`}>
              {!valid ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : warningIssues.length > 0 ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle className="h-4 w-4 shrink-0" />
              )}
              <p className="text-sm font-medium">
                {!valid
                  ? `유효성 오류 ${errorIssues.length}건`
                  : warningIssues.length > 0
                    ? `경고 ${warningIssues.length}건 (실행 가능)`
                    : '유효성 검사 통과 — 노드를 클릭하면 결과를 확인할 수 있습니다'}
              </p>
              <span className="ml-auto text-xs opacity-70">{totalDuration}ms</span>
            </div>
          )}

          {/* 유효성 이슈 목록 */}
          {hasRun && validationIssues.length > 0 && (
            <div className="space-y-1 shrink-0">
              {validationIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 rounded px-3 py-1.5 text-xs ${
                    issue.severity === 'error'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {issue.severity === 'error'
                    ? <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    : <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  }
                  {issue.message}
                </div>
              ))}
            </div>
          )}

          {/* ── React Flow 캔버스 ── */}
          <div className="flex-1 rounded-lg border border-gray-200 bg-white overflow-hidden" style={{ minHeight: 320 }}>
            {relations.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                룰 시퀀스가 없습니다. 룰 플로우 빌더에서 시퀀스를 추가하세요.
              </div>
            ) : (
              <ReactFlow
                key={relations.length > 0 ? 'ready' : 'empty'}
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => {
                  const seq = parseInt(node.id, 10);
                  setSelectedSeq((prev) => prev === seq ? null : seq);
                }}
                onPaneClick={() => setSelectedSeq(null)}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                edgesReconnectable={false}
                nodesConnectable={false}
                elementsSelectable
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background />
                <Controls showInteractive={false} />
                <MiniMap />
              </ReactFlow>
            )}
          </div>

          {/* ── 선택된 노드 결과 패널 ── */}
          {selectedResult && (
            <div className="shrink-0">
              <RowsPreview
                sequence={selectedResult.sequence}
                ruleName={selectedResult.ruleName}
                rows={selectedResult.rows ?? []}
                queryPreview={selectedResult.queryPreview}
                count={selectedResult.count}
              />
            </div>
          )}

          {/* ── 진단 패널 ── */}
          {hasRun && (
            <div className="rounded-md border border-gray-100 shrink-0">
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50"
                onClick={() => setDiagOpen((v) => !v)}
              >
                {diagOpen
                  ? <ChevronDown className="h-3 w-3" />
                  : <ChevronRight className="h-3 w-3" />
                }
                원시 응답 보기 (진단용)
              </button>
              {diagOpen && (
                <pre className="max-h-48 overflow-auto rounded-b-md bg-gray-900 p-3 text-xs text-green-400 whitespace-pre-wrap">
                  {rawResponse
                    ? JSON.stringify(JSON.parse(rawResponse), null, 2)
                    : '응답 없음'}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 결과 rows 미리보기 컴포넌트 (페이지네이션 포함) ─────────────────

function RowsPreview({
  sequence,
  ruleName,
  rows,
  queryPreview,
  count,
}: {
  sequence: number;
  ruleName: string;
  rows: Record<string, unknown>[];
  queryPreview?: string;
  count: number | null;
}) {
  const [page, setPage] = useState(0);
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // 시퀀스 변경 시 페이지 리셋
  useEffect(() => { setPage(0); }, [sequence]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span className="text-gray-400 font-normal">#{sequence}</span>
          {ruleName}
          {count !== null && (
            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
              count > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {count}건
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {/* SQL 미리보기 */}
        {queryPreview && (
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <code className="text-xs text-blue-600 font-mono truncate">{queryPreview}</code>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">
            {count === null ? '이 시퀀스에 쿼리가 없습니다' : '조회된 데이터가 없습니다 (0건)'}
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-blue-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-blue-50 text-blue-800">
                  {columns.map((col, colIdx) => (
                    <th key={colIdx} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => (
                  <tr key={page * PAGE_SIZE + idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className="px-3 py-1.5 text-gray-700 font-mono whitespace-nowrap max-w-[200px] truncate">
                        {row[col] === null ? (
                          <span className="text-gray-300 italic">null</span>
                        ) : typeof row[col] === 'boolean' ? (
                          <span className={row[col] ? 'text-green-600' : 'text-red-500'}>
                            {String(row[col])}
                          </span>
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 페이지네이션 */}
            <div className="flex items-center justify-between border-t border-blue-100 px-3 py-1.5">
              <span className="text-xs text-gray-400">
                총 {rows.length}건
                {rows.length >= 100 && <span className="text-amber-500"> (100건 제한)</span>}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    className="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100 disabled:opacity-40"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ‹ 이전
                  </button>
                  <span className="text-xs text-gray-500">{page + 1} / {totalPages}</span>
                  <button
                    className="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100 disabled:opacity-40"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    다음 ›
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
