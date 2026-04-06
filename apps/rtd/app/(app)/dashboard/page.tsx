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
import {
  DUMMY_DAILY_STATS,
  DUMMY_CLASS_STATS,
} from '@/lib/dummy';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();

  // 룰 그룹 수 조회
  const { data: groupRows } = await supabase
    .from('rule_group')
    .select('is_usable');
  const totalGroups = groupRows?.length ?? 0;
  const activeGroups = groupRows?.filter((g) => g.is_usable === 'Y').length ?? 0;

  // 최근 실행 로그 5건 조회
  const { data: recentRows } = await supabase
    .from('rule_running_result')
    .select('uuid, lot_id, rule_id, sequence, count, is_dispatching, start_time')
    .order('start_time', { ascending: false })
    .limit(5);
  const recentResults = (recentRows ?? []).map((r) => ({
    uuid:          r.uuid as string,
    lotId:         r.lot_id as string,
    ruleId:        r.rule_id as string,
    sequence:      r.sequence as number,
    count:         r.count as number,
    isDispatching: r.is_dispatching as string,
    startTime:     r.start_time as string,
  }));

  const todayCount = recentResults.length;
  const dispatchedCount = recentResults.filter((r) => r.isDispatching === 'Y').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">RTD 룰 실행 현황 요약</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">활성 룰 그룹</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{activeGroups}</p>
            <p className="text-xs text-gray-400 mt-1">전체 {totalGroups}개 중</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">오늘 실행 건수</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{todayCount}</p>
            <p className="text-xs text-gray-400 mt-1">디스패칭 적용: {dispatchedCount}건</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">평균 소요시간</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">65ms</p>
            <p className="text-xs text-gray-400 mt-1">최근 7일 평균</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 일별 실행 건수 바 차트 (간이) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">일별 룰 실행 건수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {DUMMY_DAILY_STATS.map((d) => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="w-12 text-xs text-gray-500">{d.date}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded"
                      style={{ width: `${(d.count / 220) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-xs text-right text-gray-700">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 룰 클래스별 평균 소요시간 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">룰 클래스별 평균 소요시간 (ms)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {DUMMY_CLASS_STATS.map((s) => (
                <div key={s.className} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-gray-500">{s.className}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded"
                      style={{ width: `${(s.avgDuration / 150) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-xs text-right text-gray-700">{s.avgDuration}ms</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
              {recentResults.map((r) => (
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
