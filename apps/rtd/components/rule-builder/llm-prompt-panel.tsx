'use client';

import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GeneratedSequence } from '@/lib/llm/rule-schema';

interface LlmPromptPanelProps {
  ruleGroupId: string;
  onGenerated: (sequences: GeneratedSequence[]) => void;
}

export function LlmPromptPanel({ ruleGroupId, onGenerated }: LlmPromptPanelProps) {
  const [open, setOpen] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/llm/generate-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleGroupId, prompt }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? '알 수 없는 오류가 발생했습니다.');
        return;
      }

      onGenerated(data.sequences as GeneratedSequence[]);
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50">
      {/* 헤더 */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-indigo-700">AI 룰 플로우 자동 생성</span>
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-medium text-white">
            Claude 3.5 Sonnet
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-indigo-400" />
          : <ChevronDown className="h-4 w-4 text-indigo-400" />
        }
      </button>

      {/* 본문 */}
      {open && (
        <div className="border-t border-indigo-200 px-4 pb-4 pt-3 space-y-3">
          <p className="text-xs text-indigo-600">
            자연어로 디스패칭 조건을 설명하면 AI가 룰 시퀀스를 자동으로 생성합니다.
            생성 결과를 미리 확인한 후 적용할 수 있습니다.
          </p>

          <div className="flex gap-2">
            <textarea
              className="flex-1 resize-none rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
              rows={3}
              placeholder="예: 긴급 Lot을 우선 처리하고, 가용 가능한 설비 중 부하가 낮은 설비를 선택하세요."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isGenerating && prompt.trim()) {
                  handleGenerate();
                }
              }}
            />
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={!prompt.trim() || isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5" />
                }
                {isGenerating ? '생성 중...' : '생성'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-gray-400 text-xs"
                onClick={() => { setPrompt(''); setError(null); }}
                disabled={!prompt || isGenerating}
              >
                초기화
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 whitespace-pre-wrap">
              {error}
            </div>
          )}

          <p className="text-[11px] text-indigo-400">
            * Cmd+Enter로 생성 · 생성된 시퀀스는 미리보기에서 확인 후 적용
          </p>
        </div>
      )}
    </div>
  );
}
