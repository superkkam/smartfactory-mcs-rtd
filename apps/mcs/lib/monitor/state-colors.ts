import type { SymbolState } from '@/components/symbols';

/** 장비 상태 → 배지 스타일 (배경/텍스트/테두리 클래스) */
export function getEquipmentBadgeStyle(state: string): string {
  if (state === 'Online')  return 'bg-green-100 text-green-700 border-green-300';
  if (state === 'Error')   return 'bg-red-100   text-red-600   border-red-300';
  return                          'bg-gray-100  text-gray-500  border-gray-300'; // Offline
}

/** 장비 상태 → 한국어 라벨 */
export function getEquipmentStateLabel(state: string): string {
  if (state === 'Online')  return '운영중';
  if (state === 'Error')   return '에러';
  return '중지';
}

/** 장비 상태 → 컨테이너 테두리/배경 스타일 (ProcessGroupNode 등에 사용) */
export function getEquipmentContainerStyle(state: string): string {
  if (state === 'Online')  return 'border-green-400 bg-green-50';
  if (state === 'Error')   return 'border-red-400   bg-red-50';
  return                          'border-gray-300  bg-gray-50';
}

/** 장비 상태 → MiniMap 노드 색상 (hex) */
export function getEquipmentMiniMapColor(state: string): string {
  if (state === 'Online')  return '#22c55e';
  if (state === 'Error')   return '#ef4444';
  if (state === 'Offline') return '#9ca3af';
  return '#fbbf24'; // Node (경유점)
}

/** 장비 상태 문자열 → SymbolState (SVG 심볼 렌더용) */
export function toSymbolState(state: string): SymbolState {
  if (state === 'Online')  return 'Online';
  if (state === 'Error')   return 'Error';
  return 'Offline';
}
