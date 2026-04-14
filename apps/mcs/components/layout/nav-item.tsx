'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { NavItem as NavItemType } from './sidebar-constants';

interface NavItemProps {
  item: NavItemType;
  /** true이면 정확한 경로 일치만 active 처리 (아코디언 하위 항목용) */
  exactMatch?: boolean;
}

/**
 * 사이드바 네비게이션 메뉴 아이템
 * 하위 메뉴가 있는 경우 아코디언으로 확장
 */
export function NavItem({ item, exactMatch = false }: NavItemProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(() => {
    // 하위 경로에 있으면 기본으로 열림
    if (item.children) {
      return item.children.some((child) => {
        if (!child.href) return false;
        const base = child.href.split('/').slice(0, 2).join('/');
        return pathname === child.href || pathname.startsWith(base + '/');
      });
    }
    return false;
  });

  // exactMatch=true이면 정확한 경로만, 아니면 하위 경로도 포함
  const isActive = item.href
    ? exactMatch
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + '/')
    : false;
  const Icon = item.icon;

  // 하위 메뉴가 있는 경우
  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.title}</span>
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        {isOpen && (
          <div className="ml-4 mt-1 space-y-1 border-l border-gray-200 pl-3">
            {item.children.map((child) => (
              <NavItem key={child.href ?? child.title} item={child} exactMatch />
            ))}
          </div>
        )}
      </div>
    );
  }

  // 일반 링크
  return (
    <Link
      href={item.href ?? '#'}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.title}</span>
    </Link>
  );
}
