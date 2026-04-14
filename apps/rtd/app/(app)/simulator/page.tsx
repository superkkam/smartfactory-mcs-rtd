'use client';

import { useRouter } from 'next/navigation';
import { FlaskConical, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRuleGroups } from '@/lib/api/rule-groups';

export default function SimulatorIndexPage() {
  const router = useRouter();
  const { data: ruleGroups = [], isLoading } = useRuleGroups();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50">
          <FlaskConical className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">룰 시뮬레이터</h1>
          <p className="text-sm text-gray-500">실행할 룰 그룹을 선택하세요</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-sm text-gray-400">
          불러오는 중...
        </div>
      ) : ruleGroups.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
          룰 그룹이 없습니다. 먼저 룰 그룹을 생성하세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ruleGroups.map((group) => (
            <button
              key={group.ruleGroupId}
              onClick={() => router.push(`/simulator/${group.ruleGroupId}`)}
              className="group flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 text-left transition-all hover:border-blue-400 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">
                  {group.ruleGroupName}
                </p>
                {group.isUsable === 'Y' ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-gray-300" />
                )}
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{group.ruleGroupType}</Badge>
                <Badge
                  variant={group.isUsable === 'Y' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {group.isUsable === 'Y' ? '활성' : '비활성'}
                </Badge>
              </div>

              {group.description && (
                <p className="text-xs text-gray-400 line-clamp-2">{group.description}</p>
              )}

              <div className="mt-auto flex items-center gap-1 text-xs text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">
                시뮬레이션 실행
                <ArrowRight className="h-3 w-3" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
