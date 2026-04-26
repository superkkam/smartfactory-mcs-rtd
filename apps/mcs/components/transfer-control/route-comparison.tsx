'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AstarRouteTable, type AstarPathStep } from './astar-route-table';
import { AiRouteView, type AiRouteStep }       from './ai-route-view';
import { Badge } from '@/components/ui/badge';

interface RouteComparisonProps {
  astarPath:       AstarPathStep[];
  astarTotalCost:  number;
  astarExplored:   number;
  aiPath?:         AiRouteStep[];
  aiTotalTimeMs?:  number;
  isAiLoading?:    boolean;
}

/** A* / AI / 비교 탭 뷰 */
export function RouteComparison({
  astarPath,
  astarTotalCost,
  astarExplored,
  aiPath,
  aiTotalTimeMs,
  isAiLoading,
}: RouteComparisonProps) {
  // 비교 요약: A* 총 비용(m) → 예상 시간 (0.3 m/s 기준)
  const astarEstimateSec = (astarTotalCost / 0.3).toFixed(1);
  const aiEstimateSec    = ((aiTotalTimeMs ?? 0) / 1000).toFixed(1);

  // 경로 동일 여부 판단 (unitLabel 기준)
  const astarLabels = astarPath.map((s) => s.unitLabel).join(',');
  const aiLabels    = (aiPath ?? []).map((s) => s.unitLabel).join(',');
  const isDifferent = aiPath && aiPath.length > 0 && astarLabels !== aiLabels;

  return (
    <Tabs defaultValue="astar">
      <TabsList className="mb-3">
        <TabsTrigger value="astar">A* 경로</TabsTrigger>
        <TabsTrigger value="ai">AI 경로</TabsTrigger>
        <TabsTrigger value="compare">비교</TabsTrigger>
      </TabsList>

      <TabsContent value="astar">
        <AstarRouteTable
          path={astarPath}
          totalCost={astarTotalCost}
          exploredCount={astarExplored}
        />
      </TabsContent>

      <TabsContent value="ai">
        <AiRouteView
          path={aiPath}
          totalTimeMs={aiTotalTimeMs}
          isLoading={isAiLoading}
        />
      </TabsContent>

      <TabsContent value="compare">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="mb-2 text-xs font-semibold text-indigo-700">A* 경로</h4>
            <AstarRouteTable
              path={astarPath}
              totalCost={astarTotalCost}
              exploredCount={astarExplored}
            />
          </div>
          <div>
            <h4 className="mb-2 text-xs font-semibold text-emerald-700">AI 경로</h4>
            <AiRouteView
              path={aiPath}
              totalTimeMs={aiTotalTimeMs}
              isLoading={isAiLoading}
            />
          </div>
        </div>

        {/* 경로 차이 배너 */}
        {isDifferent && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <span className="font-semibold">경로 차이 감지!</span>
            <span>A*는 정적 최단 경로, AI는 혼잡 회피 경로를 선택했습니다.</span>
            <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]">
              A* {astarPath.length}홉 vs AI {aiPath!.length}홉
            </Badge>
          </div>
        )}

        {/* 요약 비교 */}
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-3 text-xs font-semibold text-gray-700">경로 비교 요약</h4>
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-1">지표</p>
              <p className="font-medium text-gray-600">예상 소요시간</p>
              <p className="font-medium text-gray-600">경유 노드 수</p>
              <p className="font-medium text-gray-600">총 비용</p>
            </div>
            <div>
              <p className="text-xs text-indigo-600 font-medium mb-1">A*</p>
              <p className="text-gray-800">{astarEstimateSec}s</p>
              <p className="text-gray-800">{astarPath.length}개</p>
              <p className="text-gray-800">{astarTotalCost.toFixed(1)}m</p>
            </div>
            <div>
              <p className="text-xs text-emerald-600 font-medium mb-1">AI</p>
              {aiPath ? (
                <>
                  <p className="text-gray-800">{aiEstimateSec}s</p>
                  <p className="text-gray-800">{aiPath.length}개</p>
                  <p className="text-gray-800">—</p>
                </>
              ) : (
                <p className="text-gray-400 text-xs col-span-3">미연동</p>
              )}
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
