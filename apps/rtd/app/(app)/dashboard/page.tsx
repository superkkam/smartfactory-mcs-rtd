'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { useRuleGroups } from '@/lib/api/rule-groups';
import { useRuleRunningResults } from '@/lib/api/rule-running-results';
import {
  DashboardSummaryCards,
  DashboardDailyChart,
  DashboardClassChart,
} from '@/components/dashboard/dashboard-stats';

export default function DashboardPage() {
  const { data: groups = [], isLoading: groupsLoading } = useRuleGroups();
  const { data: recentResults = [], isLoading: resultsLoading } = useRuleRunningResults({});

  const totalGroups  = groups.length;
  const activeGroups = groups.filter((g) => g.isUsable === 'Y').length;

  // 최근 5건만 표시
  const recentFive = recentResults.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">RTD 룰 실행 현황 요약</p>
      </div>

      {/* 요약 카드 3열 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* 활성 룰 그룹 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">활성 룰 그룹</CardTitle>
          </CardHeader>
          <CardContent>
            {groupsLoading
              ? <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
              : <p className="text-3xl font-bold text-gray-900">{activeGroups}</p>
            }
            <p className="text-xs text-gray-400 mt-1">전체 {totalGroups}개 중</p>
          </CardContent>
        </Card>

        {/* 오늘 실행 건수 + 평균 소요시간 — 실데이터 */}
        <DashboardSummaryCards />
      </div>

      {/* 차트 2열 — 실데이터 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardDailyChart />
        <DashboardClassChart />
      </div>

      {/* 최근 실행 로그 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">최근 실행 로그</CardTitle>
          <Link href="/monitoring" className="text-sm text-blue-600 hover:underline">
            전체 보기 →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot ID</TableHead>
                <TableHead>룰 ID</TableHead>
                <TableHead>시퀀스</TableHead>
                <TableHead>결과 건수</TableHead>
                <TableHead>디스패칭</TableHead>
                <TableHead>시작 시간</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                  </TableCell>
                </TableRow>
              ) : recentFive.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-gray-400">
                    실행 로그가 없습니다
                  </TableCell>
                </TableRow>
              ) : recentFive.map((r) => (
                <TableRow key={r.uuid}>
                  <TableCell className="font-mono text-sm">{r.lotId}</TableCell>
                  <TableCell className="text-sm">{r.ruleId}</TableCell>
                  <TableCell className="text-sm">{r.sequence}</TableCell>
                  <TableCell className="text-sm">{r.count}</TableCell>
                  <TableCell>
                    <Badge variant={r.isDispatching === 'Y' ? 'default' : 'secondary'}>
                      {r.isDispatching === 'Y' ? '적용' : '미적용'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {new Date(r.startTime).toLocaleTimeString('ko-KR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 바로가기 */}
      <div className="flex gap-3">
        <Link
          href="/rule-groups"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          룰 빌더 →
        </Link>
        <Link
          href="/monitoring"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          모니터링 →
        </Link>
      </div>
    </div>
  );
}
