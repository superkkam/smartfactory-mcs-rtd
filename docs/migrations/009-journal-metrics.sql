-- Migration 009: 저널 게재용 MAPF 표준 메트릭 컬럼 추가
-- 적용 대상: mcs_simulation_result
-- 참고: Stern et al. SoCS 2019, Sharon et al. AIJ 2015, Bahaji & Kuhl IJPR 2008
-- 적용 방법: Supabase 대시보드 > SQL Editor에서 실행

-- Makespan: 모든 에이전트 완료 시점 (MAPF 표준)
ALTER TABLE mcs_simulation_result
  ADD COLUMN IF NOT EXISTS makespan FLOAT DEFAULT 0.0;

-- Sum of Costs: 모든 에이전트 개별 소요시간 합 (MAPF 표준)
ALTER TABLE mcs_simulation_result
  ADD COLUMN IF NOT EXISTS sum_of_costs FLOAT DEFAULT 0.0;

-- 평균 AMR 대기 시간: pickup_time - request_time 평균
ALTER TABLE mcs_simulation_result
  ADD COLUMN IF NOT EXISTS avg_wait_time FLOAT DEFAULT 0.0;

-- AMR 가동률: Σbusy_time / (N_amr × T_sim) × 100
ALTER TABLE mcs_simulation_result
  ADD COLUMN IF NOT EXISTS amr_utilization FLOAT DEFAULT 0.0;

-- 교착 발생률: 교착 건수 / 시뮬레이션 시간(분)
ALTER TABLE mcs_simulation_result
  ADD COLUMN IF NOT EXISTS deadlock_rate FLOAT DEFAULT 0.0;

-- 경로 최적성: Σ(optimal_cost / actual_cost) / N × 100
ALTER TABLE mcs_simulation_result
  ADD COLUMN IF NOT EXISTS path_optimality FLOAT DEFAULT 0.0;

-- MAPF Conflict 횟수: vertex/edge conflict 진짜 개수
ALTER TABLE mcs_simulation_result
  ADD COLUMN IF NOT EXISTS conflict_count INTEGER DEFAULT 0;

-- 다중 시드 실행 시 신뢰구간 (95% CI)
ALTER TABLE mcs_simulation_result
  ADD COLUMN IF NOT EXISTS makespan_ci_low FLOAT DEFAULT NULL;
ALTER TABLE mcs_simulation_result
  ADD COLUMN IF NOT EXISTS makespan_ci_high FLOAT DEFAULT NULL;
ALTER TABLE mcs_simulation_result
  ADD COLUMN IF NOT EXISTS avg_transfer_time_ci_low FLOAT DEFAULT NULL;
ALTER TABLE mcs_simulation_result
  ADD COLUMN IF NOT EXISTS avg_transfer_time_ci_high FLOAT DEFAULT NULL;

-- 시드 수 (다중 시드 실행 시)
ALTER TABLE mcs_simulation_result
  ADD COLUMN IF NOT EXISTS seed_count INTEGER DEFAULT 1;

-- 폴백 여부 (PPO → A* 폴백 시 true)
ALTER TABLE mcs_simulation_result
  ADD COLUMN IF NOT EXISTS fallback BOOLEAN DEFAULT FALSE;
