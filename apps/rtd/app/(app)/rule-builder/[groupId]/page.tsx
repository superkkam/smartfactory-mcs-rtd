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
import { LlmPromptPanel } from '@/components/rule-builder/llm-prompt-panel';
import { LlmPreviewModal } from '@/components/rule-builder/llm-preview-modal';
import { buildGraph } from '@/lib/rule-builder/build-graph';
import { useRuleGroup } from '@/lib/api/rule-groups';
import { useRuleRelations, useCreateRuleRelation, useDeleteRuleRelation, useUpdateRuleRelation } from '@/lib/api/rule-relations';
import { useRuleDefs } from '@/lib/api/rule-defs';
import { RULE_TYPES } from '@workspace/types/constants';
import type { RuleRelation } from '@workspace/types/rtd';
import type { RuleDef } from '@workspace/types/rtd';
import type { GeneratedSequence } from '@/lib/llm/rule-schema';

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
  const updateRelation = useUpdateRuleRelation();

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

  /** LLM 미리보기 모달 상태 */
  const [previewSequences, setPreviewSequences] = useState<GeneratedSequence[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  /** 점프 엣지 연결 다이얼로그 상태 */
  const [jumpDialog, setJumpDialog] = useState<{ sourceSeq: number; targetSeq: number } | null>(null);
  const [jumpCondition, setJumpCondition] = useState<'COUNT>0' | 'COUNT=0'>('COUNT>0');

  /** 선택된 유형에 맞는 룰 목록 */
  const availableRules = useMemo(
    () => ruleDefs.filter((d) => d.ruleType === newRuleType),
    [ruleDefs, newRuleType]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      // jump 핸들 연결 → 조건 선택 다이얼로그
      if (connection.sourceHandle === 'jump-out' && connection.targetHandle === 'jump-in') {
        const sourceSeq = parseInt(connection.source ?? '', 10);
        const targetSeq = parseInt(connection.target ?? '', 10);
        if (!isNaN(sourceSeq) && !isNaN(targetSeq) && targetSeq > sourceSeq) {
          setJumpDialog({ sourceSeq, targetSeq });
          setJumpCondition('COUNT>0');
        }
        return;
      }
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  /** 점프 엣지 삭제 시 DB에서 jumpNextSequence 초기화 */
  const onEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        if (edge.id.startsWith('jump-')) {
          const sourceSeq = parseInt(edge.source, 10);
          const rel = relations.find((r) => r.sequence === sourceSeq);
          if (rel) {
            await updateRelation.mutateAsync({ ...rel, jumpNextSequence: null, jumpNextSequenceCondition: null });
          }
        }
      }
    },
    [relations, updateRelation]
  );

  /** 점프 조건 확정 저장 */
  async function handleJumpConfirm() {
    if (!jumpDialog) return;
    const rel = relations.find((r) => r.sequence === jumpDialog.sourceSeq);
    if (rel) {
      await updateRelation.mutateAsync({
        ...rel,
        jumpNextSequence: jumpDialog.targetSeq,
        jumpNextSequenceCondition: jumpCondition,
      });
    }
    setJumpDialog(null);
  }

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

  /** LLM 생성 시퀀스 일괄 적용 */
  async function handleApplyGenerated(sequences: GeneratedSequence[], append: boolean) {
    setPreviewOpen(false);

    // 교체 모드: 기존 시퀀스 전부 삭제
    if (!append && relations.length > 0) {
      await Promise.all(
        relations.map((r) =>
          deleteRelation.mutateAsync({ ruleGroupId: r.ruleGroupId, ruleId: r.ruleId, sequence: r.sequence })
        )
      );
    }

    // 이어붙이기 모드: 기존 마지막 sequence 이후부터 번호 조정
    const offset = append ? Math.max(0, ...relations.map((r) => r.sequence)) : 0;

    for (const s of sequences) {
      await createRelation.mutateAsync({
        ruleGroupId: groupId,
        ruleId: s.ruleId,
        sequence: s.sequence + offset,
        isMandatory: s.isMandatory,
        filterSequence: s.filterSequence ? s.filterSequence + offset : null,
        jumpNextSequence: s.jumpNextSequence ? s.jumpNextSequence + offset : null,
        jumpNextSequenceCondition: s.jumpNextSequenceCondition ?? null,
        ruleSortId: null,
      });
    }
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
      <LlmPromptPanel
        ruleGroupId={groupId}
        onGenerated={(seqs) => { setPreviewSequences(seqs); setPreviewOpen(true); }}
      />

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
            onEdgesDelete={onEdgesDelete}
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

      {/* 점프 조건 설정 다이얼로그 */}
      {jumpDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg p-6 shadow-xl w-80 space-y-4">
            <h3 className="font-semibold text-sm text-gray-800">점프 조건 설정</h3>
            <p className="text-xs text-gray-500">
              #{jumpDialog.sourceSeq} → #{jumpDialog.targetSeq} 점프 발동 조건
            </p>
            <Select
              value={jumpCondition}
              onValueChange={(v) => v && setJumpCondition(v as 'COUNT>0' | 'COUNT=0')}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="COUNT>0">COUNT &gt; 0 — 결과 있을 때 점프</SelectItem>
                <SelectItem value="COUNT=0">COUNT = 0 — 결과 없을 때 점프</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setJumpDialog(null)}>취소</Button>
              <Button size="sm" onClick={handleJumpConfirm} disabled={updateRelation.isPending}>
                {updateRelation.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LLM 생성 결과 미리보기 모달 (fixed overlay) */}
      {previewOpen && (
        <LlmPreviewModal
          sequences={previewSequences}
          ruleDefs={ruleDefs}
          existingCount={relations.length}
          onApply={handleApplyGenerated}
          onCancel={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
