import type { Node } from '@xyflow/react';
import type { Carrier } from '@workspace/types/mcs';

/**
 * 캐리어의 현재 위치(currentEquipmentId)를 기반으로
 * 해당 Equipment RF 노드 중심 좌표를 계산한다.
 *
 * Task 021(framer-motion 애니메이션)에서도 이 헬퍼를 재사용할 수 있도록
 * 순수 함수로 유지한다.
 *
 * @param carrier - DB Carrier 엔티티
 * @param equipmentNodes - React Flow 노드 배열 (stocker/process 타입만 포함)
 * @returns RF 좌표 { x, y } 또는 null (매칭되는 노드가 없을 때)
 */
export function getCarrierRFPosition(
  carrier: Pick<Carrier, 'currentEquipmentId'>,
  equipmentNodes: Node[],
): { x: number; y: number } | null {
  // RF 노드 id가 equipment.id(uuid) 또는 data.equipmentId(equipment_id 라벨)로 매핑될 수 있음
  const node = equipmentNodes.find(
    (n) =>
      n.id === carrier.currentEquipmentId ||
      (n.data as Record<string, unknown>)?.equipmentId === carrier.currentEquipmentId,
  );

  if (!node) return null;

  const w = (node.measured?.width  ?? node.width  ?? 200) as number;
  const h = (node.measured?.height ?? node.height ?? 80)  as number;

  // 노드 중심에서 약간 오프셋하여 겹침 방지
  return {
    x: node.position.x + w / 2 - 20,
    y: node.position.y + h / 2 - 20,
  };
}
