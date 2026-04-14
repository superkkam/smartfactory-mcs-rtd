import {
  BarChart3,
  FlaskConical,
  FolderTree,
  GitBranch,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';

/** 사이드바 메뉴 아이템 타입 */
export interface NavItem {
  title: string;
  href?: string;
  icon: LucideIcon;
  children?: Omit<NavItem, 'children'>[];
}

/** RTD 앱 사이드바 메뉴 구조 */
export const NAV_ITEMS: NavItem[] = [
  {
    title: '대시보드',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: '룰 빌더',
    icon: GitBranch,
    children: [
      {
        title: '룰 그룹 관리',
        href: '/rule-groups',
        icon: FolderTree,
      },
    ],
  },
  {
    title: '시뮬레이터',
    href: '/simulator',
    icon: FlaskConical,
  },
  {
    title: '모니터링',
    href: '/monitoring',
    icon: BarChart3,
  },
];
