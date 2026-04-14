-- ============================================================
-- Migration 004: 디스패칭 동적 컬럼 추가 + RTD 실행 RPC
-- ============================================================
-- 목적:
--   RTD 룰 엔진이 실데이터 기반으로 디스패칭 결정을 내릴 수 있도록
--   mcs_carrier / mcs_equipment / mcs_equipment_unit 에 동적 상태 컬럼을 추가.
--
--   1. mcs_carrier   — Lot 정보 + 우선순위 (디스패칭 후보 선택 소스)
--   2. mcs_equipment — 가용성 + 부하 + 레시피 (디스패칭 목적지 필터 소스)
--   3. mcs_equipment_unit — 포트 점유·예약 상태 (세밀한 포트 레벨 필터)
--   4. rtd_exec_readonly() RPC — RTD 룰 쿼리를 SELECT-only 로 안전하게 실행
--
-- 실행 위치: Supabase 대시보드 → SQL Editor
-- 전제 조건: migration 003 적용 완료
-- 주의: 중복 실행 방지 (IF NOT EXISTS 패턴 사용)
-- ============================================================


-- ─── 1. mcs_carrier 컬럼 추가 ────────────────────────────────────

-- 캐리어에 적재된 Lot 식별자 (논문 프로토타입: Lot=Carrier 1:1 가정)
ALTER TABLE mcs_carrier
  ADD COLUMN IF NOT EXISTS lot_id text NOT NULL DEFAULT '';

COMMENT ON COLUMN mcs_carrier.lot_id IS
  '캐리어에 적재된 Lot 식별자. 디스패칭 룰이 LOT_ID 기준 필터/정렬에 사용.';

-- Lot 진행 상태: WAIT / PROCESSING / DONE / HOLD
ALTER TABLE mcs_carrier
  ADD COLUMN IF NOT EXISTS lot_state text NOT NULL DEFAULT 'WAIT';

COMMENT ON COLUMN mcs_carrier.lot_state IS
  'Lot 진행 상태(WAIT/PROCESSING/DONE/HOLD). 룰의 가장 흔한 필터 조건.';

-- 우선순위 (1=highest, 5=default)
ALTER TABLE mcs_carrier
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 5;

COMMENT ON COLUMN mcs_carrier.priority IS
  '디스패칭 우선순위 (1=최고, 5=기본). RTD Sort 룰의 정렬 기준.';

-- 납기 기한 (EDD 기반 룰용)
ALTER TABLE mcs_carrier
  ADD COLUMN IF NOT EXISTS due_time timestamptz;

COMMENT ON COLUMN mcs_carrier.due_time IS
  'Lot 납기 기한. NULL = 기한 없음. EDD(Earliest Due Date) 디스패칭 룰에 사용.';

-- 공정 단계 (설비 레시피 매칭용)
ALTER TABLE mcs_carrier
  ADD COLUMN IF NOT EXISTS process_step text NOT NULL DEFAULT '';

COMMENT ON COLUMN mcs_carrier.process_step IS
  '현재 Lot 의 공정 단계 ID. mcs_equipment.recipe_type 과 매칭해 적합 설비를 필터.';


-- ─── 2. mcs_equipment 컬럼 추가 ──────────────────────────────────

-- 디스패칭 대상 여부 (Online 이어도 일시 Hold/유지보수 제외용)
ALTER TABLE mcs_equipment
  ADD COLUMN IF NOT EXISTS availability boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN mcs_equipment.availability IS
  '디스패칭 가용 여부. state=Online 이어도 false 로 제외 가능(유지보수/Hold 등).';

-- 현재 점유 Lot 수 (ACS tick-loop 이 갱신)
ALTER TABLE mcs_equipment
  ADD COLUMN IF NOT EXISTS current_load integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN mcs_equipment.current_load IS
  '현재 설비에 점유 중인 Lot(캐리어) 수. 부하 균형 룰 입력값.';

-- 수용 가능 최대 Lot 수
ALTER TABLE mcs_equipment
  ADD COLUMN IF NOT EXISTS capacity integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN mcs_equipment.capacity IS
  '설비가 동시 수용 가능한 Lot 수. Filter 룰에서 current_load < capacity 조건에 사용.';

-- 처리 가능 레시피/자재 유형
ALTER TABLE mcs_equipment
  ADD COLUMN IF NOT EXISTS recipe_type text NOT NULL DEFAULT '';

COMMENT ON COLUMN mcs_equipment.recipe_type IS
  '설비가 처리 가능한 레시피/자재 유형. mcs_carrier.process_step 과 매칭해 적합 설비를 필터.';

-- 최근 상태 갱신 시각 (stale 판단용)
ALTER TABLE mcs_equipment
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN mcs_equipment.last_heartbeat_at IS
  '마지막 상태 갱신 시각. 갱신이 오래된 설비를 stale 로 판단해 디스패칭에서 제외 가능.';


-- ─── 3. mcs_equipment_unit 컬럼 추가 ─────────────────────────────

-- 이 포트에 현재 점유 중인 캐리어 (mcs_carrier.location_id 와 쌍대 관계)
-- 주의: mcs_carrier.location_id → mcs_equipment_unit 의 역방향 FK.
--       양방향 참조이므로 ON DELETE SET NULL 로 통일, 일관성은 ACS 트랜잭션으로 보장.
ALTER TABLE mcs_equipment_unit
  ADD COLUMN IF NOT EXISTS current_carrier_id uuid
    REFERENCES mcs_carrier(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mcs_equipment_unit_carrier
  ON mcs_equipment_unit(current_carrier_id);

COMMENT ON COLUMN mcs_equipment_unit.current_carrier_id IS
  '이 포트/유닛에 현재 있는 캐리어 역참조. Filter 룰에서 IS NULL 로 빈 포트 선별.';

-- 예약 중인 반송 명령 (이중 할당 방지)
ALTER TABLE mcs_equipment_unit
  ADD COLUMN IF NOT EXISTS reserved_by_command_id uuid
    REFERENCES mcs_macro_command(id) ON DELETE SET NULL;

COMMENT ON COLUMN mcs_equipment_unit.reserved_by_command_id IS
  '이 유닛을 예약한 매크로 명령 ID. NOT NULL 이면 이미 예약됨 → 디스패칭 제외.';

-- 대기열 길이 (stocker/컨베이어 포트)
ALTER TABLE mcs_equipment_unit
  ADD COLUMN IF NOT EXISTS queue_length integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN mcs_equipment_unit.queue_length IS
  '이 포트/유닛 앞 대기 캐리어 수. Sort 룰의 FIFO/LRU 계산 보조.';

-- 마지막 상태 변경 시각 (LRU/FIFO 기반 룰)
ALTER TABLE mcs_equipment_unit
  ADD COLUMN IF NOT EXISTS last_state_changed_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN mcs_equipment_unit.last_state_changed_at IS
  'transfer_state 마지막 변경 시각. LRU(가장 오래 Idle 인 포트 우선) 룰에 사용.';


-- ─── 4. 인덱스 추가 ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_mcs_carrier_lot_state
  ON mcs_carrier(lot_state);

CREATE INDEX IF NOT EXISTS idx_mcs_carrier_lot_id
  ON mcs_carrier(lot_id);

CREATE INDEX IF NOT EXISTS idx_mcs_equipment_availability
  ON mcs_equipment(availability);

-- idx_mcs_equipment_unit_carrier 는 3번 섹션에서 이미 생성


-- ─── 5. RTD 전용 읽기 전용 SQL 실행 RPC ─────────────────────────
-- RTD 룰 시뮬레이터/엔진이 rule_query_string (임의 SELECT) 을 안전하게
-- 실행할 수 있도록 SECURITY DEFINER 함수로 래핑.
-- SELECT 이외의 문은 거부.

CREATE OR REPLACE FUNCTION rtd_exec_readonly(sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  trimmed text;
BEGIN
  -- SELECT 로 시작하는지 검사 (대소문자/앞뒤 공백 무시)
  -- 주의: PostgreSQL POSIX 정규식은 \b(단어경계)를 지원하지 않음 → position() 으로 대체
  trimmed := lower(trim(sql));
  IF position('select' in trimmed) != 1 THEN
    RAISE EXCEPTION 'rtd_exec_readonly: SELECT 문만 허용됩니다. 시도된 SQL: %', left(sql, 50);
  END IF;

  EXECUTE format(
    'SELECT coalesce(jsonb_agg(t), ''[]''::jsonb) FROM (%s) t',
    sql
  ) INTO result;

  RETURN result;
END;
$$;

-- 인증된 사용자(RTD 앱 서비스 역할)에게 실행 권한 부여
GRANT EXECUTE ON FUNCTION rtd_exec_readonly(text) TO authenticated;

COMMENT ON FUNCTION rtd_exec_readonly(text) IS
  'RTD 룰 엔진이 rule_query_string 을 SELECT-only 로 실행하는 RPC. '
  'SELECT 이외의 문은 거부. 결과를 jsonb 배열로 반환.';


-- ─── 확인 쿼리 (실행 후 아래로 검증) ────────────────────────────
-- SELECT table_name, column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name IN ('mcs_carrier', 'mcs_equipment', 'mcs_equipment_unit')
--   AND column_name IN (
--     'lot_id','lot_state','priority','due_time','process_step',
--     'availability','current_load','capacity','recipe_type','last_heartbeat_at',
--     'current_carrier_id','reserved_by_command_id','queue_length','last_state_changed_at'
--   )
-- ORDER BY table_name, column_name;
--
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_name = 'rtd_exec_readonly';
