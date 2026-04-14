'use client';

import { Eye, EyeOff, Save, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Layout } from '@workspace/types/mcs';

interface ToolbarProps {
  relationsVisible:  boolean;
  onToggleRelations: () => void;
  onSave:            () => void;
  nodeCount:         number;
  edgeCount:         number;
  /** 현재 편집 중인 레이아웃 id (null = 신규) */
  currentLayoutId:   string | null;
  onVersionChange:   (layoutId: string) => void;
  /** Supabase에서 로드한 레이아웃 목록 */
  layouts:           Layout[];
  isLoading?:        boolean;
}

/**
 * 레이아웃 모델러 하단 툴바
 * - 릴레이션 보기/숨기기 토글
 * - 저장 + 레이아웃 버전 선택 드롭다운 (실데이터)
 * - 현재 레이아웃 통계 (노드/엣지 수)
 */
export function Toolbar({
  relationsVisible,
  onToggleRelations,
  onSave,
  nodeCount,
  edgeCount,
  currentLayoutId,
  onVersionChange,
  layouts,
  isLoading,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-3 border-t border-gray-200 bg-white px-4 py-2">
      {/* 릴레이션 토글 */}
      <button
        onClick={onToggleRelations}
        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
          relationsVisible
            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        {relationsVisible ? (
          <><Eye className="h-3.5 w-3.5" /> 릴레이션 표시</>
        ) : (
          <><EyeOff className="h-3.5 w-3.5" /> 릴레이션 숨김</>
        )}
      </button>

      <div className="h-4 w-px bg-gray-200" />

      {/* 레이아웃 버전 드롭다운 */}
      <div className="flex items-center gap-1.5">
        <ChevronDown className="h-3 w-3 text-gray-400" />
        <Select
          value={currentLayoutId ?? '__new__'}
          onValueChange={(v) => { if (v) onVersionChange(v); }}
          disabled={isLoading}
        >
          <SelectTrigger className="h-7 w-52 border-gray-300 text-xs text-gray-700">
            <SelectValue placeholder={isLoading ? '로딩 중...' : '레이아웃 선택'}>
              {(value: string | null) => {
                if (!value || value === '__new__') return '+ 새 레이아웃';
                const l = layouts.find((x) => x.id === value);
                return l ? `${l.designName} v${l.version}` : '레이아웃 선택';
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {/* 신규 레이아웃 항목 */}
            <SelectItem value="__new__" label="+ 새 레이아웃" className="text-xs font-medium text-indigo-600">
              + 새 레이아웃
            </SelectItem>
            {/* 저장된 레이아웃 목록 */}
            {layouts.map((layout) => (
              <SelectItem
                key={layout.id}
                value={layout.id}
                label={`${layout.designName} v${layout.version}`}
                className="text-xs"
              >
                {layout.designName}
                <span className="ml-1.5 text-[10px] text-gray-400">v{layout.version}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 저장 */}
      <button
        onClick={onSave}
        className="flex items-center gap-1.5 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
      >
        <Save className="h-3.5 w-3.5" />
        저장
      </button>

      {/* 레이아웃 통계 */}
      <div className="ml-auto flex items-center gap-3 text-[10px] text-gray-400">
        <span>노드 {nodeCount}개</span>
        <span>엣지 {edgeCount}개</span>
        <span className="rounded bg-amber-50 px-2 py-0.5 text-[9px] text-amber-600">
          snapToGrid 활성
        </span>
      </div>
    </div>
  );
}
