'use client';

import { useState, useMemo } from 'react';
import { Loader2, Search, Wifi, WifiOff, ArrowRight, Package, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import { useMcsHealth } from '@/lib/api/mcs-health';
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
import type { RuleRunningResult } from '@workspace/types/rtd';

function SequenceRowsTable({ rows }: { rows: Record<string, unknown>[] }) {
  const [page, setPage] = useState(0);
  const PAGE = 5;
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0]);
  const totalPages = Math.ceil(rows.length / PAGE);
  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE);

  return (
    <div className="mt-2 overflow-x-auto rounded border border-gray-100">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 text-gray-600">
            {cols.map((c) => (
              <th key={c} className="px-2.5 py-1.5 text-left font-medium whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((r, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
              {cols.map((c) => (
                <td key={c} className="px-2.5 py-1.5 font-mono text-gray-700 whitespace-nowrap max-w-[180px] truncate">
                  {r[c] === null || r[c] === undefined
                    ? <span className="text-gray-300 italic">null</span>
                    : String(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-3 py-1">
          <span className="text-xs text-gray-400">총 {rows.length}건</span>
          <div className="flex items-center gap-1">
            <button
              className="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-40"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >‹</button>
            <span className="text-xs text-gray-500">{page + 1}/{totalPages}</span>
            <button
              className="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-40"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >›</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** lot_id + 1분 이내 시간 기준으로 동일 디스패칭 이벤트로 묶음 */
interface DispatchEvent {
  key: string;
  lotId: string;
  destEquipmentId: string | null;
  startTime: string;
  sequences: RuleRunningResult[];
  isDispatching: boolean;
}

function groupToEvents(rows: RuleRunningResult[]): DispatchEvent[] {
  const events: DispatchEvent[] = [];
  const sorted = [...rows].sort((a, b) => a.startTime.localeCompare(b.startTime));

  for (const row of sorted) {
    const t = new Date(row.startTime).getTime();
    // 마지막 추가된 row의 시간 기준 5초 이내 → 같은 디스패칭 실행으로 간주
    // (60초 기준이면 같은 lot에 대해 여러 번 실행 시 합쳐져 중복 표시됨)
    const existing = events.find((e) => {
      if (e.lotId !== row.lotId) return false;
      const lastSeqTime = new Date(e.sequences[e.sequences.length - 1].startTime).getTime();
      return Math.abs(lastSeqTime - t) < 5_000;
    });
    if (existing) {
      // uuid 중복 방지
      if (!existing.sequences.some((s) => s.uuid === row.uuid)) {
        existing.sequences.push(row);
      }
      if (row.isDispatching === 'Y') {
        existing.isDispatching = true;
        existing.destEquipmentId = row.destEquipmentId ?? existing.destEquipmentId;
      }
    } else {
      events.push({
        key: row.uuid,
        lotId: row.lotId,
        destEquipmentId: row.destEquipmentId ?? null,
        startTime: row.startTime,
        sequences: [row],
        isDispatching: row.isDispatching === 'Y',
      });
    }
  }

  // 최신순 정렬
  return events.sort((a, b) => b.startTime.localeCompare(a.startTime));
}

function SeqDetail({
  seq,
  dur,
  isDispatching,
}: {
  seq: RuleRunningResult;
  dur: number;
  isDispatching: boolean;
}) {
  const [rowsOpen, setRowsOpen] = useState(false);
  const hasRows = seq.resultRows && seq.resultRows.length > 0;

  return (
    <div className={`px-4 py-3 ${isDispatching ? 'bg-blue-50/40' : ''}`}>
      {/* 시퀀스 헤더 */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-gray-400 w-8">#{seq.sequence}</span>

        {/* 블록 이름 (없으면 ruleId 축약) */}
        <span className="text-sm font-medium text-gray-800 flex-1">
          {seq.ruleName ?? seq.ruleId.slice(0, 8) + '…'}
        </span>

        <span className="text-xs text-gray-500">{seq.count}건</span>
        <span className="text-xs text-gray-400">{dur}ms</span>

        {isDispatching ? (
          <div className="flex items-center gap-1.5">
            <Badge variant="default" className="text-xs">디스패칭</Badge>
            {seq.destEquipmentId && (
              <span className="text-xs text-emerald-600 font-mono">→ {seq.destEquipmentId}</span>
            )}
          </div>
        ) : (
          <Badge variant="secondary" className="text-xs">통과</Badge>
        )}

        {hasRows && (
          <button
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
            onClick={() => setRowsOpen((v) => !v)}
          >
            {rowsOpen
              ? <><ChevronDown className="h-3 w-3" /> 데이터 닫기</>
              : <><ChevronRight className="h-3 w-3" /> 데이터 보기</>
            }
          </button>
        )}
      </div>

      {/* 결과 rows */}
      {rowsOpen && hasRows && (
        <SequenceRowsTable rows={seq.resultRows!} />
      )}
    </div>
  );
}

function DispatchEventCard({ event }: { event: DispatchEvent }) {
  const [open, setOpen] = useState(false);
  const duration =
    event.sequences.length > 0
      ? new Date(event.sequences[event.sequences.length - 1].endTime).getTime() -
        new Date(event.sequences[0].startTime).getTime()
      : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* 이벤트 헤더 — 디스패칭 결과 요약 */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}

        {/* 캐리어 → 목적지 */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1">
            <Package className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span className="text-xs font-mono font-medium text-blue-800 truncate max-w-[140px]">
              {event.lotId || '—'}
            </span>
          </div>

          <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />

          <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1">
            <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-xs font-mono font-medium text-emerald-800 truncate max-w-[140px]">
              {event.destEquipmentId || '목적지 없음'}
            </span>
          </div>

          <Badge
            variant={event.isDispatching ? 'default' : 'secondary'}
            className="shrink-0 text-xs"
          >
            {event.isDispatching ? '디스패칭' : '미적용'}
          </Badge>
        </div>

        {/* 메타 */}
        <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
          <span>{event.sequences.length}개 시퀀스</span>
          <span>{duration}ms</span>
          <span>{new Date(event.startTime).toLocaleTimeString('ko-KR')}</span>
        </div>
      </button>

      {/* 시퀀스별 상세 */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {event.sequences
            .sort((a, b) => a.sequence - b.sequence)
            .map((seq) => {
              const dur = new Date(seq.endTime).getTime() - new Date(seq.startTime).getTime();
              const isDispatching = seq.isDispatching === 'Y';
              return (
                <SeqDetail key={seq.uuid} seq={seq} dur={dur} isDispatching={isDispatching} />
              );
            })}
        </div>
      )}
    </div>
  );
}

export default function MonitoringPage() {
  const [searchLot, setSearchLot] = useState('');
  const [searchGroup, setSearchGroup] = useState('');
  const { connected: mcsConnected } = useMcsHealth();

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

  const dispatchEvents = useMemo(() => groupToEvents(data), [data]);

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

      <Tabs defaultValue="dispatch">
        <TabsList>
          <TabsTrigger value="dispatch">디스패칭 이벤트</TabsTrigger>
          <TabsTrigger value="logs">실행 로그 (raw)</TabsTrigger>
          <TabsTrigger value="stats">통계</TabsTrigger>
        </TabsList>

        {/* 디스패칭 이벤트 탭 */}
        <TabsContent value="dispatch" className="space-y-3 pt-4">
          {/* 검색 + 실시간 연결 */}
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

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : dispatchEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
              디스패칭 이벤트가 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {dispatchEvents.map((event) => (
                <DispatchEventCard key={event.key} event={event} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* 실행 로그 탭 (raw) */}
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
                    <TableHead>블록 이름</TableHead>
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
                          <TableCell className="text-sm">
                            {r.ruleName ?? <span className="text-gray-400 font-mono text-xs">{r.ruleId.slice(0, 8)}…</span>}
                          </TableCell>
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
