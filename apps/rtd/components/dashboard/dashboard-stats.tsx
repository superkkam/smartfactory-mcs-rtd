'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRunningStats } from '@/lib/api/running-stats';
import { Loader2 } from 'lucide-react';

function useDashboardStats() {
  const { dailyStats, classStats, isLoading } = useRunningStats();

  const today = (() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  })();

  const todayCount = dailyStats.find((d) => d.date === today)?.count ?? 0;
  const avgDuration = classStats.length > 0
    ? Math.round(classStats.reduce((sum, s) => sum + s.avgDuration, 0) / classStats.length)
    : null;

  return { dailyStats, classStats, todayCount, avgDuration, isLoading };
}

/** 요약 카드: 오늘 실행 건수 + 평균 소요시간 (2개, sm:grid-cols-3 내부 col-span-2) */
export function DashboardSummaryCards() {
  const { todayCount, avgDuration, isLoading } = useDashboardStats();

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">오늘 실행 건수</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading
            ? <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            : <p className="text-3xl font-bold text-gray-900">{todayCount}</p>
          }
          <p className="text-xs text-gray-400 mt-1">최근 7일 기준</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">평균 소요시간</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading
            ? <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            : <p className="text-3xl font-bold text-gray-900">
                {avgDuration !== null ? `${avgDuration}ms` : '—'}
              </p>
          }
          <p className="text-xs text-gray-400 mt-1">룰 클래스 전체 평균</p>
        </CardContent>
      </Card>
    </>
  );
}

/** 일별 룰 실행 건수 차트 */
export function DashboardDailyChart() {
  const { dailyStats, isLoading } = useDashboardStats();
  const maxCount = Math.max(...dailyStats.map((d) => d.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">일별 룰 실행 건수</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : dailyStats.every((d) => d.count === 0) ? (
          <p className="py-6 text-center text-sm text-gray-400">최근 7일 실행 기록 없음</p>
        ) : (
          <div className="space-y-2">
            {dailyStats.map((d) => (
              <div key={d.date} className="flex items-center gap-3">
                <span className="w-12 text-xs text-gray-500">{d.date}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded transition-all"
                    style={{ width: `${(d.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-xs text-right text-gray-700">{d.count}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** 룰 클래스별 평균 소요시간 차트 */
export function DashboardClassChart() {
  const { classStats, isLoading } = useDashboardStats();
  const maxDuration = Math.max(...classStats.map((s) => s.avgDuration), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">룰 클래스별 평균 소요시간 (ms)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : classStats.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">데이터 없음</p>
        ) : (
          <div className="space-y-3">
            {classStats.map((s) => (
              <div key={s.className} className="flex items-center gap-3">
                <span className="w-24 text-xs text-gray-500 truncate">{s.className}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded transition-all"
                    style={{ width: `${(s.avgDuration / maxDuration) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-xs text-right text-gray-700">{s.avgDuration}ms</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
