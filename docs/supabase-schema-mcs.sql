-- ================================================================
-- MCS 플랫폼 Supabase DB 스키마
-- Supabase 대시보드 → SQL Editor에 붙여넣고 실행
-- RTD 테이블과 구분: mcs_ 접두사 사용
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 테이블 생성 (의존 순서대로)
-- ----------------------------------------------------------------

-- 레이아웃 저장 (React Flow JSON 포함)
CREATE TABLE IF NOT EXISTS mcs_layout (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id       text NOT NULL,
  design_name     text NOT NULL,
  version         integer NOT NULL DEFAULT 1,
  json_data       jsonb NOT NULL DEFAULT '{}',
  site_id         text NOT NULL DEFAULT 'SITE-001',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 장비 (Stocker / Process / OHT / AGV 등)
CREATE TABLE IF NOT EXISTS mcs_equipment (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id        text NOT NULL,
  layout_id           uuid NOT NULL REFERENCES mcs_layout(id) ON DELETE CASCADE,
  equipment_type      text NOT NULL,
  ec_server_name      text NOT NULL DEFAULT '',
  inline_stocker      boolean NOT NULL DEFAULT false,
  state               text NOT NULL DEFAULT 'Online',
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- migration 003: 이동형 장비(AMR/AGV) 현재 path 노드 위치
  location_id         uuid REFERENCES mcs_equipment_unit(id) ON DELETE SET NULL,
  -- migration 004: 디스패칭 동적 컬럼
  availability        boolean NOT NULL DEFAULT true,
  current_load        integer NOT NULL DEFAULT 0,
  capacity            integer NOT NULL DEFAULT 1,
  recipe_type         text NOT NULL DEFAULT '',
  last_heartbeat_at   timestamptz NOT NULL DEFAULT now()
);

-- 장비 단위 (Port / Crane 등)
CREATE TABLE IF NOT EXISTS mcs_equipment_unit (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_unit_id         text NOT NULL,
  equipment_id              uuid NOT NULL REFERENCES mcs_equipment(id) ON DELETE CASCADE,
  unit_type                 text NOT NULL,
  in_out_mode               text NOT NULL DEFAULT 'Both',
  transfer_state            text NOT NULL DEFAULT 'Idle',
  created_at                timestamptz NOT NULL DEFAULT now(),
  -- migration 004: 디스패칭 동적 컬럼
  current_carrier_id        uuid REFERENCES mcs_carrier(id) ON DELETE SET NULL,
  reserved_by_command_id    uuid REFERENCES mcs_macro_command(id) ON DELETE SET NULL,
  queue_length              integer NOT NULL DEFAULT 0,
  last_state_changed_at     timestamptz NOT NULL DEFAULT now()
);

-- 구간 연결 (경로 그래프 엣지)
CREATE TABLE IF NOT EXISTS mcs_transfer_relation (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id               uuid NOT NULL REFERENCES mcs_layout(id) ON DELETE CASCADE,
  departure_unit_id       uuid NOT NULL REFERENCES mcs_equipment_unit(id),
  arrival_unit_id         uuid NOT NULL REFERENCES mcs_equipment_unit(id),
  transport_equipment_id  uuid REFERENCES mcs_equipment(id),
  weight                  numeric NOT NULL DEFAULT 1.0,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- 캐리어 (FOUP / 자재 컨테이너)
CREATE TABLE IF NOT EXISTS mcs_carrier (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id              text NOT NULL UNIQUE,
  carrier_type            text NOT NULL DEFAULT 'FOUP',
  material_type           text NOT NULL DEFAULT '',
  current_equipment_id    uuid REFERENCES mcs_equipment(id),
  state                   text NOT NULL DEFAULT 'Stored',
  created_at              timestamptz NOT NULL DEFAULT now(),
  -- migration 003: 포트/AMR body port 위 정밀 위치
  location_id             uuid REFERENCES mcs_equipment_unit(id) ON DELETE SET NULL,
  -- migration 004: 디스패칭 동적 컬럼
  lot_id                  text NOT NULL DEFAULT '',
  lot_state               text NOT NULL DEFAULT 'WAIT',
  priority                integer NOT NULL DEFAULT 5,
  due_time                timestamptz,
  process_step            text NOT NULL DEFAULT ''
);

-- 매크로 반송 명령 (출발 → 목적지)
CREATE TABLE IF NOT EXISTS mcs_macro_command (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id      text NOT NULL UNIQUE,
  carrier_id      uuid NOT NULL REFERENCES mcs_carrier(id),
  source_unit_id  uuid NOT NULL REFERENCES mcs_equipment_unit(id),
  dest_unit_id    uuid NOT NULL REFERENCES mcs_equipment_unit(id),
  state           text NOT NULL DEFAULT 'Pending',
  priority        integer NOT NULL DEFAULT 5,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 마이크로 반송 명령 (구간 단위)
CREATE TABLE IF NOT EXISTS mcs_micro_command (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  macro_command_id    uuid NOT NULL REFERENCES mcs_macro_command(id) ON DELETE CASCADE,
  sequence            integer NOT NULL,
  departure_unit_id   uuid NOT NULL REFERENCES mcs_equipment_unit(id),
  arrival_unit_id     uuid NOT NULL REFERENCES mcs_equipment_unit(id),
  state               text NOT NULL DEFAULT 'Pending',
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 경로 탐색 결과 기록
CREATE TABLE IF NOT EXISTS mcs_route_finding_result (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  macro_command_id    uuid NOT NULL REFERENCES mcs_macro_command(id) ON DELETE CASCADE,
  algorithm           text NOT NULL,  -- 'astar' | 'ai_ppo'
  route               jsonb NOT NULL DEFAULT '[]',  -- unit ID 배열
  total_cost          numeric NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 시뮬레이션 실행 요청
CREATE TABLE IF NOT EXISTS mcs_simulation_run (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id           uuid REFERENCES mcs_layout(id),
  scenario_params     jsonb NOT NULL DEFAULT '{}',
  algorithms          text NOT NULL DEFAULT 'astar,ai_ppo',
  status              text NOT NULL DEFAULT 'Pending',  -- 'Pending' | 'Running' | 'Completed' | 'Failed'
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 시뮬레이션 성과 지표 결과
CREATE TABLE IF NOT EXISTS mcs_simulation_result (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_id       uuid NOT NULL REFERENCES mcs_simulation_run(id) ON DELETE CASCADE,
  algorithm               text NOT NULL,
  avg_transfer_time       numeric NOT NULL DEFAULT 0,
  throughput              numeric NOT NULL DEFAULT 0,
  collision_count         integer NOT NULL DEFAULT 0,
  load_balance_std        numeric NOT NULL DEFAULT 0,
  equipment_utilization   numeric NOT NULL DEFAULT 0,
  deadlock_count          integer NOT NULL DEFAULT 0,
  route_efficiency_score  numeric NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now()
);


-- ----------------------------------------------------------------
-- 2. 인덱스 (조회 성능 최적화)
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_mcs_equipment_layout_id        ON mcs_equipment(layout_id);
CREATE INDEX IF NOT EXISTS idx_mcs_equipment_unit_equipment_id ON mcs_equipment_unit(equipment_id);
CREATE INDEX IF NOT EXISTS idx_mcs_transfer_relation_layout_id ON mcs_transfer_relation(layout_id);
CREATE INDEX IF NOT EXISTS idx_mcs_transfer_relation_departure  ON mcs_transfer_relation(departure_unit_id);
CREATE INDEX IF NOT EXISTS idx_mcs_transfer_relation_arrival    ON mcs_transfer_relation(arrival_unit_id);
CREATE INDEX IF NOT EXISTS idx_mcs_macro_command_carrier_id    ON mcs_macro_command(carrier_id);
CREATE INDEX IF NOT EXISTS idx_mcs_macro_command_state         ON mcs_macro_command(state);
CREATE INDEX IF NOT EXISTS idx_mcs_micro_command_macro_id      ON mcs_micro_command(macro_command_id);
CREATE INDEX IF NOT EXISTS idx_mcs_micro_command_state         ON mcs_micro_command(state);
CREATE INDEX IF NOT EXISTS idx_mcs_simulation_result_run_id    ON mcs_simulation_result(simulation_run_id);
-- migration 003
CREATE INDEX IF NOT EXISTS idx_mcs_carrier_location            ON mcs_carrier(location_id);
CREATE INDEX IF NOT EXISTS idx_mcs_equipment_location          ON mcs_equipment(location_id);
-- migration 004
CREATE INDEX IF NOT EXISTS idx_mcs_carrier_lot_state           ON mcs_carrier(lot_state);
CREATE INDEX IF NOT EXISTS idx_mcs_carrier_lot_id              ON mcs_carrier(lot_id);
CREATE INDEX IF NOT EXISTS idx_mcs_equipment_availability      ON mcs_equipment(availability);
CREATE INDEX IF NOT EXISTS idx_mcs_equipment_unit_carrier      ON mcs_equipment_unit(current_carrier_id);


-- ----------------------------------------------------------------
-- 3. Row Level Security (RLS) — 인증된 사용자 전체 허용
--    (연구 플랫폼: 단일 사용자/소규모 팀 운영 기준)
-- ----------------------------------------------------------------

ALTER TABLE mcs_layout              ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcs_equipment            ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcs_equipment_unit       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcs_transfer_relation    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcs_carrier              ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcs_macro_command        ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcs_micro_command        ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcs_route_finding_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcs_simulation_run       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcs_simulation_result    ENABLE ROW LEVEL SECURITY;

-- 인증 사용자에게 전체 CRUD 허용
CREATE POLICY "authenticated_all" ON mcs_layout              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON mcs_equipment            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON mcs_equipment_unit       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON mcs_transfer_relation    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON mcs_carrier              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON mcs_macro_command        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON mcs_micro_command        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON mcs_route_finding_result FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON mcs_simulation_run       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON mcs_simulation_result    FOR ALL TO authenticated USING (true) WITH CHECK (true);
