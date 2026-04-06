-- ================================================================
-- RTD 플랫폼 Supabase DB 스키마
-- Supabase 대시보드 → SQL Editor에 붙여넣고 실행
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 테이블 생성
-- ----------------------------------------------------------------

-- 룰 클래스 (분류 기준)
CREATE TABLE IF NOT EXISTS rule_class (
  rule_class_id   text PRIMARY KEY,
  rule_class_name text NOT NULL,
  rule_class_type text NOT NULL
);

-- 룰 그룹
CREATE TABLE IF NOT EXISTS rule_group (
  rule_group_id   text PRIMARY KEY,
  rule_group_name text NOT NULL,
  rule_group_type text NOT NULL,
  is_usable       text NOT NULL DEFAULT 'Y',
  description     text
);

-- 룰 정의
CREATE TABLE IF NOT EXISTS rule_def (
  rule_id        text PRIMARY KEY,
  rule_name      text NOT NULL,
  rule_class_id  text NOT NULL REFERENCES rule_class(rule_class_id),
  rule_type      text NOT NULL,
  rule_condition text
);

-- 장비-이벤트-룰그룹 매핑
CREATE TABLE IF NOT EXISTS rule_object (
  rule_object_id text NOT NULL,
  rule_event_id  text NOT NULL,
  site_id        text NOT NULL,
  rule_group_id  text NOT NULL REFERENCES rule_group(rule_group_id),
  is_usable      text NOT NULL DEFAULT 'Y',
  PRIMARY KEY (rule_object_id, rule_event_id, site_id)
);

-- 정렬 조건
CREATE TABLE IF NOT EXISTS rule_sort (
  rule_sort_id text PRIMARY KEY,
  sort_column  text NOT NULL,
  weight_value numeric,
  from_percent numeric,
  to_percent   numeric,
  order_by     text NOT NULL DEFAULT 'ASC'
);

-- 룰 시퀀스 릴레이션
CREATE TABLE IF NOT EXISTS rule_relation (
  rule_group_id              text NOT NULL REFERENCES rule_group(rule_group_id),
  rule_id                    text NOT NULL REFERENCES rule_def(rule_id),
  sequence                   integer NOT NULL,
  is_mandatory               text NOT NULL DEFAULT 'N',
  filter_sequence            integer,
  jump_next_sequence         integer,
  jump_next_sequence_condition text,
  rule_sort_id               text REFERENCES rule_sort(rule_sort_id),
  PRIMARY KEY (rule_group_id, rule_id, sequence)
);

-- 쿼리 (SQL 자동 생성 결과 저장)
CREATE TABLE IF NOT EXISTS rule_query (
  rule_query_id      text NOT NULL,
  rule_query_version text NOT NULL,
  rule_query_string  text,
  rule_query_type    text,
  PRIMARY KEY (rule_query_id, rule_query_version)
);

-- 쿼리 파라미터 바인딩
CREATE TABLE IF NOT EXISTS rule_query_param (
  rule_query_id      text NOT NULL,
  rule_query_version text NOT NULL,
  param_key          text NOT NULL,
  param_value        text,
  target_column      text,
  PRIMARY KEY (rule_query_id, rule_query_version, param_key),
  FOREIGN KEY (rule_query_id, rule_query_version)
    REFERENCES rule_query(rule_query_id, rule_query_version)
);

-- 룰 실행 결과 로그
CREATE TABLE IF NOT EXISTS rule_running_result (
  uuid           text PRIMARY KEY,
  lot_id         text NOT NULL,
  rule_id        text NOT NULL REFERENCES rule_def(rule_id),
  sequence       integer NOT NULL,
  count          integer NOT NULL DEFAULT 0,
  start_time     timestamptz,
  end_time       timestamptz,
  is_dispatching text NOT NULL DEFAULT 'N'
);

-- ----------------------------------------------------------------
-- 2. RLS (Row Level Security) — 인증된 사용자 전체 접근
-- ----------------------------------------------------------------

ALTER TABLE rule_class          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_group          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_def            ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_object         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_sort           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_relation       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_query          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_query_param    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_running_result ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 전체 허용 정책
CREATE POLICY "authenticated_all" ON rule_class          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON rule_group          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON rule_def            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON rule_object         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON rule_sort           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON rule_relation       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON rule_query          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON rule_query_param    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON rule_running_result FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 3. 시드 데이터 (더미 데이터 기반)
-- ----------------------------------------------------------------

-- rule_class
INSERT INTO rule_class VALUES
  ('RC001', 'URGENT',     'PRIORITY'),
  ('RC002', 'NORMAL',     'PRIORITY'),
  ('RC003', 'LOT_FILTER', 'FILTER')
ON CONFLICT DO NOTHING;

-- rule_group
INSERT INTO rule_group VALUES
  ('RG001', 'EQP_FULL_STK01',      'DISPATCHING', 'Y', '스토커 01 풀 상태 디스패칭 룰'),
  ('RG002', 'EQP_EMPTY_STK01',     'DISPATCHING', 'Y', '스토커 01 공 상태 디스패칭 룰'),
  ('RG003', 'EQP_COMMON_DEFAULT',  'DISPATCHING', 'Y', '공통 Fallback 룰'),
  ('RG004', 'EQP_FULL_STK02',      'DISPATCHING', 'N', '스토커 02 풀 상태 (비활성)')
ON CONFLICT DO NOTHING;

-- rule_def
INSERT INTO rule_def VALUES
  ('R001', '긴급 Lot 조회',  'RC001', 'Data',    'URGENT_FLAG = Y'),
  ('R002', '일반 Lot 조회',  'RC002', 'Data',    ''),
  ('R003', '장비 필터',      'RC003', 'Filter',  'EQP_STATE = IDLE'),
  ('R004', '우선순위 정렬',  'RC002', 'Sort',    ''),
  ('R005', 'Lot 서브데이터', 'RC002', 'SubData', '')
ON CONFLICT DO NOTHING;

-- rule_object
INSERT INTO rule_object VALUES
  ('STK01', 'EVT_FULL',  'SITE01', 'RG001', 'Y'),
  ('STK01', 'EVT_EMPTY', 'SITE01', 'RG002', 'Y'),
  ('STK02', 'EVT_FULL',  'SITE01', 'RG004', 'N')
ON CONFLICT DO NOTHING;

-- rule_relation (RG001 기준)
INSERT INTO rule_relation
  (rule_group_id, rule_id, sequence, is_mandatory, filter_sequence, jump_next_sequence, jump_next_sequence_condition)
VALUES
  ('RG001', 'R001', 1, 'Y', NULL, 3,    'COUNT>0'),
  ('RG001', 'R002', 2, 'N', 1,    NULL, NULL),
  ('RG001', 'R003', 3, 'O', 2,    NULL, NULL),
  ('RG001', 'R004', 4, 'N', 3,    NULL, NULL)
ON CONFLICT DO NOTHING;

-- rule_running_result (샘플 로그)
INSERT INTO rule_running_result VALUES
  ('UUID001', 'LOT-2024-001', 'R001', 1, 5, '2024-03-30 09:00:00+09', '2024-03-30 09:00:01+09', 'Y'),
  ('UUID002', 'LOT-2024-001', 'R003', 3, 3, '2024-03-30 09:00:01+09', '2024-03-30 09:00:02+09', 'Y'),
  ('UUID003', 'LOT-2024-002', 'R001', 1, 0, '2024-03-30 09:05:00+09', '2024-03-30 09:05:00+09', 'N'),
  ('UUID004', 'LOT-2024-002', 'R002', 2, 8, '2024-03-30 09:05:00+09', '2024-03-30 09:05:01+09', 'Y'),
  ('UUID005', 'LOT-2024-003', 'R001', 1, 2, '2024-03-30 09:10:00+09', '2024-03-30 09:10:01+09', 'Y'),
  ('UUID006', 'LOT-2024-004', 'R003', 3, 1, '2024-03-30 09:15:00+09', '2024-03-30 09:15:00+09', 'Y'),
  ('UUID007', 'LOT-2024-005', 'R002', 2, 4, '2024-03-30 09:20:00+09', '2024-03-30 09:20:01+09', 'N')
ON CONFLICT DO NOTHING;
