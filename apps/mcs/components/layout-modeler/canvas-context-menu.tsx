'use client';

import { useEffect, useRef } from 'react';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  selectedPortCount: number;
  onBatchRoute: () => void;
  onClose: () => void;
}

/**
 * 레이아웃 모델러 우클릭 컨텍스트 메뉴
 * - Port 노드 2개 이상 선택 시 "경로 일괄 생성" 메뉴 활성화
 * - 외부 클릭 시 자동 닫힘
 */
export function CanvasContextMenu({
  x,
  y,
  selectedPortCount,
  onBatchRoute,
  onClose,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  /* 외부 클릭 시 닫힘 */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  /* ESC 키 닫힘 */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const canBatchRoute = selectedPortCount >= 2;

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9999 }}
      className="min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
    >
      {/* 선택된 포트 수 표시 */}
      <div className="border-b border-gray-100 px-3 py-1.5">
        <p className="text-[10px] text-gray-400">
          Port {selectedPortCount}개 선택됨
        </p>
      </div>

      {/* 경로 일괄 생성 */}
      <button
        onClick={() => {
          if (!canBatchRoute) return;
          onBatchRoute();
        }}
        disabled={!canBatchRoute}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
          canBatchRoute
            ? 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
            : 'cursor-not-allowed text-gray-300'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        경로 일괄 생성
        {!canBatchRoute && (
          <span className="ml-auto text-[9px] text-gray-300">2개 이상 선택</span>
        )}
      </button>
    </div>
  );
}
