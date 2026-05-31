'use client';

import { useEffect, useRef } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlaygroundReplayProps {
  makespan: number;       // 최장 경로 길이
  step: number;
  isPlaying: boolean;
  onStepChange: (s: number) => void;
  onPlayToggle: () => void;
}

const HOP_MS = 600; // 1 hop 이동 속도

export function PlaygroundReplay({
  makespan,
  step,
  isPlaying,
  onStepChange,
  onPlayToggle,
}: PlaygroundReplayProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        onStepChange(Math.min(step + 1, makespan));
      }, HOP_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, step, makespan, onStepChange]);

  // 끝까지 재생되면 자동 정지
  useEffect(() => {
    if (step >= makespan && isPlaying) onPlayToggle();
  }, [step, makespan]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      {/* 슬라이더 */}
      <input
        type="range"
        min={0}
        max={makespan}
        value={step}
        onChange={(e) => onStepChange(Number(e.target.value))}
        className="w-full accent-gray-800"
      />
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>Step {step}</span>
        <span>/ {makespan}</span>
      </div>

      {/* 재생 컨트롤 */}
      <div className="flex items-center justify-center gap-2">
        <Button
          size="sm" variant="outline"
          onClick={() => onStepChange(0)}
          className="h-7 w-7 p-0"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          onClick={onPlayToggle}
          className="h-7 w-16 text-xs gap-1"
        >
          {isPlaying
            ? <><Pause className="h-3.5 w-3.5" /> 정지</>
            : <><Play  className="h-3.5 w-3.5" /> 재생</>
          }
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={() => onStepChange(makespan)}
          className="h-7 w-7 p-0"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
