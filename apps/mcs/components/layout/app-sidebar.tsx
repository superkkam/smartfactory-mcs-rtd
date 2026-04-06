'use client';

import { NavItem } from './nav-item';
import { NAV_ITEMS } from './sidebar-constants';

/**
 * MCS 앱 사이드바 컴포넌트
 * 데스크탑 고정 좌측 사이드바
 */
export function AppSidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white flex flex-col h-full">
      {/* 로고 영역 */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600">
          <span className="text-sm font-bold text-white">M</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">MCS 물류 모델링</p>
          <p className="text-xs text-gray-500">공장 물류 경로 최적화</p>
        </div>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.title}>
              <NavItem item={item} />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
