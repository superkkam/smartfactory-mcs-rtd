import {
  BarChart2,
  LayoutDashboard,
  Map,
  PlayCircle,
  Settings,
  Truck,
  type LucideIcon,
} from 'lucide-react';

/** 사이드바 메뉴 아이템 타입 */
export interface NavItem {
  title: string;
  href?: string;
  icon: LucideIcon;
  children?: Omit<NavItem, 'children'>[];
}

/** MCS 앱 사이드바 메뉴 구조 */
export const NAV_ITEMS: NavItem[] = [
  {
    title: '대시보드',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: '레이아웃 모델러',
    href: '/layout-modeler',
    icon: Map,
  },
  {
    title: '반송 제어',
    href: '/transfer-control',
    icon: Truck,
  },
  {
    title: '시뮬레이션',
    icon: PlayCircle,
    children: [
      {
        title: '시나리오 실행',
        href: '/simulation',
        icon: PlayCircle,
      },
      {
        title: '결과 분석',
        href: '/simulation/result',
        icon: BarChart2,
      },
      {
        title: '환경 설정',
        href: '/simulation/settings',
        icon: Settings,
      },
    ],
  },
];
