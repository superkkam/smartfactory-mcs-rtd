'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Progress }     from '@/components/ui/progress';
import { buttonVariants } from '@/components/ui/button';

interface SimulationProgressProps {
  progress: number;   // 0-100
  status: string;     // Pending | Running | Completed | Failed
  runId?: string;     // 완료 시 결과 링크에 사용
}

/** 시뮬레이션 진행률 바 (FastAPI 폴링 기반) */
export function SimulationProgress({ progress, status, runId }: SimulationProgressProps) {
  const isRunning  = status === 'Running' || status === 'Pending';
  const isComplete = status === 'Completed';
  const isFailed   = status === 'Failed';

  if (!isRunning && !isComplete && !isFailed) return null;

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">
          {isRunning  && '시뮬레이션 진행 중...'}
          {isComplete && '시뮬레이션 완료'}
          {isFailed   && '시뮬레이션 실패'}
        </span>
        <span className={`font-semibold ${isFailed ? 'text-red-600' : 'text-indigo-700'}`}>
          {isFailed ? '오류' : `${progress}%`}
        </span>
      </div>

      <Progress value={isFailed ? 100 : progress} className={isFailed ? '[&>div]:bg-red-500' : ''} />

      {isComplete && runId && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-gray-500">결과 분석:</span>
          <Link
            href={`/simulation/result?runId=${runId}`}
            className={buttonVariants({ variant: 'outline', size: 'xs' }) + ' flex items-center gap-1 text-xs'}
          >
            결과 보기
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
