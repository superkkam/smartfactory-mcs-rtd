'use client';

import { useState } from 'react';
import { seedTransferScenario } from '@/lib/acs/scenario-seeder';
import { bfsPath } from '@/lib/acs/layout-graph';
import type { AdjList } from '@/lib/acs/layout-graph';
import type { EquipmentUnit, Carrier } from '@workspace/types/mcs';

interface ScenarioPanelProps {
  units: EquipmentUnit[];
  carriers: Carrier[];
  adj: AdjList;
}

/**
 * 샘플 시나리오 시더 UI
 * - Port 유닛 2개 선택 (출발, 도착)
 * - 캐리어 선택
 * - "반송 명령 생성" 클릭 → DB insert → ACS tick 이 자동 pick up
 */
export function ScenarioPanel({ units, carriers, adj }: ScenarioPanelProps) {
  const portUnits = units.filter((u) => u.unitType === 'Port');
  const [sourceId, setSourceId] = useState('');
  const [destId, setDestId] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSeed = async () => {
    const sourceUnit = portUnits.find((u) => u.id === sourceId);
    const destUnit   = portUnits.find((u) => u.id === destId);
    const carrier    = carriers.find((c) => c.id === carrierId);

    if (!sourceUnit || !destUnit || !carrier) {
      setStatus('error');
      setMessage('출발지, 목적지, 캐리어를 모두 선택하세요.');
      return;
    }
    if (sourceId === destId) {
      setStatus('error');
      setMessage('출발지와 목적지는 달라야 합니다.');
      return;
    }
    // 선택한 캐리어가 출발지에 있는지 검증
    if (carrier.locationId !== sourceUnit.id) {
      setStatus('error');
      setMessage(`캐리어(${carrier.carrierId})가 출발지(${sourceUnit.equipmentUnitId})에 없습니다. 캐리어 위치: ${carrier.locationId ? '다른 포트' : '없음'}`);
      return;
    }

    // 경로 탐색 (UI 에서 미리 검증)
    const path = bfsPath(adj, sourceUnit.id, destUnit.id);
    if (!path || path.length < 2) {
      setStatus('error');
      setMessage('경로를 찾을 수 없습니다. 레이아웃 엣지 연결을 확인하세요.');
      return;
    }

    try {
      setStatus('running');
      setMessage('');
      const macroId = await seedTransferScenario(carrier.id, sourceUnit, destUnit, path);
      setStatus('ok');
      setMessage(`명령 생성 완료: ${macroId.slice(0, 8)}… (경로 ${path.length} 노드)`);
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : '알 수 없는 오류');
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">시나리오 시더 (임시 RTD)</h3>

      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-500">캐리어</label>
          <select
            value={carrierId}
            onChange={(e) => setCarrierId(e.target.value)}
            className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-xs"
          >
            <option value="">선택...</option>
            {carriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.carrierId} ({c.state})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500">출발지 Port</label>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-xs"
          >
            <option value="">선택...</option>
            {portUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.equipmentUnitId}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500">목적지 Port</label>
          <select
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-xs"
          >
            <option value="">선택...</option>
            {portUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.equipmentUnitId}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSeed}
          disabled={status === 'running'}
          className="w-full rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {status === 'running' ? '명령 생성 중...' : '반송 명령 생성'}
        </button>

        {message && (
          <p className={`text-[10px] ${status === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
