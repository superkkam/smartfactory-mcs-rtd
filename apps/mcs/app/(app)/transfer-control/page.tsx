'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, SendHorizonal, Shuffle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge }  from '@/components/ui/badge';
import { RtdStatusBadge }    from '@/components/transfer-control/rtd-status-badge';
import { RouteSearchForm }   from '@/components/transfer-control/route-search-form';
import { MacroCommandCard }  from '@/components/transfer-control/macro-command-card';
import { RouteComparison }   from '@/components/transfer-control/route-comparison';
import { CongestionToggle }  from '@/components/transfer-control/congestion-toggle';
import { useLayouts }        from '@/lib/api/layouts';
import { inferRoute }        from '@/lib/api/ai-engine';
import type { AstarPathStep } from '@/components/transfer-control/astar-route-table';
import type { InferenceResponse } from '@workspace/types/mcs';

interface AstarResponse {
  algorithm:     string;
  path:          AstarPathStep[];
  totalCost:     number;
  exploredCount: number;
  blockedNodes?: string[];
  error?:        string;
}

interface BlockedNode {
  unitId:    string;
  unitLabel: string;
}

export default function TransferControlPage() {
  // 가장 최근 레이아웃을 기본 선택 (경로 그래프 소스)
  const { data: layouts = [] } = useLayouts();
  const latestLayout = layouts[0] ?? null;
  const layoutId     = latestLayout?.id ?? null;

  const [isSearching,  setIsSearching]  = useState(false);
  const [isAiLoading,  setIsAiLoading]  = useState(false);
  const [isSyncing,    setIsSyncing]    = useState(false);
  const [isExecuting,  setIsExecuting]  = useState(false);
  const [astarResult,  setAstarResult]  = useState<AstarResponse | null>(null);
  const [aiResult,     setAiResult]     = useState<InferenceResponse | null>(null);
  const [sourceLabel,  setSourceLabel]  = useState('');
  const [destLabel,    setDestLabel]    = useState('');
  /** 경로 탐색 시 사용한 DB UUID (명령 실행 시 재사용) */
  const [fromUnitId,   setFromUnitId]   = useState('');
  const [toUnitId,     setToUnitId]     = useState('');
  const [relationsMissing, setRelationsMissing] = useState(false);
  /** 혼잡도 맵: { unitLabel: congestionFactor } — CongestionToggle에서 주입 */
  const [congestionWeights, setCongestionWeights] = useState<Record<string, number> | null>(null);
  /** 런타임 랜덤 장애물 — 시뮬레이션/RTD 장애물 주입 */
  const [blockedNodes,    setBlockedNodes]    = useState<BlockedNode[]>([]);
  const [isObstacleLoading, setIsObstacleLoading] = useState(false);

  /** 랜덤 장애물 생성 — 출발/도착 노드 제외 */
  const handleGenerateObstacles = async () => {
    if (!layoutId) { toast.error('레이아웃을 먼저 선택하세요.'); return; }
    setIsObstacleLoading(true);
    try {
      const res = await fetch('/api/obstacles', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          layoutId,
          count:          5,
          excludeUnitIds: [fromUnitId, toUnitId].filter(Boolean),
        }),
      });
      const data = await res.json() as { blockedNodes?: BlockedNode[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? '장애물 생성 실패');
      setBlockedNodes(data.blockedNodes ?? []);
      toast.info(`랜덤 장애물 ${data.blockedNodes?.length ?? 0}개 생성 — 다시 경로 탐색하세요.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '장애물 생성 실패');
    } finally {
      setIsObstacleLoading(false);
    }
  };

  const handleSearch = async (from: string, to: string) => {
    setFromUnitId(from);
    setToUnitId(to);
    const fromUnitId = from;
    const toUnitId   = to;
    if (!layoutId) {
      toast.error('레이아웃이 없습니다. 레이아웃 모델러에서 먼저 저장해주세요.');
      return;
    }
    setIsSearching(true);
    setIsAiLoading(true);
    setAstarResult(null);
    setAiResult(null);

    const blockedIds = blockedNodes.map((n) => n.unitId);

    const [astarRes, aiRes] = await Promise.allSettled([
      fetch('/api/astar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          layoutId,
          sourceUnitId: fromUnitId,
          destUnitId:   toUnitId,
          blockedNodes: blockedIds,
        }),
      }).then(async (r) => {
        const data: AstarResponse = await r.json();
        if (!r.ok || data.error) throw new Error(data.error ?? '경로 탐색 실패');
        return data;
      }),
      inferRoute({
        layoutId,
        sourceUnitId:   fromUnitId,
        destUnitId:     toUnitId,
        dynamicWeights: congestionWeights ?? undefined,
      }),
    ]);

    if (astarRes.status === 'fulfilled') {
      const data = astarRes.value;
      setAstarResult(data);
      setSourceLabel(data.path[0]?.unitLabel ?? fromUnitId);
      setDestLabel(data.path[data.path.length - 1]?.unitLabel ?? toUnitId);
      toast.success(`A* 경로 탐색 완료 — ${data.path.length}개 노드, ${data.totalCost.toFixed(1)}m`);
    } else {
      toast.error(astarRes.reason instanceof Error ? astarRes.reason.message : '경로 탐색 오류');
    }

    if (aiRes.status === 'fulfilled') {
      setAiResult(aiRes.value);
      if (aiRes.value.fallback) {
        toast.info('PPO 모델 미학습 — A* 폴백 경로 표시');
      }
    } else {
      const errMsg = aiRes.reason instanceof Error ? aiRes.reason.message : 'AI 추론 실패';
      const isRelationsError = errMsg.includes('전이 관계');
      if (isRelationsError) {
        setRelationsMissing(true);
        toast.error('전이 관계 누락 — 아래 재동기화 버튼으로 복구하세요.');
      } else {
        toast.error(`AI 추론 실패: ${errMsg}`);
      }
    }

    setIsSearching(false);
    setIsAiLoading(false);
  };

  /** 레이아웃 전이 관계 재동기화 (전이 관계 누락 오류 수동 복구) */
  const handleSyncLayout = async () => {
    if (!layoutId) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/layouts/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ layoutId }),
      });
      const data: { ok?: boolean; error?: string } = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? '재동기화 실패');
      toast.success('레이아웃 재동기화 완료 — 다시 경로 탐색을 시도해보세요.');
      setRelationsMissing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '재동기화 실패');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExecute = async () => {
    if (!astarResult || !layoutId || !fromUnitId || !toUnitId) {
      toast.error('경로를 먼저 탐색하세요.');
      return;
    }
    setIsExecuting(true);
    try {
      const aiTotalCost = aiResult?.totalCost;
      const algorithm =
        !aiResult?.fallback &&
        aiTotalCost !== undefined &&
        aiTotalCost < astarResult.totalCost
          ? 'AI_PPO'
          : 'ASTAR';

      const res = await fetch('/api/commands/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layoutId,
          sourceUnitId: fromUnitId,
          destUnitId:   toUnitId,
          path:         astarResult.path.map((s) => s.unitId),
          algorithm,
        }),
      });
      const data = await res.json() as { ok?: boolean; commandId?: string; algorithm?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? '명령 생성 실패');
      toast.success(`반송 명령 생성 완료 [${data.algorithm}] — ${data.commandId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '명령 생성 실패');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">반송 제어</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            A*/AI 경로 탐색 및 명령 생성
            {latestLayout && (
              <span className="ml-2 text-[11px] text-indigo-500">
                [{latestLayout.designName} v{latestLayout.version}]
              </span>
            )}
          </p>
        </div>
        <RtdStatusBadge sourceEquipmentLabel={sourceLabel || undefined} />
      </div>

      {/* 전이 관계 누락 오류 배너 */}
      {relationsMissing && (
        <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            <strong>전이 관계 누락:</strong> 레이아웃 구조 테이블이 비어 있습니다.
            재동기화 버튼을 눌러 자동 복구하세요.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-4 shrink-0 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={handleSyncLayout}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? '복구 중...' : '레이아웃 재동기화'}
          </Button>
        </div>
      )}

      {/* 혼잡도 시뮬레이션 토글 */}
      <CongestionToggle onChange={setCongestionWeights} />

      {/* 런타임 장애물 패널 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-800">
              런타임 장애물 시뮬레이션
            </CardTitle>
            <div className="flex items-center gap-2">
              {blockedNodes.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs text-gray-500 hover:text-red-600"
                  onClick={() => setBlockedNodes([])}
                >
                  <X className="h-3 w-3" /> 장애물 초기화
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={handleGenerateObstacles}
                disabled={isObstacleLoading || !layoutId}
              >
                <Shuffle className={`h-3.5 w-3.5 ${isObstacleLoading ? 'animate-spin' : ''}`} />
                {isObstacleLoading ? '생성 중...' : '랜덤 장애물 생성 (5개)'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-[11px] text-gray-400">
            반송 중 랜덤 셀 차단 → A* / PPO / CACTUS / CBS-TS 우회 경로 비교 (논문 실험 시나리오)
          </p>
          {blockedNodes.length === 0 ? (
            <p className="text-xs text-gray-400 italic">장애물 없음 — 위 버튼으로 랜덤 생성</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {blockedNodes.map((n) => (
                <Badge
                  key={n.unitId}
                  variant="outline"
                  className="gap-1 border-red-200 bg-red-50 text-[10px] text-red-700"
                >
                  🚧 {n.unitLabel}
                  <button
                    className="ml-0.5 opacity-60 hover:opacity-100"
                    onClick={() => setBlockedNodes((prev) => prev.filter((x) => x.unitId !== n.unitId))}
                  >×</button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 경로 탐색 폼 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-800">경로 탐색</CardTitle>
        </CardHeader>
        <CardContent>
          <RouteSearchForm
            layoutId={layoutId}
            onSearch={handleSearch}
            isLoading={isSearching}
          />
        </CardContent>
      </Card>

      {/* 탐색 결과 */}
      {astarResult && (
        <>
          {/* MacroCommand 카드 */}
          <MacroCommandCard
            sourceLabel={sourceLabel}
            destLabel={destLabel}
            path={astarResult.path}
            totalCost={astarResult.totalCost}
            algorithm="astar"
          />

          {/* 경로 상세 탭 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-800">경로 탐색 결과</CardTitle>
            </CardHeader>
            <CardContent>
              <RouteComparison
                astarPath={astarResult.path}
                astarTotalCost={astarResult.totalCost}
                astarExplored={astarResult.exploredCount}
                aiPath={aiResult?.route}
                aiTotalTimeMs={aiResult?.route.reduce((acc, s) => acc + s.predictedTimeMs, 0)}
                isAiLoading={isAiLoading}
                blockedNodes={blockedNodes}
              />
            </CardContent>
          </Card>

          {/* 명령 실행 */}
          <div className="flex justify-end">
            <Button onClick={handleExecute} disabled={isExecuting} className="gap-2">
              <SendHorizonal className={`h-4 w-4 ${isExecuting ? 'animate-spin' : ''}`} />
              {isExecuting ? '생성 중...' : '반송 명령 실행'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
