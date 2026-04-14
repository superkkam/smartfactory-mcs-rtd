'use client';

import { Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** RTD 연동 상태 배지 + 수동 트리거 버튼 (비활성 UI) */
export function RtdStatusBadge() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
        <Unplug className="h-3 w-3" />
        RTD 비연동
      </span>
      <Button
        variant="outline"
        size="xs"
        disabled
        className="text-xs"
      >
        수동 트리거
      </Button>
    </div>
  );
}
