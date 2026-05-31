'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useRuleDefs } from './rule-defs';

// ── 타입 ──────────────────────────────────────────────────
export interface DailyStat  { date: string; count: number }
export interface ClassStat  { className: string; avgDuration: number }
export interface HitRateStat { ruleName: string; hitRate: number; count: number }

/** 최근 7일 rule_running_result raw row */
interface RawRow {
  rule_id:        string;
  lot_id:         string;
  start_time:     string;
  end_time:       string;
  is_dispatching: string;
}

/**
 * lot_id + 5초 윈도우 기준으로 row를 디스패칭 이벤트 단위로 묶어
 * 날짜별 이벤트 수를 반환한다.
 * (시퀀스 row 여러 개 → 1 디스패칭 이벤트)
 */
function countEventsByDate(rows: RawRow[]): Map<string, number> {
  // (lotId, lastTime) → 대표 날짜 key 목록
  const events: { lotId: string; lastTime: number; dateKey: string }[] = [];

  const sorted = [...rows].sort((a, b) => a.start_time.localeCompare(b.start_time));

  for (const r of sorted) {
    const t = new Date(r.start_time).getTime();
    const existing = events.find(
      (e) => e.lotId === r.lot_id && Math.abs(e.lastTime - t) < 5_000,
    );
    if (existing) {
      existing.lastTime = t;
    } else {
      const d = new Date(r.start_time);
      const dateKey = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
      events.push({ lotId: r.lot_id, lastTime: t, dateKey });
    }
  }

  const map = new Map<string, number>();
  for (const e of events) {
    map.set(e.dateKey, (map.get(e.dateKey) ?? 0) + 1);
  }
  return map;
}

/**
 * 실행 통계 집계 훅 (최근 7일 기준).
 * - Supabase JS는 GROUP BY 미지원 → 클라이언트에서 JS 집계
 * - rule_def 정보를 활용해 클래스명·룰명 매핑
 */
export function useRunningStats() {
  const { data: rows = [], isLoading: rowsLoading } = useQuery<RawRow[]>({
    queryKey: ['running_stats_raw'],
    queryFn: async () => {
      const supabase = createClient();
      // RLS에서 date 필터가 차단되는 경우를 우회 — 최근 500건 조회 후 JS에서 필터
      const { data, error } = await supabase
        .from('rule_running_result')
        .select('rule_id, lot_id, start_time, end_time, is_dispatching')
        .order('start_time', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as RawRow[];
    },
  });

  // 최근 7일 범위를 JS에서 필터링
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentRows = rows.filter((r) => new Date(r.start_time).getTime() >= since);

  const { data: ruleDefs = [], isLoading: defsLoading } = useRuleDefs();

  // ruleId → ruleName, ruleClassId 매핑 테이블
  const ruleMap = useMemo(() => {
    const m = new Map<string, { name: string; classId: string }>();
    for (const d of ruleDefs) {
      m.set(d.ruleId, { name: d.ruleName, classId: d.ruleClassId });
    }
    return m;
  }, [ruleDefs]);

  // ── 일별 실행 건수 (최근 7일, 디스패칭 이벤트 단위) ────────────────────────────
  const dailyStats = useMemo<DailyStat[]>(() => {
    // 날짜 슬롯 초기화 (데이터 없는 날도 0으로 표시)
    const map = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
      map.set(key, 0);
    }

    // lot_id + 5초 윈도우로 묶인 이벤트 수를 날짜별로 합산
    const eventCounts = countEventsByDate(recentRows);
    for (const [dateKey, cnt] of eventCounts) {
      if (map.has(dateKey)) map.set(dateKey, cnt);
    }

    return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
  }, [recentRows]);

  // ── 룰 클래스별 평균 소요시간 ────────────────────────────
  const classStats = useMemo<ClassStat[]>(() => {
    const map = new Map<string, { totalMs: number; count: number }>();

    for (const r of recentRows) {
      const classId = ruleMap.get(r.rule_id)?.classId ?? r.rule_id;
      const ms = new Date(r.end_time).getTime() - new Date(r.start_time).getTime();
      const prev = map.get(classId) ?? { totalMs: 0, count: 0 };
      map.set(classId, { totalMs: prev.totalMs + ms, count: prev.count + 1 });
    }

    return Array.from(map.entries())
      .map(([className, { totalMs, count }]) => ({
        className,
        avgDuration: Math.round(totalMs / count),
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration);
  }, [recentRows, ruleMap]);

  // ── 룰별 히트율 순위 ────────────────────────────────────
  const hitRateStats = useMemo<HitRateStat[]>(() => {
    const map = new Map<string, { total: number; hit: number }>();

    for (const r of recentRows) {
      const prev = map.get(r.rule_id) ?? { total: 0, hit: 0 };
      map.set(r.rule_id, {
        total: prev.total + 1,
        hit:   prev.hit + (r.is_dispatching === 'Y' ? 1 : 0),
      });
    }

    return Array.from(map.entries())
      .map(([ruleId, { total, hit }]) => ({
        ruleName: ruleMap.get(ruleId)?.name ?? ruleId,
        count:    total,
        hitRate:  Math.round((hit / total) * 100),
      }))
      .sort((a, b) => b.hitRate - a.hitRate);
  }, [recentRows, ruleMap]);

  return {
    dailyStats,
    classStats,
    hitRateStats,
    isLoading: rowsLoading || defsLoading,
  };
}
