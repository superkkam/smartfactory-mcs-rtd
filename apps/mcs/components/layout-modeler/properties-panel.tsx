'use client';

import type {
  ModelerNode,
  TransferEdge,
  ProcessNodeData,
  StockerNodeData,
  PortNodeData,
  PathNodeData,
  TransferEdgeData,
} from './types';

interface PropertiesPanelProps {
  selectedNode: ModelerNode | null;
  selectedEdge: TransferEdge | null;
  onEdgeUpdate?: (edgeId: string, data: Partial<TransferEdgeData>) => void;
  onNodeUpdate?: (nodeId: string, data: Record<string, unknown>) => void;
}

/** 공통 필드 행 (읽기 전용) */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium uppercase tracking-wider text-gray-400">{label}</span>
      <span className="rounded bg-gray-50 px-2 py-1 text-[11px] text-gray-700">{value}</span>
    </div>
  );
}

/** 편집 가능 필드 행 */
function EditableField({
  label,
  value,
  type = 'text',
  step,
  min,
  onChange,
}: {
  label: string;
  value: string | number;
  type?: string;
  step?: string;
  min?: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium uppercase tracking-wider text-gray-400">{label}</span>
      <input
        type={type}
        step={step}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 focus:border-indigo-300 focus:outline-none"
      />
    </div>
  );
}

/** 선택 드롭다운 필드 행 */
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium uppercase tracking-wider text-gray-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 focus:border-indigo-300 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

/** 상태 배지 */
function StateBadge({ state }: { state: string }) {
  const style =
    state === 'Online'  ? 'bg-green-100 text-green-700 border-green-300' :
    state === 'Error'   ? 'bg-red-100   text-red-600   border-red-300'   :
                          'bg-gray-100  text-gray-500  border-gray-300';
  const label =
    state === 'Online' ? '운영중' : state === 'Error' ? '에러' : '중지';
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-medium ${style}`}>
      {label}
    </span>
  );
}

/** Process/Stocker 장비 패널 */
function EquipmentPanel({
  node,
  onNodeUpdate,
}: {
  node: ModelerNode;
  onNodeUpdate?: (nodeId: string, data: Record<string, unknown>) => void;
}) {
  const d = node.data as ProcessNodeData | StockerNodeData;
  const typeName = node.type === 'process' ? 'Process' : 'Stocker';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-indigo-100 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">
          {typeName}
        </span>
        <StateBadge state={d.state} />
      </div>
      {/* Equipment ID — 사용자 친숙 코드 (STK-001 등). 편집 가능. */}
      <EditableField
        label="Equipment ID"
        value={d.equipmentId}
        onChange={(val) => onNodeUpdate?.(node.id, { equipmentId: val })}
      />
      {/* 이름 — 설명용 라벨. 편집 가능. */}
      <EditableField
        label="이름"
        value={d.name}
        onChange={(val) => onNodeUpdate?.(node.id, { name: val })}
      />
      <Field label="포트 수"  value={`${d.portCount}개`} />
    </div>
  );
}

/** Port 패널 */
function PortPanel({
  node,
  onNodeUpdate,
}: {
  node: ModelerNode;
  onNodeUpdate?: (nodeId: string, data: Record<string, unknown>) => void;
}) {
  const d = node.data as PortNodeData;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-blue-100 px-2 py-0.5 text-[9px] font-semibold text-blue-700">
          Port
        </span>
      </div>
      {/* Port ID — 사용자 친숙 코드 (PORT-001 등). 편집 가능. */}
      <EditableField
        label="Port ID"
        value={d.portId}
        onChange={(val) => onNodeUpdate?.(node.id, { portId: val })}
      />
      <EditableField
        label="이름"
        value={d.name}
        onChange={(val) => onNodeUpdate?.(node.id, { name: val })}
      />
      <SelectField
        label="방향"
        value={d.direction}
        options={[
          { value: 'IN',   label: '입력 (IN)' },
          { value: 'OUT',  label: '출력 (OUT)' },
          { value: 'BOTH', label: '양방향 (I/O)' },
        ]}
        onChange={(val) => onNodeUpdate?.(node.id, { direction: val })}
      />
      <Field label="소속 장비"   value={d.parentEquipmentId} />
    </div>
  );
}

/** Node(경유 노드) 패널 */
function PathNodePanel({
  node,
  onNodeUpdate,
}: {
  node: ModelerNode;
  onNodeUpdate?: (nodeId: string, data: Record<string, unknown>) => void;
}) {
  const d = node.data as PathNodeData;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
          Node
        </span>
      </div>
      {/* Node ID — 경유 노드의 친숙 코드 (ND-001 등). 편집 시 노드 라벨도 동기화. */}
      <EditableField
        label="Node ID"
        value={d.nodeId ?? ''}
        onChange={(val) => onNodeUpdate?.(node.id, { nodeId: val, label: val })}
      />
      <EditableField
        label="라벨"
        value={d.label ?? ''}
        onChange={(val) => onNodeUpdate?.(node.id, { label: val })}
      />
    </div>
  );
}

/** 충전소 패널 — Node ID · 라벨 편집 가능 */
function ChargeNodePanel({
  node,
  onNodeUpdate,
}: {
  node: ModelerNode;
  onNodeUpdate?: (nodeId: string, data: Record<string, unknown>) => void;
}) {
  const d = node.data as PathNodeData;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-orange-100 px-2 py-0.5 text-[9px] font-semibold text-orange-700">
          충전소
        </span>
      </div>
      <div className="rounded border border-orange-100 bg-orange-50 p-2 text-[9px] text-orange-600">
        AGV 홈 위치. AGV 속성의 "홈 노드 ID" 에 이 Node ID 를 입력하세요.
      </div>
      <EditableField
        label="Node ID"
        value={d.nodeId ?? ''}
        onChange={(val) => onNodeUpdate?.(node.id, { nodeId: val, label: val })}
      />
      <EditableField
        label="라벨"
        value={d.label ?? ''}
        onChange={(val) => onNodeUpdate?.(node.id, { label: val })}
      />
    </div>
  );
}

/** AGV/AMR 패널 — 설비 아이디·이름·시스템 이름 편집 가능 */
function AgvPanel({
  node,
  onNodeUpdate,
}: {
  node: ModelerNode;
  onNodeUpdate?: (nodeId: string, data: Record<string, unknown>) => void;
}) {
  const d = node.data as Record<string, unknown>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-blue-100 px-2 py-0.5 text-[9px] font-semibold text-blue-700">
          AGV / AMR
        </span>
        <StateBadge state={(d.state as string) ?? 'Online'} />
      </div>
      {/* Equipment ID — 사용자 친숙 코드 (AGV-001 등). 편집 가능. */}
      <EditableField
        label="Equipment ID"
        value={(d.equipmentId as string) ?? ''}
        onChange={(val) => onNodeUpdate?.(node.id, { equipmentId: val })}
      />
      <EditableField
        label="이름 (표시용)"
        value={(d.name as string) ?? ''}
        onChange={(val) => onNodeUpdate?.(node.id, { name: val })}
      />
      <EditableField
        label="시스템 (ACS-001 등)"
        value={(d.systemName as string) ?? ''}
        onChange={(val) => onNodeUpdate?.(node.id, { systemName: val })}
      />
      <EditableField
        label="홈 노드 ID (충전소)"
        value={(d.homeNodeId as string) ?? ''}
        onChange={(val) => onNodeUpdate?.(node.id, { homeNodeId: val })}
      />
      <div className="rounded border border-blue-100 bg-blue-50 p-2 text-[9px] text-blue-600">
        <b>시스템</b>: 같은 이름의 TransferRelation 경로만 이 AGV 에 할당됩니다.<br />
        <b>홈 노드 ID</b>: 저장 시 AGV 의 초기 위치(충전소 Node ID)를 DB 에 등록합니다.
      </div>
    </div>
  );
}

/** 엣지(TransferRelation) 패널 — weight/system 편집 가능 */
function EdgePanel({
  edge,
  onEdgeUpdate,
}: {
  edge: TransferEdge;
  onEdgeUpdate?: (edgeId: string, data: Partial<TransferEdgeData>) => void;
}) {
  const d = edge.data as TransferEdgeData | undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-700">
          TransferRelation
        </span>
      </div>
      <Field label="Relation ID"  value={d?.relationId ?? edge.id} />
      <EditableField
        label="거리(m)"
        type="number"
        step="0.5"
        min="0"
        value={d?.weight ?? 0}
        onChange={(val) => onEdgeUpdate?.(edge.id, { weight: parseFloat(val) || 0 })}
      />
      <EditableField
        label="ACS 시스템"
        value={d?.system ?? ''}
        onChange={(val) => onEdgeUpdate?.(edge.id, { system: val })}
      />
      <Field label="표시 여부"    value={d?.hidden ? '숨김' : '표시'} />
      <Field label="출발 노드"    value={edge.source} />
      <Field label="도착 노드"    value={edge.target} />
    </div>
  );
}

/**
 * 속성 패널 — 선택된 노드/엣지의 정보를 표시·편집
 * - Equipment (Stocker/Process): Equipment ID · 이름 편집 가능
 * - Port: Port ID · 이름 · 방향 편집 가능
 * - Node (경유점): Node ID · 라벨 편집 가능. 노드 타입만 Node ID 를 가짐.
 * - AGV/AMR: Equipment ID · 이름 · 시스템명 편집 가능
 * - TransferEdge: weight · ACS 시스템 편집 가능
 */
export function PropertiesPanel({
  selectedNode,
  selectedEdge,
  onEdgeUpdate,
  onNodeUpdate,
}: PropertiesPanelProps) {
  return (
    <aside className="flex w-64 flex-col gap-4 border-l border-gray-200 bg-white px-3 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">속성</p>

      {/* 선택 없음 */}
      {!selectedNode && !selectedEdge && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-gray-400">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 17.5h7M17.5 14v7" />
          </svg>
          <p className="text-[11px]">노드 또는 엣지를<br />선택하세요</p>
        </div>
      )}

      {/* 노드 선택 */}
      {selectedNode && (
        <div className="flex flex-col gap-3">
          {(selectedNode.type === 'process' || selectedNode.type === 'stocker') && (
            <EquipmentPanel node={selectedNode} onNodeUpdate={onNodeUpdate} />
          )}
          {selectedNode.type === 'port' && (
            <PortPanel node={selectedNode} onNodeUpdate={onNodeUpdate} />
          )}
          {selectedNode.type === 'node' && (
            <PathNodePanel node={selectedNode} onNodeUpdate={onNodeUpdate} />
          )}
          {selectedNode.type === 'agv' && (
            <AgvPanel node={selectedNode} onNodeUpdate={onNodeUpdate} />
          )}
          {selectedNode.type === 'charge' && (
            <ChargeNodePanel node={selectedNode} onNodeUpdate={onNodeUpdate} />
          )}
        </div>
      )}

      {/* 엣지 선택 */}
      {selectedEdge && !selectedNode && (
        <EdgePanel edge={selectedEdge} onEdgeUpdate={onEdgeUpdate} />
      )}
    </aside>
  );
}
