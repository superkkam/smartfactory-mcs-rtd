'use client';

import { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { useRuleObjects, useCreateRuleObject, useDeleteRuleObject } from '@/lib/api/rule-objects';
import { useMcsPorts } from '@/lib/api/mcs-ports';
import { toast } from 'sonner';

const EVENT_TYPES = [
  { value: 'LOAD_REQUEST', label: 'LoadRequest (투입 요청)' },
];

interface Props {
  ruleGroupId: string;
}

export function EquipmentMappingPanel({ ruleGroupId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPortId, setSelectedPortId] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');

  const { data: mappings = [], isLoading: mappingLoading } = useRuleObjects(ruleGroupId);
  const { data: mcsPorts = [], isLoading: portsLoading } = useMcsPorts();
  const createMutation = useCreateRuleObject();
  const deleteMutation = useDeleteRuleObject();

  function openAddDialog() {
    setSelectedPortId('');
    setSelectedEvent('');
    setDialogOpen(true);
  }

  async function handleAdd() {
    if (!selectedPortId || !selectedEvent) {
      toast.error('포트와 이벤트를 모두 선택해주세요');
      return;
    }
    // 중복 체크
    const duplicate = mappings.some(
      (m) => m.ruleObjectId === selectedPortId && m.ruleEventId === selectedEvent
    );
    if (duplicate) {
      toast.error('이미 등록된 매핑입니다');
      return;
    }
    await createMutation.mutateAsync({
      ruleObjectId: selectedPortId,
      ruleEventId:  selectedEvent,
      ruleGroupId,
      isUsable:     'Y',
    });
    toast.success('매핑이 추가되었습니다');
    setDialogOpen(false);
  }

  async function handleDelete(ruleObjectId: string, ruleEventId: string) {
    if (!confirm('매핑을 삭제하시겠습니까?')) return;
    await deleteMutation.mutateAsync({ ruleObjectId, ruleEventId, ruleGroupId });
    toast.success('매핑이 삭제되었습니다');
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">장비-이벤트 매핑</CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAddDialog}>
              <Plus className="h-3 w-3 mr-1" />
              매핑 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {mappingLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              불러오는 중...
            </div>
          ) : mappings.length === 0 ? (
            <p className="text-sm text-gray-400">매핑된 포트 없음</p>
          ) : (
            <div className="space-y-2">
              {mappings.map((m) => (
                <div
                  key={`${m.ruleObjectId}-${m.ruleEventId}`}
                  className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono truncate">{m.ruleObjectId}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {EVENT_TYPES.find((e) => e.value === m.ruleEventId)?.label ?? m.ruleEventId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <Badge
                      variant={m.isUsable === 'Y' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {m.isUsable === 'Y' ? '활성' : '비활성'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-400 hover:text-red-600"
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDelete(m.ruleObjectId, m.ruleEventId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>장비-이벤트 매핑 추가</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 포트 선택 */}
            <div className="space-y-1.5">
              <Label className="text-sm">MCS 포트</Label>
              {portsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  MCS 포트 목록 불러오는 중...
                </div>
              ) : mcsPorts.length === 0 ? (
                <p className="text-sm text-orange-500">
                  MCS 레이아웃에 포트가 없거나 MCS 서버에 연결할 수 없습니다
                </p>
              ) : (
                <Select value={selectedPortId} onValueChange={(v) => setSelectedPortId(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="포트 선택..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mcsPorts.map((p) => (
                      <SelectItem key={p.unitId} value={p.unitId}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 이벤트 선택 */}
            <div className="space-y-1.5">
              <Label className="text-sm">이벤트 유형</Label>
              <Select value={selectedEvent} onValueChange={(v) => setSelectedEvent(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="이벤트 선택..." />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleAdd}
              disabled={createMutation.isPending || !selectedPortId || !selectedEvent}
            >
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
