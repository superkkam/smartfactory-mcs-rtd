'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { EquipmentUtilizationItem } from '@workspace/types/mcs';

interface UtilizationChartProps {
  data: EquipmentUtilizationItem[];
}

const ALG_LABEL: Record<string, string> = {
  astar:  'A*',
  ai_ppo: 'AI(PPO)',
  cbs_ts: 'CBS-TS',
  cactus: 'CACTUS',
};

/** 장비별 가동률 막대 그래프 (N-알고리즘) */
export function UtilizationChart({ data }: UtilizationChartProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600">장비별 가동률 (%)</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
          barCategoryGap="20%"
          barGap={2}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="equipment" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value, name) => [`${value}%`, ALG_LABEL[name as string] ?? name]}
          />
          <Legend
            formatter={(value) => ALG_LABEL[value] ?? value}
            iconSize={10}
            wrapperStyle={{ fontSize: 11 }}
          />
          <Bar dataKey="astar"  name="astar"  fill="#6366f1" radius={[3, 3, 0, 0]} />
          <Bar dataKey="ai_ppo" name="ai_ppo" fill="#10b981" radius={[3, 3, 0, 0]} />
          <Bar dataKey="cbs_ts" name="cbs_ts" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
