'use client';

import { use, useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Save, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SequenceNode } from '@/components/rule-builder/sequence-node';
import { NodeConfigPanel } from '@/components/rule-builder/node-config-panel';
import { buildGraph } from '@/lib/rule-builder/build-graph';
import { useRuleGroup } from '@/lib/api/rule-groups';
import { useRuleRelations, useCreateRuleRelation, useDeleteRuleRelation } from '@/lib/api/rule-relations';
import { useRuleDefs } from '@/lib/api/rule-defs';
import { RULE_TYPES } from '@workspace/types/constants';
import type { RuleRelation } from '@workspace/types/rtd';
import type { RuleDef } from '@workspace/types/rtd';

const nodeTypes = { sequence: SequenceNode };

// 렌더마다 새 배열이 생성되지 않도록 모듈 레벨 상수로 정의
const EMPTY_RELATIONS: RuleRelation[] = [];
const EMPTY_RULE_DEFS: RuleDef[] = [];

export default function RuleBuilderPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);

  /** API 훅 */
  const { data: group, isLoading: groupLoading } = useRuleGroup(groupId);
  const { data: relations = EMPTY_RELATIONS, isLoading: relLoading } = useRuleRelations(groupId);
  const { data: ruleDefs = EMPTY_RULE_DEFS } = useRuleDefs();
  const createRelation = useCreateRuleRelation();
  const deleteRelation = useDeleteRuleRelation();

  /** React Flow 상태 */
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  /** 릴레이션/룰정의 변경 시 그래프 동기화 (refetch 후 자동 반영) */
  const { nodes: computedNodes, edges: computedEdges } = useMemo(
    () => buildGraph(relations, ruleDefs),
    [relations, ruleDefs]
  );
  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [computedNodes, computedEdges, setNodes, setEdges]);

  /** UI 상태 */
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newRuleType, setNewRuleType] = useState<string>('Data'); // 블록 추가 유형
  const [newRuleId, setNewRuleId] = useState<string>('');         // 블록 추가 대상 룰

  /** LLM 프롬프트 패널 상태 */
  const [llmPanelOpen, setLlmPanelOpen] = useState(true);
  const [llmPrompt, setLlmPrompt] = useState('');

  /** 선택된 유형에 맞는 룰 목록 */
  const availableRules = useMemo(
    () => ruleDefs.filter((d) => d.ruleType === newRuleType),
    [ruleDefs, newRuleType]
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  /** 블록 추가 */
  async function addSequenceNode() {
    if (!newRuleId) {
      alert('추가할 룰을 선택하세요.');
      return;
    }
    const maxSeq = relations.length > 0 ? Math.max(...relations.map((r) => r.sequence)) : 0;
    const newSeq = maxSeq + 1;
    const filterSeq = maxSeq > 0 ? maxSeq : null;

    await createRelation.mutateAsync({
      ruleGroupId: groupId,
      ruleId: newRuleId,
      sequence: newSeq,
      isMandatory: 'N',
      filterSequence: filterSeq,
      jumpNextSequence: null,
      jumpNextSequenceCondition: null,
      ruleSortId: null,
    });
    setNewRuleId('');
  }

  /** 블록 삭제 (사이드패널에서 호출) */
  async function deleteSequenceNode(nodeId: string) {
    const rel = relations.find((r) => String(r.sequence) === nodeId);
    if (!rel) return;
    if (!confirm(`시퀀스 #${rel.sequence} (${rel.ruleId}) 블록을 삭제하시겠습니까?`)) return;
    await deleteRelation.mutateAsync({
      ruleGroupId: rel.ruleGroupId,
      ruleId: rel.ruleId,
      sequence: rel.sequence,
    });
    setSelectedNodeId(null);
  }

  /** 로딩 가드 */
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/rule-groups">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">룰 플로우 빌더</h1>
            <p className="text-sm text-gray-500">{group?.ruleGroupName ?? groupId}</p>
          </div>
          <Badge variant="outline">{group?.ruleGroupType ?? ''}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={relations.length === 0}
            onClick={() => alert('각 블록을 선택해 사이드패널에서 저장하세요.')}
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            저장 안내
          </Button>
        </div>
      </div>

      {/* LLM 프롬프트 패널 */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50">
        {/* 패널 헤더 — 클릭으로 접기/펼치기 */}
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-2.5 text-left"
          onClick={() => setLlmPanelOpen((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold text-indigo-700">AI 룰 플로우 자동 생성</span>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-500 border border-indigo-200">
              개발 예정
            </span>
          </div>
          {llmPanelOpen
            ? <ChevronUp className="h-4 w-4 text-indigo-400" />
            : <ChevronDown className="h-4 w-4 text-indigo-400" />
          }
        </button>

        {/* 패널 본문 */}
        {llmPanelOpen && (
          <div className="border-t border-indigo-200 px-4 pb-4 pt-3 space-y-3">
            <p className="text-xs text-indigo-600">
              자연어로 디스패칭 조건을 설명하면 LLM이 룰 플로우 차트를 자동으로 생성합니다.
            </p>
            <div className="flex gap-2">
              <textarea
                className="flex-1 resize-none rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                rows={3}
                placeholder={`예시) "웨이퍼 캐리어가 STK-001에 도착하면 우선순위(Priority) 조건을 확인하고, High이면 Process-A로 바로 반송, 아니면 대기 큐에 삽입한다."`}
                value={llmPrompt}
                onChange={(e) => setLlmPrompt(e.target.value)}
              />
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled
                  title="LLM 연동 개발 예정"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  생성
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 text-xs"
                  onClick={() => setLlmPrompt('')}
                  disabled={!llmPrompt}
                >
                  초기화
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-indigo-400">
              * GPT-4o / Claude 3.5 Sonnet 연동 예정 — 프롬프트 → 룰 시퀀스 자동 파싱 후 플로우 차트로 렌더링
            </p>
          </div>
        )}
      </div>

      {/* 블록 추가 컨트롤 */}
      <div className="flex items-center gap-2">
        <Select
          value={newRuleType}
          onValueChange={(v) => { if (v) { setNewRuleType(v); setNewRuleId(''); } }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(RULE_TYPES).map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={newRuleId} onValueChange={(v) => v && setNewRuleId(v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="룰 선택" />
          </SelectTrigger>
          <SelectContent>
            {availableRules.length === 0 ? (
              <SelectItem value="__none" disabled>해당 유형의 룰 없음</SelectItem>
            ) : (
              availableRules.map((d) => (
                <SelectItem key={d.ruleId} value={d.ruleId}>{d.ruleName}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          disabled={!newRuleId || createRelation.isPending}
          onClick={addSequenceNode}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          블록 추가
        </Button>

        {/* 범례 */}
        <div className="ml-4 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-6 bg-gray-400" /> filterSequence
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-amber-400" /> jumpNext
          </span>
          {selectedNodeId && (
            <span className="ml-2 text-blue-500">노드 #{selectedNodeId} 선택됨 — 우측 패널에서 설정</span>
          )}
        </div>
      </div>

      {/* 캔버스 + 사이드 패널 */}
      <div className="flex flex-1 gap-3" style={{ minHeight: 480 }}>
        {/* React Flow 캔버스 */}
        <div className="flex-1 rounded-lg border border-gray-200 bg-white overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* 노드 설정 사이드 패널 — 노드 선택 시만 표시 */}
        {selectedNodeId && (
          <NodeConfigPanel
            key={selectedNodeId}
            nodeId={selectedNodeId}
            groupId={groupId}
            onClose={() => setSelectedNodeId(null)}
            onDelete={() => deleteSequenceNode(selectedNodeId)}
          />
        )}
      </div>

    </div>
  );
}
