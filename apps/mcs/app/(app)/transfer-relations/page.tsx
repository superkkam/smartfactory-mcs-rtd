'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowRight, ArrowLeftRight, Search, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useLayouts } from '@/lib/api/layouts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RelationRow {
  id: string;
  departure_unit_id: string;
  arrival_unit_id: string;
  weight: number;
  dep_unit_code: string;
  arr_unit_code: string;
}

/** 레이아웃의 transfer_relation + equipment_unit 조인 조회 */
function useTransferRelations(layoutId: string | null) {
  return useQuery({
    queryKey: ['transfer-relations', layoutId],
    enabled: !!layoutId,
    queryFn: async () => {
      const supabase = createClient();

      // 릴레이션 전체 조회
      const { data: rels, error: relErr } = await supabase
        .from('mcs_transfer_relation')
        .select('id, departure_unit_id, arrival_unit_id, weight')
        .eq('layout_id', layoutId!)
        .order('weight', { ascending: true });
      if (relErr) throw relErr;

      // 해당 레이아웃의 유닛 코드 맵 구성
      const { data: units, error: unitErr } = await supabase
        .from('mcs_equipment_unit')
        .select('id, equipment_unit_id')
        .in('equipment_id',
          (await supabase
            .from('mcs_equipment')
            .select('id')
            .eq('layout_id', layoutId!)
          ).data?.map((r: { id: string }) => r.id) ?? []
        );
      if (unitErr) throw unitErr;

      const unitMap: Record<string, string> = {};
      (units ?? []).forEach((u: { id: string; equipment_unit_id: string }) => {
        unitMap[u.id] = u.equipment_unit_id;
      });

      return (rels ?? []).map((r): RelationRow => ({
        id:               r.id,
        departure_unit_id: r.departure_unit_id,
        arrival_unit_id:   r.arrival_unit_id,
        weight:            r.weight,
        dep_unit_code:     unitMap[r.departure_unit_id] ?? r.departure_unit_id,
        arr_unit_code:     unitMap[r.arrival_unit_id]   ?? r.arrival_unit_id,
      }));
    },
  });
}

export default function TransferRelationsPage() {
  const { data: layouts = [] } = useLayouts();
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>('');
  const [search, setSearch] = useState('');

  // 레이아웃 목록 로드 후 첫 번째 항목 자동 선택
  useEffect(() => {
    if (!selectedLayoutId && layouts.length > 0) {
      setSelectedLayoutId(layouts[0].id);
    }
  }, [layouts, selectedLayoutId]);

  const layoutId = selectedLayoutId || null;

  const { data: relations = [], isLoading, refetch } = useTransferRelations(layoutId);

  // 역방향 쌍 존재 여부 맵: "dep→arr" → true
  const reverseSet = useMemo(() => {
    const set = new Set<string>();
    relations.forEach((r) => set.add(`${r.dep_unit_code}→${r.arr_unit_code}`));
    return set;
  }, [relations]);

  const isBidirectional = (r: RelationRow) =>
    reverseSet.has(`${r.arr_unit_code}→${r.dep_unit_code}`);

  // 검색 필터
  const filtered = useMemo(() => {
    if (!search.trim()) return relations;
    const q = search.toLowerCase();
    return relations.filter(
      (r) =>
        r.dep_unit_code.toLowerCase().includes(q) ||
        r.arr_unit_code.toLowerCase().includes(q),
    );
  }, [relations, search]);

  // 통계
  const bidirCount  = useMemo(() => relations.filter(isBidirectional).length, [relations, reverseSet]);
  const unidirCount = relations.length - bidirCount;

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Transfer Relations</h1>
          <p className="text-sm text-gray-500">레이아웃의 이송 구간 릴레이션 전체 목록</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          새로고침
        </Button>
      </div>

      {/* 레이아웃 선택 + 검색 */}
      <div className="flex items-center gap-3">
        <Select
          value={selectedLayoutId}
          onValueChange={(v: string | null) => { if (v) setSelectedLayoutId(v); }}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="레이아웃 선택">
              {(v: string | null) => {
                const l = layouts.find((x) => x.id === v);
                return l ? l.designName : '레이아웃 선택';
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {layouts.map((l) => (
              <SelectItem key={l.id} value={l.id} label={l.designName}>
                {l.designName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            className="pl-8"
            placeholder="노드 코드로 검색 (예: ND-031)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* 통계 뱃지 */}
        {relations.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Badge variant="outline">전체 {relations.length}개</Badge>
            <Badge className="bg-blue-50 text-blue-700 border-blue-200">
              <ArrowLeftRight className="mr-1 h-3 w-3" />
              양방향 {bidirCount}개
            </Badge>
            <Badge className="bg-orange-50 text-orange-700 border-orange-200">
              <ArrowRight className="mr-1 h-3 w-3" />
              단방향 {unidirCount}개
            </Badge>
          </div>
        )}
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            로딩 중...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            {search ? '검색 결과 없음' : '릴레이션 없음'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-8">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">출발 노드</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-20">방향</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">도착 노드</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-24">Weight</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-28">양방향 여부</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const bidir = isBidirectional(r);
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      bidir ? '' : 'bg-orange-50/30'
                    }`}
                  >
                    <td className="px-4 py-2.5 text-gray-400 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {r.dep_unit_code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {bidir
                        ? <ArrowLeftRight className="inline h-3.5 w-3.5 text-blue-500" />
                        : <ArrowRight     className="inline h-3.5 w-3.5 text-orange-400" />
                      }
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {r.arr_unit_code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-gray-600">
                      {r.weight}m
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {bidir ? (
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                          양방향
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">
                          단방향
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
