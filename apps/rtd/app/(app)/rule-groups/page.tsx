'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, Pencil, Trash2, ArrowRight, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// Badge는 룰 그룹 테이블에서 사용
import { RuleGroupFormDialog } from '@/components/rule-groups/rule-group-form-dialog';
import { EquipmentMappingPanel } from '@/components/rule-groups/equipment-mapping-panel';
import { useRuleGroups, useDeleteRuleGroup } from '@/lib/api/rule-groups';
import type { RuleGroup } from '@workspace/types/rtd';

export default function RuleGroupsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Partial<RuleGroup> | undefined>();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const { data: ruleGroups = [], isLoading } = useRuleGroups();
  const deleteMutation = useDeleteRuleGroup();

  /** 로드 완료 후 첫 항목 자동 선택 */
  const selectedGroup = ruleGroups.find((g) => g.ruleGroupId === selectedGroupId) ?? ruleGroups[0];

  function openCreate() {
    setEditTarget(undefined);
    setDialogOpen(true);
  }

  function openEdit(group: RuleGroup) {
    setEditTarget(group);
    setDialogOpen(true);
  }

  async function handleDelete(group: RuleGroup) {
    if (!confirm(`'${group.ruleGroupName}' 룰 그룹을 삭제하시겠습니까?`)) return;
    await deleteMutation.mutateAsync(group.ruleGroupId);
    if (selectedGroupId === group.ruleGroupId) setSelectedGroupId('');
  }

  /** STK 이름 포함 그룹 (장비 전용), 나머지는 공통 */
  const fallbackTree = [
    { level: 0, label: '장비 전용 룰', groups: ruleGroups.filter((g) => !g.ruleGroupName.includes('COMMON')) },
    { level: 1, label: 'Fallback: 공통 룰', groups: ruleGroups.filter((g) => g.ruleGroupName.includes('COMMON')) },
  ];

  const currentGroup = selectedGroup;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">룰 그룹 관리</h1>
          <p className="text-sm text-gray-500 mt-1">F001 · F002</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          룰 그룹 생성
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 좌측: 룰 그룹 목록 */}
        <div className="lg:col-span-2 space-y-4">
          {/* Fallback 계층 시각화 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Fallback 계층 구조</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {fallbackTree.map((tier) => (
                <div key={tier.label} style={{ marginLeft: `${tier.level * 16}px` }}>
                  <p className="text-xs text-gray-400 mb-1">{tier.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {tier.groups.map((g) => (
                      <button
                        key={g.ruleGroupId}
                        onClick={() => setSelectedGroupId(g.ruleGroupId)}
                        className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                          currentGroup?.ruleGroupId === g.ruleGroupId
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {g.ruleGroupName}
                        {g.isUsable === 'N' && (
                          <span className="ml-1 text-gray-400">(비활성)</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 룰 그룹 목록 테이블 */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-center text-sm text-gray-400">불러오는 중...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>그룹 ID</TableHead>
                      <TableHead>그룹 이름</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>설명</TableHead>
                      <TableHead className="text-right">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ruleGroups.map((group) => (
                      <TableRow
                        key={group.ruleGroupId}
                        className={`cursor-pointer ${currentGroup?.ruleGroupId === group.ruleGroupId ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedGroupId(group.ruleGroupId)}
                      >
                        <TableCell className="font-mono text-sm">{group.ruleGroupId}</TableCell>
                        <TableCell className="font-medium text-sm">{group.ruleGroupName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{group.ruleGroupType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={group.isUsable === 'Y' ? 'default' : 'secondary'}>
                            {group.isUsable === 'Y' ? '활성' : '비활성'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 max-w-[160px] truncate">
                          {group.description}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); openEdit(group); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-600"
                              disabled={deleteMutation.isPending}
                              onClick={(e) => { e.stopPropagation(); handleDelete(group); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 우측: 선택된 그룹 상세 + 매핑 */}
        <div className="space-y-4">
          {currentGroup && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">선택된 룰 그룹</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400">그룹 ID</p>
                  <p className="text-sm font-mono">{currentGroup.ruleGroupId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">이름</p>
                  <p className="text-sm font-medium">{currentGroup.ruleGroupName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">유형</p>
                  <p className="text-sm">{currentGroup.ruleGroupType}</p>
                </div>
                <Link href={`/rule-builder/${currentGroup.ruleGroupId}`}>
                  <Button size="sm" variant="outline" className="w-full mt-2">
                    룰 플로우 빌더 열기
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
                <Link href={`/simulator/${currentGroup.ruleGroupId}`}>
                  <Button size="sm" className="w-full mt-1">
                    <FlaskConical className="h-3.5 w-3.5 mr-1" />
                    시뮬레이터 실행
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {currentGroup && (
            <EquipmentMappingPanel ruleGroupId={currentGroup.ruleGroupId} />
          )}
        </div>
      </div>

      <RuleGroupFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editTarget}
      />
    </div>
  );
}
