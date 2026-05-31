import { NextRequest, NextResponse } from 'next/server';
import type {
  AnyMessage,
  DispatchResultBody,
} from '@workspace/types/messages';
import { createAdminClient } from '@/lib/supabase/server';
import { loadGraph } from '@/lib/engine/graph-loader';
import { runAstar } from '@/lib/engine/astar';
import { inferRoute } from '@/lib/api/ai-engine';

/**
 * MCS 메시지 수신 엔드포인트
 * POST /api/message
 *
 * 수신 가능한 메시지 (RTD → MCS):
 * - DISPATCH_RESULT: 디스패칭 결과 수신 → 하이브리드 경로 선택(A-star vs AI) → MacroCommand+MicroCommand 자동 생성
 */
export async function POST(request: NextRequest) {
  let msg: AnyMessage | null;

  try {
    msg = (await request.json()) as AnyMessage;
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 형식' }, { status: 400 });
  }

  if (!msg?.header?.messageType) {
    return NextResponse.json(
      { error: 'header.messageType 필드 누락' },
      { status: 400 },
    );
  }

  const { messageType, correlationId } = msg.header;
  // Route Handler 에서는 RLS 우회 필요 (인증 세션 없음)
  const supabase = createAdminClient();

  switch (messageType) {
    case 'DISPATCH_RESULT': {
      const body = msg.body as DispatchResultBody;
      console.log(
        `[MCS] DISPATCH_RESULT 수신 | ruleGroup=${body.ruleGroupId} lots=${body.lots.length}`,
      );

      const created: string[] = [];

      for (const lot of body.lots) {
        // ─── 1. 캐리어 조회 (location_id 포함) ─────────────────────
        let carrierId = lot.carrierId ?? null;
        let carrierLocationId: string | null = null;
        if (!carrierId && lot.lotId) {
          const { data: carrier } = await supabase
            .from('mcs_carrier')
            .select('id, location_id')
            .eq('lot_id', lot.lotId)
            .maybeSingle();
          carrierId = carrier?.id ?? null;
          carrierLocationId = carrier?.location_id ?? null;
        } else if (lot.carrierId) {
          const { data: carrier } = await supabase
            .from('mcs_carrier')
            .select('location_id')
            .eq('id', lot.carrierId)
            .maybeSingle();
          carrierLocationId = carrier?.location_id ?? null;
        }

        // ─── 2. 목적지 장비 → 레이아웃 ID 조회 ──────────────────────
        const { data: dstEq } = await supabase
          .from('mcs_equipment')
          .select('id, layout_id')
          .eq('equipment_id', lot.destEquipmentId)
          .maybeSingle();

        if (!dstEq?.layout_id) {
          console.warn(
            `[MCS] DISPATCH_RESULT 목적지 장비 조회 실패 | dst=${lot.destEquipmentId}`,
          );
          continue;
        }

        const layoutId = dstEq.layout_id as string;

        // ─── 3. 출발/목적 유닛 DB UUID 조회 ───────────────────────
        // 출발: 우선순위 1) RTD sourceUnitId  2) 캐리어 실제 위치  3) 장비 OUT 포트
        let srcUnitDbId: string | null = null;
        let srcUnitLabel: string | null = null;
        let dstUnitDbId: string | null = null;
        let dstUnitLabel: string | null = null;

        if (lot.sourceUnitId) {
          // RTD가 명시적으로 전달한 유닛 UUID (또는 label)
          const { data: u } = await supabase
            .from('mcs_equipment_unit')
            .select('id, equipment_unit_id')
            .or(`equipment_unit_id.eq.${lot.sourceUnitId},id.eq.${lot.sourceUnitId}`)
            .maybeSingle();
          srcUnitDbId = u?.id ?? null;
          srcUnitLabel = u?.equipment_unit_id ?? null;
        }

        if (!srcUnitDbId && carrierLocationId) {
          // 캐리어의 실제 location_id (UUID) 직접 사용
          const { data: u } = await supabase
            .from('mcs_equipment_unit')
            .select('id, equipment_unit_id')
            .eq('id', carrierLocationId)
            .maybeSingle();
          srcUnitDbId = u?.id ?? null;
          srcUnitLabel = u?.equipment_unit_id ?? null;
        }

        if (!srcUnitDbId && lot.sourceEquipmentId) {
          // fallback: lot.sourceEquipmentId 장비의 OUT 포트
          const { data: srcEq } = await supabase
            .from('mcs_equipment')
            .select('id')
            .eq('equipment_id', lot.sourceEquipmentId)
            .maybeSingle();
          if (srcEq) {
            const { data: u } = await supabase
              .from('mcs_equipment_unit')
              .select('id, equipment_unit_id')
              .eq('equipment_id', srcEq.id)
              .in('in_out_mode', ['Out', 'Both'])
              .order('equipment_unit_id')
              .limit(1)
              .maybeSingle();
            srcUnitDbId = u?.id ?? null;
            srcUnitLabel = u?.equipment_unit_id ?? null;
          }
        }

        if (lot.destUnitId) {
          const { data: u } = await supabase
            .from('mcs_equipment_unit')
            .select('id, equipment_unit_id')
            .or(`equipment_unit_id.eq.${lot.destUnitId},id.eq.${lot.destUnitId}`)
            .maybeSingle();
          dstUnitDbId = u?.id ?? null;
          dstUnitLabel = u?.equipment_unit_id ?? null;
        }

        if (!dstUnitDbId) {
          // IN 또는 BOTH 모드 포트 중 첫 번째 선택 (ORDER BY로 결정적 순서 보장)
          const { data: u } = await supabase
            .from('mcs_equipment_unit')
            .select('id, equipment_unit_id')
            .eq('equipment_id', dstEq.id)
            .in('in_out_mode', ['In', 'Both'])
            .order('equipment_unit_id')
            .limit(1)
            .maybeSingle();
          dstUnitDbId = u?.id ?? null;
          dstUnitLabel = u?.equipment_unit_id ?? null;
        }

        if (!srcUnitDbId || !dstUnitDbId) {
          console.warn(
            `[MCS] DISPATCH_RESULT 유닛 선정 실패 | srcEq=${lot.sourceEquipmentId} dstEq=${lot.destEquipmentId}`,
          );
          continue;
        }

        // A5 진단: 최종 채택된 src 확인 (lot.sourceUnitId vs carrierLoc 중 어느 것이 쓰였는지)
        console.log(
          `[MCS] DISPATCH src 결정 | lot.sourceUnitId=${lot.sourceUnitId ?? 'null'} carrierLoc=${carrierLocationId?.slice(0, 8) ?? 'null'} → srcUnitDbId=${srcUnitDbId.slice(0, 8)} dstUnitDbId=${dstUnitDbId.slice(0, 8)}`,
        );

        // B1: 같은 carrier 에 대한 active macro 가 이미 있으면 중복 dispatch 거부
        if (carrierId) {
          const { data: activeMacro } = await supabase
            .from('mcs_macro_command')
            .select('id, command_id')
            .eq('carrier_id', carrierId)
            .in('state', ['Pending', 'InProgress'])
            .maybeSingle();
          if (activeMacro) {
            console.warn(
              `[MCS] DISPATCH 거부: 같은 carrier 의 active macro 존재 | carrier=${carrierId.slice(0, 8)} active=${(activeMacro as Record<string, unknown>).command_id}`,
            );
            continue;
          }
        }

        // ─── 4. 그래프 로드 + 장애물 집합 구성 ──────────────────────────
        // MCS_INJECT_RANDOM_OBSTACLES=true 일 때만 랜덤 장애물 삽입 (기본: 비활성)
        const graph = await loadGraph(layoutId);
        const blockedSet = new Set<string>();

        if (process.env.MCS_INJECT_RANDOM_OBSTACLES === 'true') {
          try {
            const candidates = [...graph.keys()].filter(
              (id) => id !== srcUnitDbId && id !== dstUnitDbId,
            );
            for (let i = candidates.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
            }
            candidates.slice(0, 5).forEach((id) => blockedSet.add(id));
            if (blockedSet.size > 0) {
              console.log(`[MCS] 랜덤 장애물 ${blockedSet.size}개 주입:`, [...blockedSet]);
            }
          } catch {
            // 장애물 생성 실패 시 무시하고 장애물 없이 탐색
          }
        }

        // ─── 5. A* 경로 탐색 (장애물 우회 포함) ────────────────────
        let astarPath: Array<{ unitId: string }>;
        let astarCost: number;

        try {
          const astarResult = runAstar(graph, srcUnitDbId, dstUnitDbId, blockedSet);
          astarPath = astarResult.path;
          astarCost = astarResult.totalCost;
        } catch (e) {
          console.error(
            `[MCS] A* 경로 탐색 실패 | src=${srcUnitLabel}(${srcUnitDbId}) dst=${dstUnitLabel}(${dstUnitDbId}) |`,
            e instanceof Error ? e.message : e,
          );
          continue;
        }

        // ─── 6. AI 경로 추론 + 하이브리드 선택 ──────────────────────
        let algorithm = 'ASTAR';

        try {
          if (srcUnitLabel && dstUnitLabel) {
            const aiResult = await inferRoute({
              layoutId,
              sourceUnitId: srcUnitLabel,
              destUnitId:   dstUnitLabel,
            });
            if (!aiResult.fallback && aiResult.totalCost < astarCost) {
              algorithm = 'AI_PPO';
              console.log(
                `[MCS] AI 경로 선택 | AI=${aiResult.totalCost.toFixed(1)} A*=${astarCost.toFixed(1)}`,
              );
            }
          }
        } catch {
          // FastAPI 미기동 또는 오류 → A* 폴백
        }

        // ─── 7. MacroCommand 생성 ────────────────────────────────
        const commandId = `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        const { data: cmd, error: cmdErr } = await supabase
          .from('mcs_macro_command')
          .insert({
            command_id:          commandId,
            carrier_id:          carrierId,
            source_unit_id:      srcUnitDbId,
            dest_unit_id:        dstUnitDbId,
            state:               'Pending',
            priority:            lot.priority ?? 50,
            rtd_command_id:      correlationId ?? null,
            correlation_id:      correlationId ?? null,
            source_system:       'RTD',
            algorithm,
            source_equipment_id: lot.sourceEquipmentId,
            dest_equipment_id:   lot.destEquipmentId,
          })
          .select('id')
          .single();

        if (cmdErr || !cmd) {
          console.error('[MCS] MacroCommand 생성 실패', cmdErr?.message);
          continue;
        }

        // ─── 8. MicroCommand 분해 + bulk insert ──────────────────
        if (astarPath.length >= 2) {
          const micros = astarPath.slice(0, -1).map((step, idx) => ({
            macro_command_id:  cmd.id,
            sequence:          idx + 1,
            departure_unit_id: step.unitId,
            arrival_unit_id:   astarPath[idx + 1].unitId,
            state:             'Pending',
          }));

          const { error: microErr } = await supabase
            .from('mcs_micro_command')
            .insert(micros);

          if (microErr) {
            console.error('[MCS] MicroCommand 생성 실패', microErr.message);
          }
        }

        created.push(cmd.id);
        console.log(
          `[MCS] MacroCommand 생성 완료 | id=${cmd.id} cmd=${commandId} alg=${algorithm}`,
        );
      }

      return NextResponse.json(
        {
          received:     true,
          correlationId,
          createdCount: created.length,
          commandIds:   created,
        },
        { status: 201 },
      );
    }

    default:
      return NextResponse.json(
        { error: `MCS가 처리할 수 없는 messageType: ${messageType}` },
        { status: 422 },
      );
  }
}
