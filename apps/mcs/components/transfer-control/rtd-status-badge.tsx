'use client';

import { useQuery } from '@tanstack/react-query';
import { Unplug, Plug, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface RtdHealthResponse {
  enabled:    boolean;
  reachable:  boolean;
  latencyMs:  number | null;
  error?:     string;
}

interface RtdStatusBadgeProps {
  sourceEquipmentLabel?: string;
}

export function RtdStatusBadge({ sourceEquipmentLabel }: RtdStatusBadgeProps) {
  const { data, isLoading } = useQuery<RtdHealthResponse>({
    queryKey:       ['rtd-health'],
    queryFn:        () => fetch('/api/rtd/health').then((r) => r.json()),
    refetchInterval: 10_000,
    staleTime:       5_000,
  });

  const enabled   = data?.enabled   ?? false;
  const reachable = data?.reachable  ?? false;

  const handleTrigger = async () => {
    if (!sourceEquipmentLabel) {
      toast.error('경로를 먼저 탐색한 후 수동 트리거를 실행하세요.');
      return;
    }
    try {
      const res = await fetch('/api/rtd/trigger', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ equipmentId: sourceEquipmentLabel, eventType: 'EVT_FULL' }),
      });
      const result = await res.json() as { ok: boolean; error?: string };
      if (result.ok) {
        toast.success(`RTD LOAD_REQUEST 전송 완료 — ${sourceEquipmentLabel}`);
      } else {
        toast.error(`RTD 트리거 실패: ${result.error ?? '알 수 없는 오류'}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'RTD 트리거 실패');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          RTD 확인 중
        </span>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
          <Unplug className="h-3 w-3" />
          RTD 비연동
        </span>
        <Button variant="outline" size="xs" disabled className="text-xs">
          수동 트리거
        </Button>
      </div>
    );
  }

  if (!reachable) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          <AlertTriangle className="h-3 w-3" />
          RTD 연결 실패
        </span>
        <Button variant="outline" size="xs" disabled className="text-xs">
          수동 트리거
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
        <Plug className="h-3 w-3" />
        RTD 연동 중
        {data?.latencyMs != null && (
          <span className="ml-0.5 text-green-500">{data.latencyMs}ms</span>
        )}
      </span>
      <Button
        variant="outline"
        size="xs"
        className="text-xs"
        disabled={!sourceEquipmentLabel}
        onClick={handleTrigger}
      >
        수동 트리거
      </Button>
    </div>
  );
}
