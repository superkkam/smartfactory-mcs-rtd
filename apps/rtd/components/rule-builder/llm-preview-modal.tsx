'use client';

import { useState } from 'react';
import { Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GeneratedSequence } from '@/lib/llm/rule-schema';
import type { RuleDef } from '@workspace/types/rtd';

interface LlmPreviewModalProps {
  sequences: GeneratedSequence[];
  ruleDefs: RuleDef[];
  existingCount: number;
  onApply: (sequences: GeneratedSequence[], append: boolean) => void;
  onCancel: () => void;
}

const MANDATORY_LABEL: Record<string, { label: string; className: string }> = {
  Y: { label: '필수', className: 'bg-red-100 text-red-700 border-red-200' },
  N: { label: '선택', className: 'bg-green-100 text-green-700 border-green-200' },
  O: { label: '선택적', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
};

export function LlmPreviewModal({
  sequences,
  ruleDefs,
  existingCount,
  onApply,
  onCancel,
}: LlmPreviewModalProps) {
  const [append, setAppend] = useState(false);

  function getRuleName(ruleId: string) {
    return ruleDefs.find((d) => d.ruleId === ruleId)?.ruleName ?? ruleId;
  }

  function getRuleType(ruleId: string) {
    return ruleDefs.find((d) => d.ruleId === ruleId)?.ruleType ?? '?';
  }

  function isUnknownRule(ruleId: string) {
    return !ruleDefs.some((d) => d.ruleId === ruleId);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-2xl flex flex-col max-h-[80vh]">
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-900">AI 생성 룰 시퀀스 미리보기</h2>
          <span className="ml-auto text-xs text-gray-400">{sequences.length}개 시퀀스</span>
        </div>

        {/* 시퀀스 카드 목록 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {sequences.map((s) => {
            const unknown = isUnknownRule(s.ruleId);
            return (
              <div
                key={s.sequence}
                className={`rounded-lg border p-3 space-y-1.5 ${unknown ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-600">
                    {s.sequence}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{getRuleName(s.ruleId)}</span>
                  <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">
                    {getRuleType(s.ruleId)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`ml-auto text-[10px] ${MANDATORY_LABEL[s.isMandatory]?.className ?? ''}`}
                  >
                    {MANDATORY_LABEL[s.isMandatory]?.label ?? s.isMandatory}
                  </Badge>
                </div>

                {/* 연결 정보 */}
                <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
                  {s.filterSequence != null && (
                    <span className="rounded bg-white border border-gray-200 px-1.5 py-0.5">
                      ← #{s.filterSequence} 필터
                    </span>
                  )}
                  {s.jumpNextSequence != null && (
                    <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-amber-700">
                      → #{s.jumpNextSequence} 점프 ({s.jumpNextSequenceCondition ?? ''})
                    </span>
                  )}
                </div>

                {/* LLM reasoning */}
                {s.reasoning && (
                  <p className="text-[11px] text-gray-500 italic">{s.reasoning}</p>
                )}

                {unknown && (
                  <div className="flex items-center gap-1 text-[11px] text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    ruleId "{s.ruleId}"가 룰 정의 목록에 없습니다. 적용 전 확인이 필요합니다.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 하단 액션 영역 */}
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          {existingCount > 0 && !append && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              기존 {existingCount}개 시퀀스를 모두 삭제하고 교체합니다.
            </div>
          )}
          {existingCount > 0 && (
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded"
                checked={append}
                onChange={(e) => setAppend(e.target.checked)}
              />
              기존 시퀀스 뒤에 이어붙이기 (삭제 없이 추가)
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              취소
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => onApply(sequences, append)}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {append ? '이어붙이기' : '적용'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
