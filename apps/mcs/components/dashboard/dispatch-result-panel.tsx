'use client';

import { memo } from 'react';
import { X, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { useRtdMacroSince } from '@/lib/api/macro-commands';
import { useMicroCommandsByMacro } from '@/lib/api/micro-commands';
import { unitIdToLabel } from '@/lib/monitor/unit-mapping';
import type { EquipmentUnit } from '@workspace/types/mcs';
import type { AcsVehicle } from '@/lib/acs/types';

export interface DispatchAckInfo {
  portId:           string;
  status:           string;
  ruleGroupId?:     string;
  selectedLotId?:   string | null;
  destEquipmentId?: string | null;
  reason?:          string | null;
}

interface StepBadgeProps { step: number; active: boolean; done: boolean }
function StepBadge({ step, active, done }: StepBadgeProps) {
  const bg   = done ? '#22c55e' : active ? '#6366f1' : '#e5e7eb';
  const text = done ? '#fff'    : active ? '#fff'    : '#9ca3af';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 18, height: 18, borderRadius: '50%',
      background: bg, color: text, fontSize: 9, fontWeight: 700, flexShrink: 0,
    }}>
      {step}
    </span>
  );
}

interface Props {
  ack:         DispatchAckInfo | null;
  ackAt:       number | null;
  units?:      EquipmentUnit[];
  acsVehicles?: Map<string, AcsVehicle>;
  onClose:     () => void;
}

export const DispatchResultPanel = memo(function DispatchResultPanel({
  ack, ackAt, units = [], acsVehicles, onClose,
}: Props) {
  // ackAt 이후 생성된 RTD 매크로 (3초 폴링 — 매크로 감지용)
  const { data: latestCmd } = useRtdMacroSince(ackAt);

  // 마이크로 커맨드 목록 (3초 폴링 — 세그먼트 라벨 + 완료 감지용)
  const dbMicros = useMicroCommandsByMacro(latestCmd?.id ?? '').data ?? [];

  // tick-loop in-memory 상태에서 현재 매크로를 실행 중인 차량 검색
  // (DB executor_equipment_id 폴링 대신 100ms tick 갱신 acsVehicles 사용)
  const acsVehicle: AcsVehicle | undefined = latestCmd
    ? [...(acsVehicles?.values() ?? [])].find(
        (v) => v.currentMacroCommandId === latestCmd.id,
      )
    : undefined;

  // acsVehicle.currentPath[pathIndex] = 현재 위치 unit UUID
  const executorLocationId: string | null =
    acsVehicle && acsVehicle.currentPath.length > 0
      ? (acsVehicle.currentPath[acsVehicle.pathIndex] ?? null)
      : null;

  // 세그먼트 목록 (DB 기반 — 라벨 표시용)
  const segments = dbMicros.map((m) => ({
    id:              m.id,
    departureUnitId: m.departureUnitId,
    arrivalUnitId:   m.arrivalUnitId,
  }));
  const total = segments.length;

  // 빈차 이동(MovingEmpty/Acquiring) 구간에서는 step 추적 안 함
  // — 빈차 A* path 노드가 적재 micros 노드와 겹쳐 step 이 역순 감소하는 버그 방지
  const vehicleState = acsVehicle?.vehicleState;
  const isLoadingPhase =
    vehicleState === 'MovingLoaded' || vehicleState === 'Depositing';

  // AGV 위치 → 현재 세그먼트 인덱스 (적재 단계에서만 계산)
  const locIdx = (isLoadingPhase && executorLocationId)
    ? segments.findIndex((s) => s.departureUnitId === executorLocationId)
    : -1;

  // 마지막 도착지에 있으면 모든 구간 완료
  const lastSegment = segments[segments.length - 1];
  const isAtDestination = !!executorLocationId &&
    !!lastSegment &&
    executorLocationId === lastSegment.arrivalUnitId;

  const allDoneInDb = dbMicros.length > 0 && dbMicros.every((m) => m.state === 'Completed');
  const isDone      = allDoneInDb || isAtDestination || latestCmd?.state === 'Completed';

  // step: 빈차 구간에서는 0, 적재 구간에서는 위치 기반, 완료 시 total
  const step = isDone ? total : (locIdx >= 0 ? locIdx + 1 : 0);

  // 세그먼트 상태 결정
  function segState(i: number): 'InProgress' | 'Completed' | 'Pending' {
    if (isDone) return 'Completed';
    if (!isLoadingPhase) return dbMicros[i]?.state === 'Completed' ? 'Completed' : 'Pending';
    if (locIdx < 0) return dbMicros[i]?.state === 'Completed' ? 'Completed' : 'Pending';
    if (i < locIdx)  return 'Completed';
    if (i === locIdx) return 'InProgress';
    return 'Pending';
  }

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">디스패칭 결과</span>
        <button onClick={onClose} className="rounded p-0.5 hover:bg-gray-100">
          <X className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </div>

      {!ack ? (
        <p className="py-4 text-center text-xs text-gray-400">
          포트를 클릭하고 LoadRequest를 발생시키면<br />여기서 결과를 확인할 수 있습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {/* STEP 1 */}
          <div className={`rounded-md border p-2.5 text-xs space-y-1 ${
            ack.status === 'ACCEPTED' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
          }`}>
            <div className="flex items-center gap-1.5 font-medium">
              <StepBadge step={1} active={!latestCmd} done={!!latestCmd} />
              <span className={ack.status === 'ACCEPTED' ? 'text-green-700' : 'text-red-700'}>
                RTD {ack.status === 'ACCEPTED' ? '수락됨' : '거부됨'}
              </span>
            </div>
            <div className="space-y-0.5 pl-5 text-gray-500">
              <div>포트: <span className="font-mono text-gray-700">{ack.portId}</span></div>
              <div>룰 그룹: <span className="font-mono text-gray-700">{ack.ruleGroupId || '단독 모드'}</span></div>
              {ack.destEquipmentId && (
                <div>목적지: <span className="font-mono text-gray-700">{ack.destEquipmentId}</span></div>
              )}
              {ack.reason && <div className="italic text-gray-400">{ack.reason}</div>}
            </div>
          </div>

          {/* STEP 2 */}
          {latestCmd && (
            <div className="rounded-md border border-indigo-100 bg-indigo-50 p-2.5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-indigo-700">
                <StepBadge step={2} active={!isDone} done={isDone} />
                명령 생성됨
              </div>
              <div className="space-y-0.5 pl-5 text-gray-500">
                <div className="truncate font-mono text-[10px] text-gray-700">{latestCmd.commandId}</div>
                <div>알고리즘: <span className="font-semibold text-indigo-600">{latestCmd.algorithm}</span></div>
              </div>
            </div>
          )}

          {/* STEP 3 — 이동 진행 + 세그먼트 */}
          {latestCmd && total > 0 && (
            <div className="rounded-md border border-blue-100 bg-blue-50 p-2.5 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-blue-700">
                {isDone
                  ? <StepBadge step={3} active={false} done={true} />
                  : <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                }
                이동 중 ({step}/{total})
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${total > 0 ? (step / total) * 100 : 0}%` }}
                />
              </div>

              <div className="space-y-0.5 pt-1 max-h-40 overflow-y-auto">
                {segments.map((seg, i) => {
                  const st        = segState(i);
                  const isCurrent = st === 'InProgress';
                  const isPast    = st === 'Completed';
                  const depLabel  = unitIdToLabel(seg.departureUnitId, units);
                  const arrLabel  = unitIdToLabel(seg.arrivalUnitId, units);

                  return (
                    <div
                      key={seg.id}
                      className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] ${
                        isCurrent ? 'bg-blue-100 font-semibold text-blue-800'
                        : isPast   ? 'text-gray-400'
                        : 'text-gray-600'
                      }`}
                    >
                      <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold ${
                        isCurrent ? 'bg-blue-600 text-white'
                        : isPast   ? 'bg-gray-200 text-gray-400'
                        : 'bg-gray-100 text-gray-500'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="truncate">
                        {depLabel}<span className="mx-0.5 opacity-50">→</span>{arrLabel}
                      </span>
                      {isCurrent && <span className="ml-auto shrink-0 text-[8px] text-blue-500">이동중</span>}
                      {isPast    && <span className="ml-auto shrink-0 text-[8px] text-gray-300">완료</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {isDone && (
            <div className="rounded-md border border-green-100 bg-green-50 p-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                반송 완료
              </div>
            </div>
          )}

          {ack.status === 'ACCEPTED' && !latestCmd && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              MacroCommand 생성 대기 중...
            </div>
          )}
        </div>
      )}
    </div>
  );
});

DispatchResultPanel.displayName = 'DispatchResultPanel';
