/**
 * 룰 릴레이션 + 룰 정의 → React Flow 노드/엣지 변환
 *
 * 룰 빌더와 시뮬레이터 양쪽에서 동일한 그래프 구조를 재사용하기 위해
 * page.tsx 에 있던 buildGraph 함수를 공용 모듈로 분리함.
 */

import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { RuleRelation, RuleDef } from '@workspace/types/rtd';
import type { SequenceNodeData } from '@/components/rule-builder/sequence-node';

export function buildGraph(
  relations: RuleRelation[],
  ruleDefs: RuleDef[]
): { nodes: Node<SequenceNodeData>[]; edges: Edge[] } {
  const nodes: Node<SequenceNodeData>[] = relations.map((r, idx) => {
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
