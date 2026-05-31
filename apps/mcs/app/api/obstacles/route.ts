import { NextRequest, NextResponse } from 'next/server';
import { loadGraph } from '@/lib/engine/graph-loader';

/**
 * POST /api/obstacles
 *
 * 레이아웃 그래프에서 랜덤 장애물 노드 생성
 * - 시뮬레이션 / RTD 반송 명령 수신 시 동적 장애물 주입에 사용
 * - 출발/도착 노드는 제외
 */
export async function POST(req: NextRequest) {
  try {
    const { layoutId, count = 5, excludeUnitIds = [] } = await req.json() as {
      layoutId:        string;
      count?:          number;
      excludeUnitIds?: string[];
    };

    if (!layoutId) {
      return NextResponse.json({ error: 'layoutId 필수' }, { status: 400 });
    }

    const graph = await loadGraph(layoutId);
    const excluded = new Set<string>(excludeUnitIds);

    const candidates = [...graph.keys()].filter((id) => !excluded.has(id));

    if (candidates.length === 0) {
      return NextResponse.json({ blockedNodes: [] });
    }

    // Fisher-Yates 셔플 후 앞 count개 선택
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selected = shuffled.slice(0, Math.min(count, shuffled.length));
    const blockedNodes = selected.map((id) => ({
      unitId:    id,
      unitLabel: graph.get(id)?.unitId ?? id,
    }));

    return NextResponse.json({ blockedNodes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '장애물 생성 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
