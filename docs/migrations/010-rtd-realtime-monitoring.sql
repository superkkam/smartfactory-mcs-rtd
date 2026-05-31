-- 010: rule_running_result Realtime 등록 및 uuid DEFAULT 설정
-- Supabase SQL Editor에서 실행 (service_role 권한 필요)

-- rule_running_result 전체 row 변경 감지를 위해 REPLICA IDENTITY FULL 설정
ALTER TABLE rule_running_result REPLICA IDENTITY FULL;

-- Realtime publication에 rule_running_result 추가
ALTER PUBLICATION supabase_realtime ADD TABLE rule_running_result;
