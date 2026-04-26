-- migration 008: MAPF 알고리즘 enum 확장 (CACTUS, CBS_TS 추가)
-- 기존 CHECK 제약(ASTAR, AI_PPO)을 4-value로 교체

BEGIN;

-- 1. 기존 CHECK 제약 제거
ALTER TABLE mcs_macro_command
  DROP CONSTRAINT IF EXISTS mcs_macro_command_algorithm_check;

-- 2. 4-value CHECK 제약 재생성
ALTER TABLE mcs_macro_command
  ADD CONSTRAINT mcs_macro_command_algorithm_check
  CHECK (algorithm IN ('ASTAR', 'AI_PPO', 'CACTUS', 'CBS_TS'));

-- 3. algorithm 컬럼 인덱스 (필터 쿼리 성능)
CREATE INDEX IF NOT EXISTS idx_mcs_macro_command_algorithm
  ON mcs_macro_command(algorithm)
  WHERE algorithm IS NOT NULL;

COMMIT;
