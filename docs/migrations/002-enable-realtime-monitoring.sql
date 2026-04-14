-- ============================================================
-- Migration 002: Supabase Realtime Publication 활성화
-- ============================================================
-- 목적: mcs_equipment, mcs_carrier, mcs_equipment_unit 테이블의
--       변경(INSERT/UPDATE/DELETE)을 브라우저에 실시간 Push
--
-- 실행 위치: Supabase 대시보드 → SQL Editor
-- 주의: 중복 실행 시 에러 없음 (아래 예외 처리 포함)
-- ============================================================

DO $$
BEGIN
  -- mcs_equipment: 장비 상태(Online/Offline/Error) 변경 감지
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE mcs_equipment;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- 이미 등록된 경우 무시
  END;

  -- mcs_carrier: 캐리어 위치(current_equipment_id) 및 상태 변경 감지
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE mcs_carrier;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- mcs_equipment_unit: 유닛 전송 상태(transfer_state) 변경 감지
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE mcs_equipment_unit;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- ============================================================
-- REPLICA IDENTITY FULL 설정
-- 목적: UPDATE/DELETE 이벤트에서 payload.old(변경 전 값) 포함 +
--       서버사이드 필터(filter: 'col=eq.val') 정상 동작
-- ============================================================
ALTER TABLE mcs_equipment      REPLICA IDENTITY FULL;
ALTER TABLE mcs_carrier        REPLICA IDENTITY FULL;
ALTER TABLE mcs_equipment_unit REPLICA IDENTITY FULL;

-- 등록 확인 쿼리 (실행 후 아래로 검증)
-- SELECT schemaname, tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime'
--   AND tablename IN ('mcs_equipment', 'mcs_carrier', 'mcs_equipment_unit');
