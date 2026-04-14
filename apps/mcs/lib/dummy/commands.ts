/**
 * 더미 커맨드(MacroCommand/MicroCommand) 데이터
 * Task 006(대시보드 현황), Task 009(반송 제어) 에서 사용
 */

export type CommandState = 'Pending' | 'InProgress' | 'Completed' | 'Failed' | 'Cancelled';
export type CommandPriority = 'High' | 'Normal' | 'Low';

export interface MacroCommand {
  id: string;
  carrierId: string;
  fromPortId: string;
  toPortId: string;
  state: CommandState;
  priority: CommandPriority;
  algorithm: 'ASTAR' | 'AI';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedDurationMs: number;
}

export interface MicroCommand {
  id: string;
  macroCommandId: string;
  sequence: number;
  fromUnitId: string;
  toUnitId: string;
  equipmentId: string;
  state: CommandState;
  startedAt?: string;
  completedAt?: string;
}

/** 더미 매크로 커맨드 3개 */
export const DUMMY_MACRO_COMMANDS: MacroCommand[] = [
  {
    id: 'MC-001',
    carrierId: 'CAR-001',
    fromPortId: 'UNIT-003',
    toPortId: 'UNIT-008',
    state: 'InProgress',
    priority: 'High',
    algorithm: 'AI',
    createdAt: '2026-04-06T09:00:00+09:00',
    startedAt: '2026-04-06T09:00:30+09:00',
    estimatedDurationMs: 120000,
  },
  {
    id: 'MC-002',
    carrierId: 'CAR-002',
    fromPortId: 'UNIT-006',
    toPortId: 'UNIT-001',
    state: 'Completed',
    priority: 'Normal',
    algorithm: 'ASTAR',
    createdAt: '2026-04-06T08:30:00+09:00',
    startedAt: '2026-04-06T08:30:15+09:00',
    completedAt: '2026-04-06T08:32:45+09:00',
    estimatedDurationMs: 90000,
  },
  {
    id: 'MC-003',
    carrierId: 'CAR-004',
    fromPortId: 'UNIT-008',
    toPortId: 'UNIT-002',
    state: 'Pending',
    priority: 'Normal',
    algorithm: 'AI',
    createdAt: '2026-04-06T09:05:00+09:00',
    estimatedDurationMs: 150000,
  },
];

/** 더미 마이크로 커맨드 8개 (MC-001, MC-002에 각 4개씩) */
export const DUMMY_MICRO_COMMANDS: MicroCommand[] = [
  // MC-001 마이크로 커맨드 (InProgress)
  {
    id: 'MIC-001',
    macroCommandId: 'MC-001',
    sequence: 1,
    fromUnitId: 'UNIT-003',
    toUnitId: 'UNIT-006',
    equipmentId: 'EQP-001',
    state: 'Completed',
    startedAt: '2026-04-06T09:00:30+09:00',
    completedAt: '2026-04-06T09:01:00+09:00',
  },
  {
    id: 'MIC-002',
    macroCommandId: 'MC-001',
    sequence: 2,
    fromUnitId: 'UNIT-006',
    toUnitId: 'UNIT-007',
    equipmentId: 'EQP-003',
    state: 'InProgress',
    startedAt: '2026-04-06T09:01:05+09:00',
  },
  {
    id: 'MIC-003',
    macroCommandId: 'MC-001',
    sequence: 3,
    fromUnitId: 'UNIT-007',
    toUnitId: 'UNIT-008',
    equipmentId: 'EQP-004',
    state: 'Pending',
  },
  {
    id: 'MIC-004',
    macroCommandId: 'MC-001',
    sequence: 4,
    fromUnitId: 'UNIT-008',
    toUnitId: 'UNIT-008',
    equipmentId: 'EQP-004',
    state: 'Pending',
  },
  // MC-002 마이크로 커맨드 (Completed)
  {
    id: 'MIC-005',
    macroCommandId: 'MC-002',
    sequence: 1,
    fromUnitId: 'UNIT-006',
    toUnitId: 'UNIT-007',
    equipmentId: 'EQP-003',
    state: 'Completed',
    startedAt: '2026-04-06T08:30:15+09:00',
    completedAt: '2026-04-06T08:31:00+09:00',
  },
  {
    id: 'MIC-006',
    macroCommandId: 'MC-002',
    sequence: 2,
    fromUnitId: 'UNIT-007',
    toUnitId: 'UNIT-002',
    equipmentId: 'EQP-001',
    state: 'Completed',
    startedAt: '2026-04-06T08:31:05+09:00',
    completedAt: '2026-04-06T08:31:45+09:00',
  },
  {
    id: 'MIC-007',
    macroCommandId: 'MC-002',
    sequence: 3,
    fromUnitId: 'UNIT-002',
    toUnitId: 'UNIT-001',
    equipmentId: 'EQP-001',
    state: 'Completed',
    startedAt: '2026-04-06T08:31:50+09:00',
    completedAt: '2026-04-06T08:32:45+09:00',
  },
  {
    id: 'MIC-008',
    macroCommandId: 'MC-003',
    sequence: 1,
    fromUnitId: 'UNIT-008',
    toUnitId: 'UNIT-006',
    equipmentId: 'EQP-004',
    state: 'Pending',
  },
];
