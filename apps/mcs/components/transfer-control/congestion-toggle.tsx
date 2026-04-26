'use client';

/**
 * 혼잡도 시뮬레이션 토글
 *
 * 활성화 시 선택된 노드에 혼잡도(0~1)를 부여하여 inferRoute에 전달.
 * AI(PPO 폴백)는 혼잡 반영 A*를 사용 → A* 최단 경로와 다른 결과 도출.
 *
 * Props:
 *   onChange(dynamicWeights): 부모가 inferRoute 호출 시 dynamicWeights로 주입
 */

import { useState } from 'react';
import { Activity } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * 혼잡 프리셋 정의
 *
 * 권장 데모 시나리오:
 *   프리셋 1: PROC-001-OUT → PROC-008-IN — 대각선 중간 경로 혼잡 시 허브 우회 경로 선택
 *   프리셋 2: PROC-004-OUT → PROC-005-IN — 허브 좌측 혼잡 시 우측 경유
 *   프리셋 3: STK1-OUT → PROC-004-IN    — 상단 바이패스 혼잡 시 메인 복도 직선
 */
const PRESETS: {
  label: string;
  description: string;
  demo: string;
  weights: Record<string, number>;
}[] = [
  {
    label: '대각 중간 경로 혼잡',
    description: '대각 수직 연결 노드 혼잡 → AI가 허브 경유 우회',
    demo: 'PROC-001-OUT → PROC-008-IN',
    weights: {
      'ND-021': 0.8,
      'ND-057': 0.8,
      'ND-026': 0.8,
      'ND-060': 0.8,
    },
  },
  {
    label: '허브 좌측 경로 혼잡',
    description: '허브 좌측 수직 노드 혼잡 → AI가 우측 경유 선택',
    demo: 'PROC-004-OUT → PROC-005-IN',
    weights: {
      'ND-028': 0.9,
      'ND-024': 0.9,
      'ND-020': 0.9,
    },
  },
  {
    label: '상단 바이패스 혼잡',
    description: '상단 바이패스 브릿지 노드 혼잡 → AI가 Row A→C 직결 경로 선택',
    demo: 'PROC-001-OUT → PROC-004-IN',
    weights: {
      'ND-005': 0.85,
      'ND-006': 0.85,
      'ND-007': 0.85,
    },
  },
];

export interface CongestionToggleProps {
  /** 혼잡도 변경 시 호출: { unitLabel: congestionFactor } 형태 */
  onChange: (dynamicWeights: Record<string, number> | null) => void;
}

export function CongestionToggle({ onChange }: CongestionToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const [presetIdx, setPresetIdx] = useState(0);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    onChange(checked ? PRESETS[presetIdx].weights : null);
  };

  const handlePresetChange = (val: string | null) => {
    if (val === null) return;
    const idx = parseInt(val, 10);
    setPresetIdx(idx);
    if (enabled) onChange(PRESETS[idx].weights);
  };

  const activePreset = PRESETS[presetIdx];

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      {/* 헤더 행 */}
      <div className="flex items-center gap-3">
        <Activity className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-sm font-medium text-gray-700">혼잡도 시뮬레이션</span>

        <div className="flex items-center gap-2 ml-auto">
          <Label htmlFor="congestion-sw" className="text-xs text-gray-500 cursor-pointer">
            {enabled ? 'ON' : 'OFF'}
          </Label>
          <Checkbox
            id="congestion-sw"
            checked={enabled}
            onCheckedChange={(checked) => handleToggle(!!checked)}
          />
        </div>
      </div>

      {/* 프리셋 선택 (활성 시에만 보임) */}
      {enabled && (
        <div className="flex flex-col gap-2 pt-1">
          <Select value={String(presetIdx)} onValueChange={handlePresetChange}>
            <SelectTrigger className="h-8 text-xs bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p, i) => (
                <SelectItem key={i} value={String(i)}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-[11px] text-gray-500 leading-tight">
            {activePreset.description}
          </p>
          <p className="text-[10px] text-indigo-500 font-medium">
            권장 데모: {activePreset.demo}
          </p>

          <div className="flex flex-wrap gap-1">
            {Object.entries(activePreset.weights).map(([label, factor]) => (
              <Badge
                key={label}
                className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
              >
                {label}: {Math.round(factor * 100)}%
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 비활성 상태 안내 */}
      {!enabled && (
        <p className="text-[11px] text-gray-400 leading-tight">
          ON 시 AI 경로가 혼잡 노드를 우회 — A* 최단 경로와 차이 발생
        </p>
      )}
    </div>
  );
}
