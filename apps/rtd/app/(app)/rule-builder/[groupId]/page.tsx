'use client';

import { use, useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Save } from 'lucide-react';
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
  MarkerType,
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

/** 릴레이션 + 룰 정의 → React Flow 노드/엣지 변환 */
function buildGraph(
  relations: RuleRelation[],
  ruleDefs: RuleDef[]
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = relations.map((r, idx) => {
    const ruleDef = ruleDefs.find((d) => d.ruleId === r.ruleId);
    return {
      id: `${r.sequence}`,
      type: 'sequence',
      position: { x: 240, y: idx * 160 + 40 },
      data: {
        sequence: r.sequence,
        ruleId: r.ruleId,
        ruleName: ruleDef?.ruleName ?? r.ruleId,
        ruleType: ruleDef?.ruleType ?? 'Data',
        isMandatory: r.isMandatory,
      },
    };
  });

  const edges: Edge[] = [];
  relations.forEach((r) => {
    // filterSequence 화살표: 상→하 실선 (일반 흐름)
    if (r.filterSequence) {
      edges.push({
        id: `filter-${r.filterSequence}-${r.sequence}`,
        source: `${r.filterSequence}`,
        sourceHandle: 'bottom',
        target: `${r.sequence}`,
        targetHandle: 'top',
        style: { stroke: '#6b7280' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
      });
    }
    // jumpNextSequence: 우→좌 주황 점선 (조건 점프)
    if (r.jumpNextSequence) {
      edges.push({
        id: `jump-${r.sequence}-${r.jumpNextSequence}`,
        source: `${r.sequence}`,
        sourceHandle: 'jump-out',
        target: `${r.jumpNextSequence}`,
        targetHandle: 'jump-in',
        type: 'smoothstep',
        label: `점프: ${r.jumpNextSequenceCondition ?? ''}`,
        labelStyle: { fontSize: 10, fill: '#f59e0b', fontWeight: 600 },
        labelBgStyle: { fill: '#fffbeb', fillOpacity: 0.9 },
        style: { strokeDasharray: '5,5', stroke: '#f59e0b', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
      });
    }
  });

  return { nodes, edges };
}

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
