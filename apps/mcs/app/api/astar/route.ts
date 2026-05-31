import { NextRequest, NextResponse } from 'next/server';
import { loadGraph } from '@/lib/engine/graph-loader';
import { runAstar } from '@/lib/engine/astar';
import { createClient } from '@/lib/supabase/server';

export interface AstarRequest {
  layoutId:     string;
  sourceUnitId: string;
  destUnitId:   string;
  /** 런타임 장애물 유닛 ID 목록 — 시뮬레이션/RTD에서 랜덤 주입 */
  blockedNodes?: string[];
}

/**
 * POST /api/astar
 *
 * Supabase mcs_transfer_relation에서 그래프 로드 → A* 탐색 → 결과 반환
 * 결과는 mcs_route_finding_result에 저장 (macro_command_id 없이 standalone 저장)
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AstarRequest;
    const { layoutId, sourceUnitId, destUnitId, blockedNodes } = body;

    if (!layoutId || !sourceUnitId || !destUnitId) {
      return NextResponse.json(
        { error: 'layoutId, sourceUnitId, destUnitId 필수' },
        { status: 400 },
      );
    }

    // 그래프 로드
    const graph = await loadGraph(layoutId);

    // 런타임 장애물 Set 구성
    const blocked = new Set<string>(blockedNodes ?? []);

    // A* 탐색 (장애물 우회 포함)
    const result = runAstar(graph, sourceUnitId, destUnitId, blocked);

    // 경로의 유닛 라벨 리스트 구성 (DB uuid → 표시 ID)
    const pathWithLabels = result.path.map((step) => {
      const node = graph.get(step.unitId);
      return {
        unitId:    step.unitId,
        unitLabel: node?.unitId ?? step.unitId,
        gCost:     step.gCost,
        hCost:     step.hCost,
        fCost:     step.fCost,
      };
    });

    // mcs_route_finding_result 저장 (선택적 — 실패해도 탐색 결과는 반환)
    try {
      const supabase = await createClient();
      await supabase.from('mcs_route_finding_result').insert({
        algorithm:  'astar',
        route:      pathWithLabels.map((s) => s.unitId),
        total_cost: result.totalCost,
      });
    } catch {
      // DB 저장 실패는 무시 (로그만)
      console.warn('[api/astar] route_finding_result 저장 실패 (무시됨)');
    }

    return NextResponse.json({
      algorithm:     'astar',
      path:          pathWithLabels,
      totalCost:     result.totalCost,
      exploredCount: result.exploredCount,
      blockedNodes:  [...blocked],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '경로 탐색 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
