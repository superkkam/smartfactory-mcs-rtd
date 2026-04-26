-- Migration 004: RTD 통합 인터페이스 스키마 확장
-- mcs_macro_command 에 RTD 원천 추적 필드 추가
-- IF NOT EXISTS 가드로 중복 실행 안전

ALTER TABLE mcs_macro_command
  ADD COLUMN IF NOT EXISTS rtd_command_id      text,
  ADD COLUMN IF NOT EXISTS correlation_id      text,
  ADD COLUMN IF NOT EXISTS source_system       text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS algorithm           text NOT NULL DEFAULT 'ASTAR',
  ADD COLUMN IF NOT EXISTS source_equipment_id text,
  ADD COLUMN IF NOT EXISTS dest_equipment_id   text;

-- algorithm 허용값 제약 (중복 추가 방지)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mcs_macro_command_algorithm_check'
  ) THEN
    ALTER TABLE mcs_macro_command
      ADD CONSTRAINT mcs_macro_command_algorithm_check
      CHECK (algorithm IN ('ASTAR', 'AI_PPO'));
  END IF;
END $$;

-- source_system 허용값 제약
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mcs_macro_command_source_system_check'
  ) THEN
    ALTER TABLE mcs_macro_command
      ADD CONSTRAINT mcs_macro_command_source_system_check
      CHECK (source_system IN ('MANUAL', 'RTD'));
  END IF;
END $$;

-- 조회 성능 인덱스
CREATE INDEX IF NOT EXISTS idx_macro_rtd_command_id  ON mcs_macro_command (rtd_command_id);
CREATE INDEX IF NOT EXISTS idx_macro_correlation_id  ON mcs_macro_command (correlation_id);
CREATE INDEX IF NOT EXISTS idx_macro_source_system   ON mcs_macro_command (source_system);
