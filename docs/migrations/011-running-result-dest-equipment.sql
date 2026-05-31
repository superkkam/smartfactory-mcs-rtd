-- 011: rule_running_result 모니터링 분석용 컬럼 추가
-- Supabase SQL Editor (service_role) 에서 실행

-- 목적지 설비 ID (is_dispatching='Y' row에만 기록)
ALTER TABLE rule_running_result
  ADD COLUMN IF NOT EXISTS dest_equipment_id TEXT;

-- 블록(룰) 이름 — rule_def.rule_name 비정규화 저장 (모니터링 표시용)
ALTER TABLE rule_running_result
  ADD COLUMN IF NOT EXISTS rule_name TEXT;

-- 시퀀스 실행 결과 rows (최대 20건, JSONB) — 실제 데이터 분석용
ALTER TABLE rule_running_result
  ADD COLUMN IF NOT EXISTS result_rows JSONB;
