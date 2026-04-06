'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useRuleGroup, useUpdateRuleGroup } from '@/lib/api/rule-groups';
import type {
  SimulationResponse,
  SimulationSequenceResult,
  ValidationIssue,
} from '@workspace/types/rtd';

export default function SimulatorPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);
  const { data: group, isLoading: groupLoading } = useRuleGroup(groupId);
  const updateGroup = useUpdateRuleGroup();

  const [equipId, setEquipId] = useState('STK01');
  const [eventType, setEventType] = useState('EVT_FULL');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SimulationSequenceResult[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [valid, setValid] = useState(true);
  const [totalDuration, setTotalDuration] = useState(0);
  const [error, setError] = useState('');

  async function handleRun() {
    if (!equipId || !eventType) {
      setError('장비 ID와 이벤트 유형을 입력하세요.');
      return;
    }
    setError('');
    setRunning(true);
    setResults([]);
    setValidationIssues([]);

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleGroupId: groupId, equipId, eventType }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error ?? `서버 오류 (${res.status})`);
      }

      const data: SimulationResponse = await res.json();
      setResults(data.results);
      setValidationIssues(data.validationIssues);
      setValid(data.valid);
      setTotalDuration(data.totalDuration);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setRunning(false);
    }
  }

  async function handleActivate() {
    if (!group) return;
    await updateGroup.mutateAsync({ ruleGroupId: groupId, isUsable: 'Y' });
    alert('룰 그룹이 활성화되었습니다.');
  }

  const errorIssues   = validationIssues.filter((i) => i.severity === 'error');
  const warningIssues = validationIssues.filter((i) => i.severity === 'warning');

  if (groupLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/rule-groups">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">룰 시뮬레이터</h1>
          <p className="text-sm text-gray-500">{group?.ruleGroupName ?? groupId}</p>
        </div>
        <Badge variant="outline">dry-run</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 입력 패널 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">테스트 입력값</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>룰 그룹</Label>
              <Input value={group?.ruleGroupName ?? groupId} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>장비 ID</Label>
              <Input
                value={equipId}
                onChange={(e) => setEquipId(e.target.value)}
                placeholder="STK01"
              />
            </div>
            <div className="space-y-1.5">
              <Label>이벤트 유형</Label>
              <Input
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                placeholder="EVT_FULL"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button className="w-full" onClick={handleRun} disabled={running}>
              <Play className="h-4 w-4 mr-1" />
              {running ? '실행 중...' : '시뮬레이션 실행'}
            </Button>

            <p className="text-xs text-gray-400 text-center">
              실제 DB 데이터 기반 · 디스패칭 미수행
            </p>
          </CardContent>
        </Card>

        {/* 결과 패널 */}
        <div className="lg:col-span-2 space-y-4">
          {results.length > 0 && (
            <>
              {/* 유효성 배너 */}
              <div className={`flex items-center gap-2 rounded-md border px-4 py-3 ${
                !valid
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : warningIssues.length > 0
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-green-200 bg-green-50 text-green-700'
              }`}>
                {!valid ? (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                ) : warningIssues.length > 0 ? (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle className="h-4 w-4 shrink-0" />
                )}
                <p className="text-sm font-medium">
                  {!valid
                    ? `유효성 오류 ${errorIssues.length}건 — 확인 필요`
                    : warningIssues.length > 0
                      ? `경고 ${warningIssues.length}건 (실행 가능)`
                      : '유효성 검사 통과'}
                </p>
                <span className="ml-auto text-xs opacity-70">{totalDuration}ms</span>
              </div>

              {/* 유효성 이슈 목록 */}
              {validationIssues.length > 0 && (
                <div className="space-y-1">
                  {validationIssues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 rounded px-3 py-1.5 text-xs ${
                        issue.severity === 'error'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {issue.severity === 'error'
                        ? <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        : <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      }
                      {issue.message}
                    </div>
                  ))}
                </div>
              )}

              {/* 시퀀스별 결과 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">시퀀스별 실행 결과</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>시퀀스</TableHead>
                        <TableHead>룰 이름</TableHead>
                        <TableHead>유형</TableHead>
                        <TableHead>쿼리</TableHead>
                        <TableHead>결과 건수</TableHead>
                        <TableHead>소요시간</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r) => (
                        <TableRow key={r.sequence}>
                          <TableCell className="font-medium">#{r.sequence}</TableCell>
                          <TableCell className="text-sm">{r.ruleName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{r.ruleType}</Badge>
                          </TableCell>
                          <TableCell>
                            {r.hasQuery ? (
                              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5 text-gray-300" />
                            )}
                          </TableCell>
                          <TableCell>
                            {r.count === null ? (
                              <Badge variant="secondary" className="text-xs">쿼리 없음</Badge>
                            ) : (
                              <span className={r.count === 0 ? 'text-red-500 font-medium' : 'text-gray-900'}>
                                {r.count}건
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{r.duration}ms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Button
                variant="outline"
                className="w-full"
                disabled={!valid || updateGroup.isPending}
                onClick={handleActivate}
              >
                {updateGroup.isPending ? '적용 중...' : '즉시 적용 (룰 활성화)'}
              </Button>
            </>
          )}

          {results.length === 0 && !running && (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-200 text-gray-400">
              <p className="text-sm">시뮬레이션을 실행하면 결과가 여기에 표시됩니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
