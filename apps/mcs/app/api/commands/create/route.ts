import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { loadGraph } from '@/lib/engine/graph-loader';
import { runAstar } from '@/lib/engine/astar';
import { inferRoute } from '@/lib/api/ai-engine';

// POST /api/commands/create: 수동 반송 명령 생성 (A* vs AI 하이브리드 선택)
export interface CreateCommandRequest {
  layoutId:     string;
  sourceUnitId: string;
  destUnitId:   string;
  path?:        string[];
  algorithm?:   string;
  carrierId?:   string;
}

export async function POST(req: NextRequest) {
  let body: CreateCommandRequest;
  try {
    body = await req.json() as CreateCommandRequest;
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 });
  }

  const { layoutId, sourceUnitId, destUnitId, carrierId } = body;
  if (!layoutId || !sourceUnitId || !destUnitId) {
    return NextResponse.json({ error: 'layoutId, sourceUnitId, destUnitId 필수' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ─── 1. A* 경로 (path 미제공 시 재계산) ──────────────────────────
  let path: string[] = body.path ?? [];
  let astarCost = 0;

  try {
    const graph = await loadGraph(layoutId);
    const astarResult = runAstar(graph, sourceUnitId, destUnitId);
    if (path.length === 0) path = astarResult.path.map((s) => s.unitId);
    astarCost = astarResult.totalCost;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'A* 탐색 실패' },
      { status: 500 },
    );
  }

  // ─── 2. 하이브리드 알고리즘 선택 (algorithm 힌트 우선) ──────────
  let algorithm = body.algorithm ?? 'ASTAR';

  if (!body.algorithm) {
    // 유닛 라벨 조회 (AI 추론은 라벨 기반)
    const [srcRes, dstRes] = await Promise.all([
      supabase.from('mcs_equipment_unit').select('equipment_unit_id').eq('id', sourceUnitId).maybeSingle(),
      supabase.from('mcs_equipment_unit').select('equipment_unit_id').eq('id', destUnitId).maybeSingle(),
    ]);
    const srcLabel = srcRes.data?.equipment_unit_id;
    const dstLabel = dstRes.data?.equipment_unit_id;

    if (srcLabel && dstLabel) {
      try {
        const aiResult = await inferRoute({ layoutId, sourceUnitId: srcLabel, destUnitId: dstLabel });
        if (!aiResult.fallback && aiResult.totalCost < astarCost) {
          algorithm = 'AI_PPO';
        }
      } catch { /* FastAPI 미기동 → A* 유지 */ }
    }
  }

  // ─── 2-B. carrierId 미제공 시 임의 캐리어 선택 ──────────────────
  let resolvedCarrierId = carrierId ?? null;
  if (!resolvedCarrierId) {
    const { data: anyCarrier } = await supabase.from('mcs_carrier').select('id').limit(1).maybeSingle();
    resolvedCarrierId = anyCarrier?.id ?? null;
  }

  // ─── 3. 출발/목적 장비 ID 조회 (TRANSPORT_COMPLETE 콜백용) ──────
  const [srcUnitRes, dstUnitRes] = await Promise.all([
    supabase.from('mcs_equipment_unit').select('equipment_id').eq('id', sourceUnitId).maybeSingle(),
    supabase.from('mcs_equipment_unit').select('equipment_id').eq('id', destUnitId).maybeSingle(),
  ]);

  let srcEqId: string | null = null;
  let dstEqId: string | null = null;

  if (srcUnitRes.data?.equipment_id) {
    const { data: eq } = await supabase.from('mcs_equipment').select('equipment_id').eq('id', srcUnitRes.data.equipment_id).maybeSingle();
    srcEqId = eq?.equipment_id ?? null;
  }
  if (dstUnitRes.data?.equipment_id) {
    const { data: eq } = await supabase.from('mcs_equipment').select('equipment_id').eq('id', dstUnitRes.data.equipment_id).maybeSingle();
    dstEqId = eq?.equipment_id ?? null;
  }

  // ─── 4. MacroCommand insert ────────────────────────────────────
  const commandId = `CMD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const { data: cmd, error: cmdErr } = await supabase
    .from('mcs_macro_command')
    .insert({
      command_id:          commandId,
      carrier_id:          resolvedCarrierId,
      source_unit_id:      sourceUnitId,
      dest_unit_id:        destUnitId,
      state:               'Pending',
      priority:            50,
      source_system:       'MANUAL',
      algorithm,
      source_equipment_id: srcEqId,
      dest_equipment_id:   dstEqId,
    })
    .select('id')
    .single();

  if (cmdErr || !cmd) {
    return NextResponse.json({ error: cmdErr?.message ?? 'MacroCommand 생성 실패' }, { status: 500 });
  }

  // ─── 5. MicroCommand 분해 + bulk insert ───────────────────────
  if (path.length >= 2) {
    const micros = path.slice(0, -1).map((unitId, idx) => ({
      macro_command_id:  cmd.id,
      sequence:          idx + 1,
      departure_unit_id: unitId,
      arrival_unit_id:   path[idx + 1],
      state:             'Pending',
    }));

    const { error: microErr } = await supabase.from('mcs_micro_command').insert(micros);
    if (microErr) {
      console.error('[commands/create] MicroCommand 생성 실패', microErr.message);
    }
  }

  return NextResponse.json(
    { ok: true, commandId, macroId: cmd.id, algorithm },
    { status: 201 },
  );
}
