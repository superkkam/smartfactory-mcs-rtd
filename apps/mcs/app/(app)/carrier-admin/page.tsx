'use client';

import { useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { useCarriers, useUpdateCarrier } from '@/lib/api/carriers';
import { useLayouts } from '@/lib/api/layouts';
import { useUnitsByLayout } from '@/lib/api/equipment-units';

/**
 * 캐리어 위치 관리 페이지
 * - 캐리어 목록 + 현재 위치(Port 이름), 상태 표시
 * - 드롭다운으로 Port 선택 → "이동" 버튼으로 DB 업데이트
 */
export default function CarrierAdminPage() {
  const { data: layouts = [] } = useLayouts();
  const defaultLayoutId = useMemo(
    () => (layouts.length > 0 ? layouts[0].id : undefined),
    [layouts],
  );
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | undefined>(undefined);
  const layoutId = selectedLayoutId ?? defaultLayoutId;

  const { data: carriers = [], isLoading: carriersLoading } = useCarriers();
  const { data: units = [] } = useUnitsByLayout(layoutId ?? '');
  const updateCarrier = useUpdateCarrier();

  // Port 유닛만 필터 (이동 가능한 위치)
  const portUnits = useMemo(() => units.filter((u) => u.unitType === 'Port'), [units]);

  // 유닛 ID → 이름 맵
  const unitNameMap = useMemo(
    () => new Map(units.map((u) => [u.id, u.equipmentUnitId])),
    [units],
  );

  // 각 캐리어별 선택한 목적지 unitId 상태
  const [selectedUnitIds, setSelectedUnitIds] = useState<Record<string, string>>({});
  // 진행 중인 업데이트 상태
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [resultMap, setResultMap] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const handleMove = async (carrierId: string) => {
    const unitId = selectedUnitIds[carrierId];
    if (!unitId) return;

    const targetUnit = units.find((u) => u.id === unitId);
    if (!targetUnit) return;

    setUpdatingIds((prev) => new Set(prev).add(carrierId));
    setResultMap((prev) => ({ ...prev, [carrierId]: { ok: false, msg: '' } }));

    try {
      await updateCarrier.mutateAsync({
        id: carrierId,
        locationId: unitId,
        currentEquipmentId: targetUnit.equipmentId,
        state: 'Installed',
      });
      setResultMap((prev) => ({
        ...prev,
        [carrierId]: { ok: true, msg: `→ ${targetUnit.equipmentUnitId} 이동 완료` },
      }));
    } catch (e) {
      setResultMap((prev) => ({
        ...prev,
        [carrierId]: { ok: false, msg: e instanceof Error ? e.message : '오류 발생' },
      }));
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(carrierId);
        return next;
      });
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-indigo-600" />
        <h1 className="text-lg font-semibold text-gray-800">캐리어 위치 관리</h1>
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

      {/* 캐리어 테이블 */}
      <div className="overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-medium text-gray-500">
              <th className="px-4 py-2">캐리어 ID</th>
              <th className="px-4 py-2">현재 위치</th>
              <th className="px-4 py-2">상태</th>
              <th className="px-4 py-2 w-48">이동할 Port</th>
              <th className="px-4 py-2 w-20">액션</th>
              <th className="px-4 py-2">결과</th>
            </tr>
          </thead>
          <tbody>
            {carriersLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  로딩 중...
                </td>
              </tr>
            )}
            {!carriersLoading && carriers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  캐리어가 없습니다
                </td>
              </tr>
            )}
            {carriers.map((carrier) => {
              const currentUnitName = carrier.locationId
                ? (unitNameMap.get(carrier.locationId) ?? carrier.locationId.slice(0, 8) + '…')
                : '—';
              const isUpdating = updatingIds.has(carrier.id);
              const result = resultMap[carrier.id];
              const selectedUnitId = selectedUnitIds[carrier.id] ?? '';

              return (
                <tr key={carrier.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-700">{carrier.carrierId}</td>
                  <td className="px-4 py-2 text-gray-500">{currentUnitName}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        carrier.state === 'Installed'
                          ? 'bg-green-50 text-green-700'
                          : carrier.state === 'Transferring' || carrier.state === 'InTransfer'
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {carrier.state}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={selectedUnitId}
                      onChange={(e) =>
                        setSelectedUnitIds((prev) => ({ ...prev, [carrier.id]: e.target.value }))
                      }
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                      disabled={isUpdating}
                    >
                      <option value="">선택...</option>
                      {portUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.equipmentUnitId}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleMove(carrier.id)}
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
        * 이동 버튼 클릭 시 캐리어 state가 Installed로 강제 설정됩니다. 반송 중인 캐리어에는 사용하지 마세요.
      </p>
    </div>
  );
}
