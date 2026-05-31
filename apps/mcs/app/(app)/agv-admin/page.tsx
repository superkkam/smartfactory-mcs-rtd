'use client';

import { useMemo, useState } from 'react';
import { Bot } from 'lucide-react';
import { useEquipmentsByLayout, useUpdateEquipment } from '@/lib/api/equipment';
import { useLayouts } from '@/lib/api/layouts';
import { useUnitsByLayout } from '@/lib/api/equipment-units';

/**
 * AGV 위치 관리 페이지 (개발·테스트용)
 * - AGV 목록 + 현재 위치(유닛 이름), 상태 표시
 * - 드롭다운으로 노드/포트 선택 → "이동" 버튼으로 DB 업데이트
 */
export default function AgvAdminPage() {
  const { data: layouts = [] } = useLayouts();
  const defaultLayoutId = useMemo(
    () => (layouts.length > 0 ? layouts[0].id : undefined),
    [layouts],
  );
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | undefined>(undefined);
  const layoutId = selectedLayoutId ?? defaultLayoutId;

  const { data: equipments = [], isLoading: equipmentsLoading } = useEquipmentsByLayout(layoutId ?? '');
  const { data: units = [] } = useUnitsByLayout(layoutId ?? '');
  const updateEquipment = useUpdateEquipment();

  // AGV 장비만 필터
  const agvList = useMemo(
    () => equipments.filter((e) => e.equipmentType === 'AGV'),
    [equipments],
  );

  // AGV가 이동 가능한 유닛 (Node, Port 모두 허용)
  const movableUnits = useMemo(
    () => units.filter((u) => u.unitType === 'Node' || u.unitType === 'Port'),
    [units],
  );

  // 유닛 ID → 이름 맵
  const unitNameMap = useMemo(
    () => new Map(units.map((u) => [u.id, u.equipmentUnitId])),
    [units],
  );

  // 각 AGV별 선택한 목적지 unitId 상태
  const [selectedUnitIds, setSelectedUnitIds] = useState<Record<string, string>>({});
  // 진행 중인 업데이트 상태
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [resultMap, setResultMap] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const handleMove = async (agvId: string) => {
    const unitId = selectedUnitIds[agvId];
    if (!unitId) return;

    const targetUnit = units.find((u) => u.id === unitId);
    if (!targetUnit) return;

    setUpdatingIds((prev) => new Set(prev).add(agvId));
    setResultMap((prev) => ({ ...prev, [agvId]: { ok: false, msg: '' } }));

    try {
      await updateEquipment.mutateAsync({
        id: agvId,
        locationId: unitId,
      });
      setResultMap((prev) => ({
        ...prev,
        [agvId]: { ok: true, msg: `→ ${targetUnit.equipmentUnitId} 이동 완료` },
      }));
    } catch (e) {
      setResultMap((prev) => ({
        ...prev,
        [agvId]: { ok: false, msg: e instanceof Error ? e.message : '오류 발생' },
      }));
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(agvId);
        return next;
      });
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-indigo-600" />
        <h1 className="text-lg font-semibold text-gray-800">AGV 위치 관리</h1>
        <span className="text-xs text-gray-400">(개발·테스트용)</span>
      </div>

      {/* 레이아웃 선택 */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">레이아웃</label>
        <select
          value={layoutId ?? ''}
          onChange={(e) => setSelectedLayoutId(e.target.value || undefined)}
          className="rounded border border-gray-200 px-2 py-1 text-xs"
        >
          {layouts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.designName} v{l.version}
            </option>
          ))}
        </select>
      </div>

      {/* AGV 테이블 */}
      <div className="overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-medium text-gray-500">
              <th className="px-4 py-2">AGV ID</th>
              <th className="px-4 py-2">현재 위치</th>
              <th className="px-4 py-2">상태</th>
              <th className="px-4 py-2 w-52">이동할 노드</th>
              <th className="px-4 py-2 w-20">액션</th>
              <th className="px-4 py-2">결과</th>
            </tr>
          </thead>
          <tbody>
            {equipmentsLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  로딩 중...
                </td>
              </tr>
            )}
            {!equipmentsLoading && agvList.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  AGV가 없습니다
                </td>
              </tr>
            )}
            {agvList.map((agv) => {
              const currentUnitName = agv.locationId
                ? (unitNameMap.get(agv.locationId) ?? agv.locationId.slice(0, 8) + '…')
                : '—';
              const isUpdating = updatingIds.has(agv.id);
              const result = resultMap[agv.id];
              const selectedUnitId = selectedUnitIds[agv.id] ?? '';

              return (
                <tr key={agv.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-700">{agv.equipmentId}</td>
                  <td className="px-4 py-2 text-gray-500">{currentUnitName}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        agv.state === 'Idle'
                          ? 'bg-green-50 text-green-700'
                          : agv.state === 'Moving' || agv.state === 'InProgress'
                          ? 'bg-yellow-50 text-yellow-700'
                          : agv.state === 'Error'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {agv.state ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={selectedUnitId}
                      onChange={(e) =>
                        setSelectedUnitIds((prev) => ({ ...prev, [agv.id]: e.target.value }))
                      }
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                      disabled={isUpdating}
                    >
                      <option value="">선택...</option>
                      {movableUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.equipmentUnitId} ({u.unitType})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleMove(agv.id)}
                      disabled={!selectedUnitId || isUpdating}
                      className="rounded bg-indigo-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                    >
                      {isUpdating ? '이동 중…' : '이동'}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    {result && (
                      <span
                        className={`text-[10px] ${result.ok ? 'text-green-600' : 'text-red-500'}`}
                      >
                        {result.msg}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-gray-400">
        * 이동 버튼 클릭 시 AGV의 location_id(현재 위치 유닛)만 DB에서 강제 변경됩니다. ACS가 실행 중일 때는 사용하지 마세요.
      </p>
    </div>
  );
}
