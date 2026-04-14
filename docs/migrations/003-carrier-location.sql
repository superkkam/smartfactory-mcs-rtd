-- ============================================================
-- Migration 003: 캐리어 위치 정밀화 + AMR 이동 추적 + Micro Command 실행 주체
-- ============================================================
-- 목적:
--   1. mcs_carrier.location_id   — 포트/AMR body port 위 여부 표현
--      · NULL  = 설비 내부(Stocker/Process 내부) → 대시보드에서 숨김
--      · 값 있음 = 특정 equipment_unit 위에 있음 → 대시보드에서 표시
--   2. mcs_equipment.location_id — 이동형 장비(AMR/AGV)의 현재 path 노드
--      · 고정 장비(Stocker/Process)는 NULL
--   3. mcs_micro_command.executor_equipment_id — 이 명령을 실행하는 AMR
--      · ACS tick loop 이 명령 pick up 시 채움
--      · NULL = 아직 미할당 (Pending)
--
-- 실행 위치: Supabase 대시보드 → SQL Editor
-- 전제 조건: migration 002 적용 완료 (REPLICA IDENTITY FULL 이미 설정됨)
-- 주의: 중복 실행 방지 (IF NOT EXISTS 패턴 사용)
-- ============================================================

-- ─── 1. mcs_carrier.location_id ───────────────────────────────────
ALTER TABLE mcs_carrier
  ADD COLUMN IF NOT EXISTS location_id uuid
    REFERENCES mcs_equipment_unit(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mcs_carrier_location
  ON mcs_carrier(location_id);

COMMENT ON COLUMN mcs_carrier.location_id IS
  'NULL = 설비 내부(숨김). non-NULL = 해당 equipment_unit 위(대시보드 표시). FK → mcs_equipment_unit.id';

-- ─── 2. mcs_equipment.location_id ────────────────────────────────
ALTER TABLE mcs_equipment
  ADD COLUMN IF NOT EXISTS location_id uuid
    REFERENCES mcs_equipment_unit(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mcs_equipment_location
  ON mcs_equipment(location_id);

COMMENT ON COLUMN mcs_equipment.location_id IS
  '이동형 장비(AGV/AMR)의 현재 path 노드(PathNode 타입 unit). 고정 장비는 NULL. FK → mcs_equipment_unit.id';

-- ─── 3. mcs_micro_command.executor_equipment_id ──────────────────
ALTER TABLE mcs_micro_command
  ADD COLUMN IF NOT EXISTS executor_equipment_id uuid
    REFERENCES mcs_equipment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mcs_micro_command_executor
  ON mcs_micro_command(executor_equipment_id);

COMMENT ON COLUMN mcs_micro_command.executor_equipment_id IS
  '이 micro command 를 실행하는 AMR 장비. ACS 가 pick up 시 채움. NULL = 미할당. FK → mcs_equipment.id';

-- ─── 확인 쿼리 (실행 후 아래로 검증) ────────────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name IN ('mcs_carrier', 'mcs_equipment', 'mcs_micro_command')
--   AND column_name IN ('location_id', 'executor_equipment_id')
-- ORDER BY table_name, column_name;
