'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button }  from '@/components/ui/button';
import { Label }   from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useUnitsByLayout } from '@/lib/api/equipment-units';

interface RouteSearchFormProps {
  /** 현재 활성 레이아웃 ID (null이면 유닛 목록 비활성) */
  layoutId: string | null;
  onSearch: (fromUnitId: string, toUnitId: string) => void;
  isLoading?: boolean;
}

/** 출발지/목적지 EquipmentUnit 선택 폼 */
export function RouteSearchForm({ layoutId, onSearch, isLoading }: RouteSearchFormProps) {
  const [fromUnit, setFromUnit] = useState<string | null>(null);
  const [toUnit,   setToUnit]   = useState<string | null>(null);

  const { data: units = [], isLoading: isLoadingUnits } = useUnitsByLayout(layoutId ?? '');
  const disabled = !layoutId || isLoadingUnits || isLoading;

  return (
    <div className="space-y-3">
      {!layoutId && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          레이아웃을 먼저 저장하면 경로 탐색이 가능합니다.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
        {/* 출발지 */}
        <div className="space-y-1.5">
          <Label htmlFor="from-unit" className="text-xs font-medium text-gray-700">
            출발 유닛
          </Label>
          <Select
            onValueChange={setFromUnit}
            value={fromUnit ?? ''}
            disabled={disabled}
          >
            <SelectTrigger id="from-unit" className="text-sm">
              <SelectValue placeholder={isLoadingUnits ? '로딩 중...' : '출발지 선택'}>
                {(v: string | null) => {
                  if (!v) return '출발지 선택';
                  const u = units.find((x) => x.id === v);
                  return u ? `${u.equipmentUnitId}` : v;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id} disabled={u.id === toUnit}>
                  <span className="font-medium">{u.equipmentUnitId}</span>
                  <span className="ml-2 text-gray-400">{u.inOutMode}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 목적지 */}
        <div className="space-y-1.5">
          <Label htmlFor="to-unit" className="text-xs font-medium text-gray-700">
            목적 유닛
          </Label>
          <Select
            onValueChange={setToUnit}
            value={toUnit ?? ''}
            disabled={disabled}
          >
            <SelectTrigger id="to-unit" className="text-sm">
              <SelectValue placeholder={isLoadingUnits ? '로딩 중...' : '목적지 선택'}>
                {(v: string | null) => {
                  if (!v) return '목적지 선택';
                  const u = units.find((x) => x.id === v);
                  return u ? `${u.equipmentUnitId}` : v;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id} disabled={u.id === fromUnit}>
                  <span className="font-medium">{u.equipmentUnitId}</span>
                  <span className="ml-2 text-gray-400">{u.inOutMode}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 탐색 버튼 */}
        <Button
          onClick={() => fromUnit && toUnit && onSearch(fromUnit, toUnit)}
          disabled={!fromUnit || !toUnit || !!disabled}
          className="gap-1.5"
        >
          <Search className="h-4 w-4" />
          {isLoading ? '탐색 중...' : '경로 탐색'}
        </Button>
      </div>
    </div>
  );
}
