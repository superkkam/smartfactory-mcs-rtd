'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateRuleGroup, useUpdateRuleGroup } from '@/lib/api/rule-groups';
import type { RuleGroup } from '@workspace/types/rtd';

interface RuleGroupFormDialogProps {
  open: boolean;
  onClose: () => void;
  initial?: Partial<RuleGroup>;
}

/** 룰 그룹 생성/수정 폼 다이얼로그 */
export function RuleGroupFormDialog({ open, onClose, initial }: RuleGroupFormDialogProps) {
  const [form, setForm] = useState({
    ruleGroupId: initial?.ruleGroupId ?? '',
    ruleGroupName: initial?.ruleGroupName ?? '',
    ruleGroupType: initial?.ruleGroupType ?? 'DISPATCHING',
    isUsable: initial?.isUsable ?? 'Y',
    description: initial?.description ?? '',
  });

  const isEdit = !!initial?.ruleGroupId;

  const createMutation = useCreateRuleGroup();
  const updateMutation = useUpdateRuleGroup();
  const isPending = createMutation.isPending || updateMutation.isPending;

  /** 다이얼로그 열릴 때마다 폼 초기화 */
  useEffect(() => {
    setForm({
      ruleGroupId:   initial?.ruleGroupId   ?? '',
      ruleGroupName: initial?.ruleGroupName ?? '',
      ruleGroupType: initial?.ruleGroupType ?? 'DISPATCHING',
      isUsable:      initial?.isUsable      ?? 'Y',
      description:   initial?.description   ?? '',
    });
  }, [initial, open]);

  async function handleSave() {
    if (!form.ruleGroupId || !form.ruleGroupName) return;

    if (isEdit) {
      await updateMutation.mutateAsync({
        ruleGroupId:   form.ruleGroupId,
        ruleGroupName: form.ruleGroupName,
        ruleGroupType: form.ruleGroupType,
        isUsable:      form.isUsable,
        description:   form.description || undefined,
      });
    } else {
      await createMutation.mutateAsync({
        ruleGroupId:   form.ruleGroupId,
        ruleGroupName: form.ruleGroupName,
        ruleGroupType: form.ruleGroupType,
        isUsable:      form.isUsable,
        description:   form.description || undefined,
      });
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '룰 그룹 수정' : '룰 그룹 생성'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>룰 그룹 ID</Label>
            <Input
              value={form.ruleGroupId}
              onChange={(e) => setForm({ ...form, ruleGroupId: e.target.value })}
              disabled={isEdit}
              placeholder="RG001"
            />
          </div>

          <div className="space-y-1.5">
            <Label>룰 그룹 이름</Label>
            <Input
              value={form.ruleGroupName}
              onChange={(e) => setForm({ ...form, ruleGroupName: e.target.value })}
              placeholder="EQP_FULL_STK01"
            />
          </div>

          <div className="space-y-1.5">
            <Label>그룹 유형</Label>
            <Select
              value={form.ruleGroupType}
              onValueChange={(v) => v && setForm({ ...form, ruleGroupType: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DISPATCHING">DISPATCHING</SelectItem>
                <SelectItem value="ROUTING">ROUTING</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>사용 여부</Label>
            <Select
              value={form.isUsable}
              onValueChange={(v) => v && setForm({ ...form, isUsable: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Y">사용</SelectItem>
                <SelectItem value="N">미사용</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>설명</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="선택 입력"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>취소</Button>
          <Button onClick={handleSave} disabled={isPending || !form.ruleGroupId || !form.ruleGroupName}>
            {isPending ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
