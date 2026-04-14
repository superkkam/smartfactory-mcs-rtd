'use client';

import { ProcessSymbol, StockerSymbol } from '@/components/symbols';

interface PaletteItem {
  type: 'process' | 'stocker' | 'node' | 'agv' | 'charge';
  label: string;
  description: string;
}

// PALETTE_ITEMS: 타입 힌트 목적 (실제 UI 는 아래 JSX 에서 직접 렌더)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'stocker', label: 'Stocker', description: '포트 × 2 자동 생성' },
  { type: 'process', label: 'Process', description: '포트 × 2 자동 생성' },
  { type: 'agv',     label: 'AGV',     description: 'AMR/AGV 이동 장비' },
  { type: 'node',    label: 'Node',    description: 'AMR 경로 중간 노드' },
  { type: 'charge',  label: '충전소',  description: 'AGV 홈 / 시작 위치' },
];

interface SymbolPaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}

/**
 * 심볼 팔레트 — 드래그앤드롭으로 캔버스에 노드 추가
 * DnD: dataTransfer.setData('nodeType', type) → 캔버스 onDrop에서 수신
 */
export function SymbolPalette({ onDragStart }: SymbolPaletteProps) {
  return (
    <aside className="flex w-44 flex-col gap-3 border-r border-gray-200 bg-gray-50 px-3 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">팔레트</p>

      {/* Equipment 섹션 */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] font-medium text-gray-500">Equipment</p>

        {/* Stocker */}
        <div
          draggable
          onDragStart={(e) => onDragStart(e, 'stocker')}
          className="flex cursor-grab flex-col items-center gap-1 rounded-md border border-gray-200 bg-white p-2 shadow-sm active:cursor-grabbing hover:border-indigo-300 hover:shadow"
        >
          <StockerSymbol state="Online" width={100} height={16} />
          <span className="text-[9px] font-medium text-gray-600">Stocker</span>
          <span className="text-[8px] text-gray-400">포트 × 2 자동 생성</span>
        </div>

        {/* Process */}
        <div
          draggable
          onDragStart={(e) => onDragStart(e, 'process')}
          className="flex cursor-grab flex-col items-center gap-1 rounded-md border border-gray-200 bg-white p-2 shadow-sm active:cursor-grabbing hover:border-indigo-300 hover:shadow"
        >
          <ProcessSymbol state="Online" width={80} height={32} />
          <span className="text-[9px] font-medium text-gray-600">Process</span>
          <span className="text-[8px] text-gray-400">포트 × 2 자동 생성</span>
        </div>

        {/* AGV / AMR */}
        <div
          draggable
          onDragStart={(e) => onDragStart(e, 'agv')}
          className="flex cursor-grab flex-col items-center gap-1 rounded-md border border-gray-200 bg-white p-2 shadow-sm active:cursor-grabbing hover:border-blue-300 hover:shadow"
        >
          {/* AGV 미리보기 */}
          <svg width="64" height="28" viewBox="0 0 80 40">
            <rect x="8" y="10" width="64" height="20" rx="4" fill="#3b82f6" opacity="0.8" />
            <ellipse cx="20" cy="32" rx="7" ry="5" fill="#1e3a5f" />
            <ellipse cx="60" cy="32" rx="7" ry="5" fill="#1e3a5f" />
            <ellipse cx="40" cy="12" rx="8" ry="4" fill="#93c5fd" />
            <polygon points="68,18 76,20 68,22" fill="#bfdbfe" />
            <text x="40" y="23" textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">AGV</text>
          </svg>
          <span className="text-[9px] font-medium text-gray-600">AGV / AMR</span>
          <span className="text-[8px] text-gray-400">이동형 반송 장비</span>
        </div>
      </div>

      {/* Navigation 섹션 */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] font-medium text-gray-500">Navigation</p>

        {/* Node */}
        <div
          draggable
          onDragStart={(e) => onDragStart(e, 'node')}
          className="flex cursor-grab flex-col items-center gap-1 rounded-md border border-gray-200 bg-white p-2 shadow-sm active:cursor-grabbing hover:border-amber-300 hover:shadow"
        >
          <svg width="28" height="28" viewBox="0 0 32 32">
            <polygon points="16,2 30,16 16,30 2,16" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
          </svg>
          <span className="text-[9px] font-medium text-gray-600">Node</span>
          <span className="text-[8px] text-gray-400">AMR 경로 중간 노드</span>
        </div>

        {/* 충전소 */}
        <div
          draggable
          onDragStart={(e) => onDragStart(e, 'charge')}
          className="flex cursor-grab flex-col items-center gap-1 rounded-md border border-gray-200 bg-white p-2 shadow-sm active:cursor-grabbing hover:border-orange-300 hover:shadow"
        >
          <svg width="28" height="28" viewBox="0 0 32 32">
            <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="#f97316" stroke="#c2410c" strokeWidth="1.5" />
            <polygon points="18,5 12,17 16,17 14,27 20,15 16,15" fill="white" opacity="0.9" />
          </svg>
          <span className="text-[9px] font-medium text-gray-600">충전소</span>
          <span className="text-[8px] text-gray-400">AGV 홈 / 시작 위치</span>
        </div>
      </div>

      {/* 사용 안내 */}
      <div className="mt-auto rounded-md border border-blue-100 bg-blue-50 p-2 text-[8px] text-blue-600">
        아이템을 캔버스로 드래그하여 노드를 추가하세요.
      </div>
    </aside>
  );
}
