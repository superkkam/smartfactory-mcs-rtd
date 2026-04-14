'use client';

import { Activity, AlertTriangle, Package, Truck } from 'lucide-react';
import { useEquipmentsByLayout } from '@/lib/api/equipment';
import { useCarriers } from '@/lib/api/carriers';
import { useActiveMacroCommands } from '@/lib/api/macro-commands';

interface StatCardProps {
  title: string;
  value: number;
  label: string;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'yellow' | 'red';
}

function StatCard({ title, value, label, icon, color }: StatCardProps) {
  const colors = {
    green:  'bg-green-50  text-green-600  border-green-200',
    blue:   'bg-blue-50   text-blue-600   border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    red:    'bg-red-50    text-red-600    border-red-200',
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}

interface StatsCardsProps {
  layoutId?: string;
}

/** 대시보드 상단 통계 카드 4개 — 실데이터 바인딩 */
export function StatsCards({ layoutId }: StatsCardsProps) {
  const { data: equipments = [] } = useEquipmentsByLayout(layoutId ?? '');
  const { data: carriers = [] }   = useCarriers();
  const { data: activeCommands = [] } = useActiveMacroCommands();

  const onlineCount       = equipments.filter((e) => e.state === 'Online').length;
  const errorCount        = equipments.filter((e) => e.state === 'Error').length;
  const transferringCount = carriers.filter((c) => c.state === 'Transferring').length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        title="온라인 장비"
        value={onlineCount}
        label={`전체 ${equipments.length}대 중`}
        icon={<Activity className="h-5 w-5" />}
        color="green"
      />
      <StatCard
        title="이동 중 캐리어"
        value={transferringCount}
        label={`전체 ${carriers.length}개 중`}
        icon={<Package className="h-5 w-5" />}
        color="blue"
      />
      <StatCard
        title="진행 중 명령"
        value={activeCommands.length}
        label="MacroCommand"
        icon={<Truck className="h-5 w-5" />}
        color="yellow"
      />
      <StatCard
        title="에러 장비"
        value={errorCount}
        label="즉시 확인 필요"
        icon={<AlertTriangle className="h-5 w-5" />}
        color="red"
      />
    </div>
  );
}
