'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

/** 시뮬레이션 기본 파라미터 저장 폼 */
export function DefaultParamsForm() {
  const [carrierCount,      setCarrierCount]      = useState(5);
  const [commandCount,      setCommandCount]       = useState(20);
  const [simulationTimeSec, setSimulationTimeSec]  = useState(300);

  const handleSave = () => {
    toast.success('기본 파라미터가 저장되었습니다 (더미)');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">기본 캐리어 수</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={carrierCount}
            onChange={(e) => setCarrierCount(Number(e.target.value))}
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">기본 반송 요청 수</Label>
          <Input
            type="number"
            min={1}
            max={200}
            value={commandCount}
            onChange={(e) => setCommandCount(Number(e.target.value))}
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">기본 시간 (초)</Label>
          <Input
            type="number"
            min={60}
            max={3600}
            value={simulationTimeSec}
            onChange={(e) => setSimulationTimeSec(Number(e.target.value))}
            className="text-sm"
          />
        </div>
      </div>

      <Button size="sm" onClick={handleSave} className="gap-1.5">
        <Save className="h-3.5 w-3.5" />
        저장
      </Button>
    </div>
  );
}
