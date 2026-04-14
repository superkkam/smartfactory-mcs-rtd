-- ============================================================
-- Migration 005: 명령 실행 추적 컬럼 추가
-- ============================================================
-- 목적:
--   ACS tick-loop 이 micro_command 를 AGV 에 할당·추적하는 데 필요한
--   컬럼을 추가한다.
--
--   1. mcs_macro_command.command_id  → DEFAULT 생성 (코드에서 UUID 자동 생성)
--   2. mcs_micro_command.executor_equipment_id → 할당된 AGV 참조 컬럼 추가
--
-- 실행 위치: Supabase 대시보드 → SQL Editor
-- 전제 조건: migration 004 적용 완료
-- ============================================================

-- ─── 1. mcs_macro_command: command_id 에 DEFAULT 추가 ────────────
-- 기존 NOT NULL UNIQUE 제약은 유지하되, 코드에서 값을 제공하지 않으면
-- 자동으로 UUID 기반 친숙 코드가 생성되도록 DEFAULT 설정.
ALTER TABLE mcs_macro_command
  ALTER COLUMN command_id SET DEFAULT 'CMD-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || left(gen_random_uuid()::text, 8);

COMMENT ON COLUMN mcs_macro_command.command_id IS
  '사람이 읽기 쉬운 명령 ID (예: CMD-20260412-153045-a1b2c3d4). DEFAULT 자동 생성.';


-- ─── 2. mcs_micro_command: executor_equipment_id 컬럼 추가 ────────
-- ACS tick-loop 이 Idle AGV 에게 micro_command 를 할당할 때 기록.
-- IS NULL → 미할당 / NOT NULL → 이미 할당됨.
ALTER TABLE mcs_micro_command
  ADD COLUMN IF NOT EXISTS executor_equipment_id uuid
    REFERENCES mcs_equipment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mcs_micro_command_executor
  ON mcs_micro_command(executor_equipment_id);

COMMENT ON COLUMN mcs_micro_command.executor_equipment_id IS
  '이 micro_command 를 실행 중인 AGV (mcs_equipment.id). NULL = 미할당.';


-- ─── 확인 쿼리 ────────────────────────────────────────────────────
-- SELECT column_name, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'mcs_macro_command' AND column_name = 'command_id';
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'mcs_micro_command' AND column_name = 'executor_equipment_id';
