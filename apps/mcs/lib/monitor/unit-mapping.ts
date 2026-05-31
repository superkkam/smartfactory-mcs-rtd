import type { EquipmentUnit } from '@workspace/types/mcs';
import type { Node } from '@xyflow/react';

/** unit DB UUID → 표시용 equipmentUnitId 라벨 */
export function unitIdToLabel(unitId: string, units: EquipmentUnit[]): string {
  return units.find((u) => u.id === unitId)?.equipmentUnitId ?? unitId.slice(0, 8) + '…';
}

/** unit DB UUID → React Flow 노드 ID */
export function unitIdToRfNodeId(
  unitId: string,
  units: EquipmentUnit[],
  rfNodes: Node[],
): string | null {
  const unit = units.find((u) => u.id === unitId);
  if (!unit) return null;

  if (unit.unitType === 'Node') {
    const rfNode = rfNodes.find((n) =>
      (n.type === 'node' || n.type === 'charge') &&
      ((n.data as { nodeId?: string }).nodeId === unit.equipmentUnitId ||
        n.id === unit.equipmentUnitId),
    );
    return rfNode?.id ?? null;
  }

  if (unit.unitType === 'Port') {
    const label = unit.equipmentUnitId.trim();
    const rfNode = rfNodes.find((n) =>
      n.type === 'port' && (
        ((n.data as { portId?: string }).portId ?? '').trim() === label ||
        n.id === label
      )
    );
    return rfNode?.id ?? null;
  }

  return null;
}
