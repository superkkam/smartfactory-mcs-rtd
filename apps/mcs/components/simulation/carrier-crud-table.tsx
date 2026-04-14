'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
/** 시뮬레이션 설정용 로컬 캐리어 타입 (UI 전용, DB 연동 없음) */
type CarrierState = 'Idle' | 'Moving' | 'Loading' | 'Unloading' | 'Error';

interface Carrier {
  id: string;
  name: string;
  state: CarrierState;
  currentUnitId?: string;
  currentEquipmentId?: string;
  priority?: number;
}

const DUMMY_CARRIERS: Carrier[] = [
  { id: 'CAR-001', name: 'FOUP-001', state: 'Moving',    currentUnitId: 'UNIT-003', priority: 1 },
  { id: 'CAR-002', name: 'FOUP-002', state: 'Idle',      currentUnitId: 'UNIT-006', priority: 3 },
  { id: 'CAR-003', name: 'FOUP-003', state: 'Idle',      currentUnitId: 'UNIT-001', priority: 3 },
  { id: 'CAR-004', name: 'FOUP-004', state: 'Loading',   currentUnitId: 'UNIT-008', priority: 2 },
  { id: 'CAR-005', name: 'FOUP-005', state: 'Unloading', currentUnitId: 'UNIT-002', priority: 2 },
];

/** 캐리어 상태 → 배지 스타일 */
const CARRIER_BADGE: Record<CarrierState, { style: string; label: string }> = {
  Idle:       { style: 'bg-gray-100   text-gray-600   border-gray-200',   label: '대기' },
  Moving:     { style: 'bg-blue-100   text-blue-700   border-blue-200',   label: '이동중' },
  Loading:    { style: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: '로딩' },
  Unloading:  { style: 'bg-purple-100 text-purple-700 border-purple-200', label: '언로딩' },
  Error:      { style: 'bg-red-100    text-red-600    border-red-200',    label: '에러' },
};

type EditingCarrier = Pick<Carrier, 'id' | 'name' | 'state' | 'currentUnitId'>;

const EMPTY_CARRIER: EditingCarrier = {
  id: '',
  name: '',
  state: 'Idle',
  currentUnitId: '',
};

/** 캐리어 CRUD 테이블 (로컬 상태 관리) */
export function CarrierCrudTable() {
  const [carriers, setCarriers] = useState<Carrier[]>(DUMMY_CARRIERS);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<EditingCarrier>(EMPTY_CARRIER);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const openAdd = () => {
    setEditing({ ...EMPTY_CARRIER, id: `CAR-${String(carriers.length + 1).padStart(3, '0')}` });
    setDialogMode('add');
  };

  const openEdit = (c: Carrier) => {
    setEditing({ id: c.id, name: c.name, state: c.state, currentUnitId: c.currentUnitId ?? '' });
    setDialogMode('edit');
  };

  const handleSave = () => {
    if (dialogMode === 'add') {
      setCarriers((prev) => [
        ...prev,
        { ...editing, priority: 3, currentEquipmentId: undefined, currentUnitId: editing.currentUnitId || undefined },
      ]);
    } else if (dialogMode === 'edit') {
      setCarriers((prev) =>
        prev.map((c) =>
          c.id === editing.id
            ? { ...c, name: editing.name, state: editing.state, currentUnitId: editing.currentUnitId || undefined }
            : c,
        ),
      );
    }
    setDialogMode(null);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      setCarriers((prev) => prev.filter((c) => c.id !== deleteTarget));
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">캐리어 {carriers.length}개 등록됨</p>
        <Button size="xs" onClick={openAdd} className="gap-1">
          <Plus className="h-3 w-3" />
          캐리어 추가
        </Button>
      </div>

      <div className="rounded-md border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs">ID</TableHead>
              <TableHead className="text-xs">이름</TableHead>
              <TableHead className="text-xs text-center">상태</TableHead>
              <TableHead className="text-xs">현재 유닛</TableHead>
              <TableHead className="w-16 text-xs text-center">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carriers.map((c) => {
              const badge = CARRIER_BADGE[c.state];
              return (
                <TableRow key={c.id} className="text-sm">
                  <TableCell className="font-medium text-gray-700">{c.id}</TableCell>
                  <TableCell className="text-gray-600">{c.name}</TableCell>
                  <TableCell className="text-center">
                    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${badge.style}`}>
                      {badge.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-500 text-xs">
                    {c.currentUnitId ?? '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* 추가/편집 Dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => { if (!open) setDialogMode(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'add' ? '캐리어 추가' : '캐리어 편집'}</DialogTitle>
            <DialogDescription>캐리어 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">ID</Label>
              <Input
                value={editing.id}
                onChange={(e) => setEditing((p) => ({ ...p, id: e.target.value }))}
                disabled={dialogMode === 'edit'}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">이름</Label>
              <Input
                value={editing.name}
                onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">현재 유닛 ID</Label>
              <Input
                value={editing.currentUnitId}
                onChange={(e) => setEditing((p) => ({ ...p, currentUnitId: e.target.value }))}
                placeholder="예: UNIT-001"
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogMode(null)}>취소</Button>
            <Button size="sm" onClick={handleSave}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>캐리어 삭제</DialogTitle>
            <DialogDescription>
              {deleteTarget}를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
