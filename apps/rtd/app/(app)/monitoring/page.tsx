'use client';

import { useState } from 'react';
import { Loader2, Search, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRuleRunningResults } from '@/lib/api/rule-running-results';
import { useRunningStats } from '@/lib/api/running-stats';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';

export default function MonitoringPage() {
  const [searchLot, setSearchLot] = useState('');
  const [searchGroup, setSearchGroup] = useState('');
  const [mcsConnected] = useState(false); // TODO: Task 021에서 실제 연동 상태

  // 검색 필터 debounce (300ms)
  const debouncedLot   = useDebouncedValue(searchLot);
  const debouncedGroup = useDebouncedValue(searchGroup);

  const { dailyStats, classStats, hitRateStats } = useRunningStats();

  const {
    data,
    isLoading,
    connectionStatus,
    isRealtimeEnabled,
    toggleRealtime,
  } = useRuleRunningResults({
    lotId:  debouncedLot  || undefined,
    ruleId: debouncedGroup || undefined,
  });

  // 실시간 연결 상태 스타일
  const realtimeStyle = {
    connected:    { border: 'border-green-200 bg-green-50 text-green-700',   icon: <Wifi className="h-4 w-4" />,    label: '실시간 연결됨' },
    connecting:   { border: 'border-yellow-200 bg-yellow-50 text-yellow-700', icon: <Loader2 className="h-4 w-4 animate-spin" />, label: '연결 중...' },
    disconnected: { border: 'border-gray-200 bg-gray-50 text-gray-500',       icon: <WifiOff className="h-4 w-4" />, label: '미연결' },
    error:        { border: 'border-red-200 bg-red-50 text-red-500',          icon: <WifiOff className="h-4 w-4" />, label: '연결 오류' },
  }[connectionStatus];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">모니터링 대시보드</h1>
          <p className="text-sm text-gray-500 mt-1">F008 · F009 · F010</p>
        </div>

        {/* MCS 연동 상태 */}
        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
          mcsConnected
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-gray-200 bg-gray-50 text-gray-500'
        }`}>
          {mcsConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          MCS 연동: {mcsConnected ? '연결됨' : '미연결'}
        </div>
      </div>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">실행 로그</TabsTrigger>
          <TabsTrigger value="stats">통계</TabsTrigger>
        </TabsList>

        {/* 실행 로그 탭 */}
        <TabsContent value="logs" className="space-y-4 pt-4">
          {/* 검색 필터 + 실시간 연결 버튼 */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-8"
                placeholder="Lot ID 검색"
                value={searchLot}
                onChange={(e) => setSearchLot(e.target.value)}
              />
            </div>
            <Input
              className="max-w-xs"
              placeholder="룰 ID 필터"
              value={searchGroup}
              onChange={(e) => setSearchGroup(e.target.value)}
            />

            {/* 실시간 연결 상태 + 토글 버튼 */}
            <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${realtimeStyle.border}`}>
              {realtimeStyle.icon}
              {realtimeStyle.label}
            </div>
            <Button
              variant={isRealtimeEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={toggleRealtime}
            >
              {isRealtimeEnabled ? '실시간 끄기' : '실시간 연결'}
            </Button>
          </div>

          {/* 로그 테이블 */}
          <Card>
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
                    <TableHead>소요시간</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                      </TableCell>
                    </TableRow>
                  ) : data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                        실행 로그가 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map((r) => {
                      const duration =
                        new Date(r.endTime).getTime() - new Date(r.startTime).getTime();
                      return (
                        <TableRow key={r.uuid}>
                          <TableCell className="font-mono text-sm">{r.lotId}</TableCell>
                          <TableCell className="text-sm">{r.ruleId}</TableCell>
                          <TableCell className="text-sm">#{r.sequence}</TableCell>
                          <TableCell className="text-sm">{r.count}건</TableCell>
                          <TableCell>
                            <Badge variant={r.isDispatching === 'Y' ? 'default' : 'secondary'}>
                              {r.isDispatching === 'Y' ? '적용' : '미적용'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {new Date(r.startTime).toLocaleTimeString('ko-KR')}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">{duration}ms</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 통계 탭 — Task 020에서 실데이터로 교체 예정 */}
        <TabsContent value="stats" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 일별 실행 건수 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">일별 실행 건수 추이 (최근 7일)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(() => {
                    const maxCount = Math.max(...dailyStats.map((d) => d.count), 1);
                    return dailyStats.map((d) => (
                      <div key={d.date} className="flex items-center gap-3">
                        <span className="w-12 text-xs text-gray-500">{d.date}</span>
                        <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded transition-all"
                            style={{ width: `${(d.count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-xs text-right text-gray-700">{d.count}</span>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* 룰 클래스별 소요시간 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">룰 클래스별 평균 소요시간 (ms)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {classStats.length === 0 ? (
                    <p className="text-sm text-gray-400">데이터가 없습니다</p>
                  ) : (() => {
                    const maxDur = Math.max(...classStats.map((s) => s.avgDuration), 1);
                    return classStats.map((s) => (
                      <div key={s.className} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">{s.className}</span>
                          <span className="text-gray-500">{s.avgDuration}ms</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded"
                            style={{ width: `${(s.avgDuration / maxDur) * 100}%` }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* 히트율 순위 */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">룰 히트율 순위</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>순위</TableHead>
                      <TableHead>룰 이름</TableHead>
                      <TableHead>실행 건수</TableHead>
                      <TableHead>히트율</TableHead>
                      <TableHead>히트율 시각화</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hitRateStats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                          데이터가 없습니다
                        </TableCell>
                      </TableRow>
                    ) : hitRateStats.map((s, idx) => (
                      <TableRow key={s.ruleName}>
                        <TableCell className="font-medium text-gray-400">#{idx + 1}</TableCell>
                        <TableCell className="font-medium">{s.ruleName}</TableCell>
                        <TableCell className="text-sm text-gray-600">{s.count}건</TableCell>
                        <TableCell>
                          <Badge variant={s.hitRate >= 80 ? 'default' : 'secondary'}>
                            {s.hitRate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="w-48">
                          <div className="h-2 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded"
                              style={{ width: `${s.hitRate}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
