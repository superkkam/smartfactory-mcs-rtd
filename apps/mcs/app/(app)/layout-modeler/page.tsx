'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { toast } from 'sonner';
import { SymbolPalette }         from '@/components/layout-modeler/symbol-palette';
import { LayoutModelerCanvas }   from '@/components/layout-modeler/layout-modeler-canvas';
import type { SaveResult }       from '@/components/layout-modeler/layout-modeler-canvas';
import { PropertiesPanel }       from '@/components/layout-modeler/properties-panel';
import { Toolbar }               from '@/components/layout-modeler/toolbar';
import type { ModelerNode, TransferEdge, TransferEdgeData } from '@/components/layout-modeler/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input }  from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLayouts, useCreateLayout, useUpdateLayout } from '@/lib/api/layouts';
import { syncLayoutToDb } from '@/lib/api/sync-layout-to-db';

export default function LayoutModelerPage() {
  /* 선택 상태 */
  const [selectedNode, setSelectedNode] = useState<ModelerNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<TransferEdge | null>(null);

  /* 릴레이션 표시 여부 */
  const [relationsVisible, setRelationsVisible] = useState(true);

  /* 노드/엣지 수 (통계 표시용) */
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);

  /* 저장 함수 (캔버스에서 등록) */
  const saveRef = useRef<(() => SaveResult) | null>(null);

  /* 엣지 업데이트 함수 (캔버스에서 등록, 속성 패널 연동) */
  const edgeUpdateRef = useRef<((edgeId: string, data: Partial<TransferEdgeData>) => void) | null>(null);

  /* 노드 업데이트 함수 (캔버스에서 등록, 속성 패널 연동) */
  const nodeUpdateRef = useRef<((nodeId: string, data: Record<string, unknown>) => void) | null>(null);

  /* 현재 편집 중인 레이아웃 id (null = 신규) */
  const [currentLayoutId, setCurrentLayoutId] = useState<string | null>(null);

  /* 버전 선택 시 로드할 노드/엣지 (캔버스에 prop으로 전달) */
  const [loadedNodes, setLoadedNodes] = useState<Node[] | undefined>(undefined);
  const [loadedEdges, setLoadedEdges] = useState<Edge[] | undefined>(undefined);

  /* 새 레이아웃 이름 입력 Dialog */
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [pendingDesignName, setPendingDesignName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  /* 저장 대기 중인 데이터 (Dialog 확인 후 실제 저장) */
  const pendingSaveDataRef = useRef<SaveResult | null>(null);

  /* API 훅 */
  const { data: layouts = [], isLoading: isLoadingLayouts } = useLayouts();
  const createLayout = useCreateLayout();
  const updateLayout = useUpdateLayout();

  /* 레이아웃 목록 로드 완료 시 가장 최근 레이아웃 자동 선택 */
  useEffect(() => {
    if (!isLoadingLayouts && layouts.length > 0 && currentLayoutId === null && loadedNodes === undefined) {
      // created_at DESC 정렬이므로 첫 번째가 최신
      handleVersionChange(layouts[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingLayouts, layouts.length]);

  const handleDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('nodeType', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleNodesChange = useCallback((nodes: Node[]) => {
    setNodeCount(nodes.length);
  }, []);

  const handleEdgesChange = useCallback((edges: Edge[]) => {
    setEdgeCount(edges.length);
  }, []);

  /* 속성 패널에서 엣지 편집 시: 캔버스 setEdges 업데이트 + 선택 엣지 상태 동기화 */
  const handleEdgeUpdate = useCallback(
    (edgeId: string, data: Partial<TransferEdgeData>) => {
      edgeUpdateRef.current?.(edgeId, data);
      setSelectedEdge((prev) =>
        prev && prev.id === edgeId
          ? { ...prev, data: { ...(prev.data ?? {}), ...data } as TransferEdgeData }
          : prev
      );
    },
    [],
  );

  /* 속성 패널에서 노드 편집 시: 캔버스 setNodes 업데이트 + 선택 노드 상태 동기화 */
  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      nodeUpdateRef.current?.(nodeId, data);
      // selectedNode 도 함께 갱신 — 패널 입력값이 stale 데이터로 리셋되는 현상 방지
      setSelectedNode((prev) =>
        prev && prev.id === nodeId
          ? { ...prev, data: { ...(prev.data as Record<string, unknown>), ...data } } as ModelerNode
          : prev,
      );
    },
    [],
  );

  /* 실제 저장 실행 (designName 확정 후 호출) */
  const executeSave = useCallback(async (designName: string, saveData: SaveResult) => {
    const { nodes, edges, viewport } = saveData;
    const jsonData = { nodes, edges, viewport } as Record<string, unknown>;

    setIsSaving(true);
    try {
      let layoutId = currentLayoutId;

      if (layoutId === null) {
        // 신규 레이아웃 생성
        const created = await createLayout.mutateAsync({
          designId:   `LAYOUT-${Date.now()}`,
          designName,
          version:    1,
          jsonData,
          siteId:     'SITE-001',
        });
        layoutId = created.id;
        setCurrentLayoutId(created.id);
      } else {
        // 기존 레이아웃 업데이트
        const existing = layouts.find((l) => l.id === layoutId);
        await updateLayout.mutateAsync({
          id:      layoutId,
          jsonData,
          version: (existing?.version ?? 1) + 1,
        });
      }

      // 구조화 테이블 동기화 (경로 탐색 엔진용)
      const { droppedEdgeCount, orphanPortCount } = await syncLayoutToDb(layoutId, nodes, edges);

      if (droppedEdgeCount > 0 || orphanPortCount > 0) {
        toast.warning(
          `레이아웃이 저장되었습니다. ` +
          `(orphan 포트 ${orphanPortCount}개, 매핑 누락 경로 ${droppedEdgeCount}개는 경로 탐색 DB에서 제외됨)`,
        );
      } else {
        toast.success('레이아웃이 저장되었습니다.');
      }
    } catch (err) {
      console.error('[레이아웃 저장 오류]', err);
      toast.error('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  }, [currentLayoutId, layouts, createLayout, updateLayout]);

  const handleSave = useCallback(() => {
    const saveData = saveRef.current?.();
    if (!saveData) return;

    if (currentLayoutId === null) {
      // 신규: 이름 입력 Dialog 표시
      pendingSaveDataRef.current = saveData;
      setPendingDesignName('');
      setNameDialogOpen(true);
    } else {
      // 기존: 바로 저장
      void executeSave(
        layouts.find((l) => l.id === currentLayoutId)?.designName ?? '레이아웃',
        saveData,
      );
    }
  }, [currentLayoutId, layouts, executeSave]);

  /* 새 레이아웃 이름 Dialog 확인 */
  const handleNameConfirm = useCallback(() => {
    const name = pendingDesignName.trim();
    if (!name) return;
    const saveData = pendingSaveDataRef.current;
    if (!saveData) return;
    setNameDialogOpen(false);
    void executeSave(name, saveData);
  }, [pendingDesignName, executeSave]);

  /* 버전(레이아웃) 선택 */
  const handleVersionChange = useCallback((layoutId: string) => {
    if (layoutId === '__new__') {
      setCurrentLayoutId(null);
      setLoadedNodes([]);
      setLoadedEdges([]);
      return;
    }

    const layout = layouts.find((l) => l.id === layoutId);
    if (!layout) return;

    const json = layout.jsonData as { nodes?: Node[]; edges?: Edge[] } | null;
    setCurrentLayoutId(layoutId);
    setLoadedNodes((json?.nodes ?? []) as Node[]);
    setLoadedEdges((json?.edges ?? []) as Edge[]);
  }, [layouts]);

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div>
          <h1 className="text-base font-semibold text-gray-900">레이아웃 모델러</h1>
          <p className="text-[11px] text-gray-400">AMR 기반 반송 경로 설계</p>
        </div>
      </div>

      {/* 메인 영역 */}
      <div className="flex min-h-0 flex-1">
        {/* 심볼 팔레트 */}
        <SymbolPalette onDragStart={handleDragStart} />

        {/* React Flow 캔버스 */}
        <LayoutModelerCanvas
          onNodeSelect={setSelectedNode}
          onEdgeSelect={setSelectedEdge}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          relationsVisible={relationsVisible}
          onUndo={() => {}}
          onRedo={() => {}}
          setExternalSave={(fn) => { saveRef.current = fn; }}
          setExternalEdgeUpdate={(fn) => { edgeUpdateRef.current = fn; }}
          setExternalNodeUpdate={(fn) => { nodeUpdateRef.current = fn; }}
          initialNodes={loadedNodes}
          initialEdges={loadedEdges}
        />

        {/* 속성 패널 */}
        <PropertiesPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onEdgeUpdate={handleEdgeUpdate}
          onNodeUpdate={handleNodeUpdate}
        />
      </div>

      {/* 하단 툴바 */}
      <Toolbar
        relationsVisible={relationsVisible}
        onToggleRelations={() => setRelationsVisible((v) => !v)}
        onSave={handleSave}
        nodeCount={nodeCount}
        edgeCount={edgeCount}
        currentLayoutId={currentLayoutId}
        onVersionChange={handleVersionChange}
        layouts={layouts}
        isLoading={isLoadingLayouts}
      />

      {/* 새 레이아웃 이름 입력 Dialog */}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">새 레이아웃 저장</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="레이아웃 이름 (예: Bay-1 공정 레이아웃)"
              value={pendingDesignName}
              onChange={(e) => setPendingDesignName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNameConfirm(); }}
              className="text-sm"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNameDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleNameConfirm}
              disabled={!pendingDesignName.trim() || isSaving}
            >
              {isSaving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
