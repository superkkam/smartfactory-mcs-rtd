-- Migration 001: Waypoint → Node 명칭 변경
-- 실행 위치: Supabase SQL Editor
-- 실행 일시: 2026-04-10

UPDATE mcs_equipment_unit
SET unit_type = 'Node'
WHERE unit_type = 'Waypoint';
