'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

/** 알고리즘 선택 옵션 */
type AlgorithmOption = 'ASTAR' | 'AI' | 'COMPARE';

export interface ScenarioFormParams {
  carrierCount: number;
  transferRequestCount: number;
  simulationDuration: number;
  algorithms: Array<'astar' | 'ai_ppo'>;
}

interface ScenarioFormProps {
  onRun: (params: ScenarioFormParams) => void;
  disabled?: boolean;
}

/** 알고리즘 선택 → FastAPI algorithms 배열 변환 */
function toAlgorithms(opt: AlgorithmOption): Array<'astar' | 'ai_ppo'> {
  if (opt === 'ASTAR')   return ['astar'];
  if (opt === 'AI')      return ['ai_ppo'];
  return ['astar', 'ai_ppo'];
}

/** 시뮬레이션 시나리오 파라미터 입력 폼 */
export function ScenarioForm({ onRun, disabled }: ScenarioFormProps) {
  const [carrierCount,         setCarrierCount]         = useState(5);
  const [transferRequestCount, setTransferRequestCount] = useState(20);
  const [simulationDuration,   setSimulationDuration]   = useState(300);
  const [algorithm,            setAlgorithm]            = useState<string | null>('COMPARE');

  const handleRun = () => {
    onRun({
      carrierCount,
      transferRequestCount,
      simulationDuration,
      algorithms: toAlgorithms((algorithm ?? 'COMPARE') as AlgorithmOption),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* 캐리어 수 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">캐리어 수</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={carrierCount}
            onChange={(e) => setCarrierCount(Number(e.target.value))}
            disabled={disabled}
            className="text-sm"
          />
        </div>

        {/* 반송 요청 수 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">반송 요청 수</Label>
          <Input
            type="number"
            min={1}
            max={200}
            value={transferRequestCount}
            onChange={(e) => setTransferRequestCount(Number(e.target.value))}
            disabled={disabled}
            className="text-sm"
          />
        </div>

        {/* 시뮬레이션 시간 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">시뮬레이션 시간 (초)</Label>
          <Input
            type="number"
            min={60}
            max={3600}
            value={simulationDuration}
            onChange={(e) => setSimulationDuration(Number(e.target.value))}
            disabled={disabled}
            className="text-sm"
          />
        </div>

        {/* 알고리즘 선택 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">알고리즘</Label>
          <Select
            onValueChange={setAlgorithm}
            value={algorithm ?? undefined}
            disabled={disabled}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="알고리즘 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ASTAR">A* 단독</SelectItem>
              <SelectItem value="AI">AI 단독</SelectItem>
              <SelectItem value="COMPARE">A* vs AI 비교</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleRun} disabled={disabled} className="gap-2">
        <Play className="h-4 w-4" />
        시뮬레이션 실행
      </Button>
    </div>
  );
}
