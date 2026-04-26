-- migration 007: orphan transfer relation 탐지 쿼리
-- 목적: source_unit_id 또는 dest_unit_id 가 mcs_equipment_unit 에 없는 행 식별
-- 실행 방법: node apps/mcs/scripts/apply-migration.mjs docs/migrations/007-orphan-relation-cleanup.sql
-- 주의: 이 마이그레이션은 삭제하지 않고 진단만 수행합니다.
--       실제 삭제는 아래 주석 처리된 DELETE 문을 확인 후 직접 실행하세요.

BEGIN;

-- 1. orphan 관계 조회 (departure_unit_id 누락)
SELECT
  r.id,
  r.layout_id,
  r.departure_unit_id,
  r.arrival_unit_id,
  'departure_unit missing' AS reason
FROM mcs_transfer_relation r
LEFT JOIN mcs_equipment_unit u ON u.id = r.departure_unit_id
WHERE u.id IS NULL

UNION ALL

-- 2. orphan 관계 조회 (arrival_unit_id 누락)
SELECT
  r.id,
  r.layout_id,
  r.departure_unit_id,
  r.arrival_unit_id,
  'arrival_unit missing' AS reason
FROM mcs_transfer_relation r
LEFT JOIN mcs_equipment_unit u ON u.id = r.arrival_unit_id
WHERE u.id IS NULL;

-- 실제 삭제가 필요한 경우 아래 주석 해제 후 실행:
/*
DELETE FROM mcs_transfer_relation
WHERE id IN (
  SELECT r.id FROM mcs_transfer_relation r
  LEFT JOIN mcs_equipment_unit u1 ON u1.id = r.departure_unit_id
  LEFT JOIN mcs_equipment_unit u2 ON u2.id = r.arrival_unit_id
  WHERE u1.id IS NULL OR u2.id IS NULL
);
*/

COMMIT;
