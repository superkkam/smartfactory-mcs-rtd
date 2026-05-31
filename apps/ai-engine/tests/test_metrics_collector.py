"""
MetricsCollector + TransferRecord 단위 테스트 (Phase 1)

검증 항목:
1. AMR 가동률 공식 — carrier_count에 비례, 노드 수 무관
2. Makespan = max(end_time) - min(request_time)
3. Path optimality = optimal / actual (클리핑 없음 > 1 불가)
4. Deadlock count 증가 확인
5. Equipment utilization 누적
"""
import pytest
from engine.simulation import TransferRecord, MetricsCollector


def _make_record(
    carrier_id=1,
    source="A", dest="B",
    path=None,
    request_time=0.0,
    pickup_time=1.0,
    end_time=10.0,
    optimal_cost=5.0,
    actual_cost=5.0,
    waited=False,
    conflict_count=0,
):
    return TransferRecord(
        carrier_id=carrier_id,
        source_id=source,
        dest_id=dest,
        path=path or ["A", "B"],
        request_time=request_time,
        pickup_time=pickup_time,
        start_time=pickup_time,
        end_time=end_time,
        optimal_path_cost=optimal_cost,
        actual_path_cost=actual_cost,
        waited=waited,
        conflict_count=conflict_count,
    )


def test_amr_utilization_proportional_to_carrier_count():
    """가동률 = busy_time / (N_amr × makespan), carrier_count에 반비례"""
    mc = MetricsCollector()
    # 1대 AMR, request_time=0 end_time=5 → makespan=5, busy=5
    # utilization = 5 / (1 × 5) = 100%
    mc.record(_make_record(request_time=0.0, pickup_time=0.0, end_time=5.0))
    summary = mc.summary(simulation_duration=10.0, carrier_count=1)
    assert abs(summary["amr_utilization"] - 100.0) < 0.5

    mc2 = MetricsCollector()
    # 2대 AMR, makespan=5, busy=5 → utilization = 5 / (2 × 5) = 50%
    mc2.record(_make_record(request_time=0.0, pickup_time=0.0, end_time=5.0))
    summary2 = mc2.summary(simulation_duration=10.0, carrier_count=2)
    assert abs(summary2["amr_utilization"] - 50.0) < 0.5


def test_makespan_is_end_minus_first_request():
    """Makespan = last end_time - first request_time"""
    mc = MetricsCollector()
    mc.record(_make_record(request_time=0.0, pickup_time=1.0, end_time=10.0))
    mc.record(_make_record(request_time=2.0, pickup_time=3.0, end_time=15.0))
    summary = mc.summary(simulation_duration=20.0, carrier_count=2)
    # makespan = 15 - 0 = 15
    assert abs(summary["makespan"] - 15.0) < 0.01


def test_path_optimality_capped_at_100():
    """경로 최적성은 100 초과 불가 (실제 < 최단은 있을 수 없음)"""
    mc = MetricsCollector()
    # actual < optimal → clamp to 1.0
    mc.record(_make_record(optimal_cost=10.0, actual_cost=5.0))
    summary = mc.summary(simulation_duration=20.0, carrier_count=1)
    assert summary["path_optimality"] <= 100.0


def test_path_optimality_suboptimal():
    """실제 비용이 최단보다 2배 → optimality = 50%"""
    mc = MetricsCollector()
    mc.record(_make_record(optimal_cost=5.0, actual_cost=10.0))
    summary = mc.summary(simulation_duration=20.0, carrier_count=1)
    assert abs(summary["path_optimality"] - 50.0) < 1.0


def test_deadlock_count_increments():
    """record_deadlock() 호출 횟수만큼 deadlock_count 증가"""
    mc = MetricsCollector()
    mc.record(_make_record())
    mc.record_deadlock()
    mc.record_deadlock()
    summary = mc.summary(simulation_duration=10.0, carrier_count=1)
    assert summary["deadlock_count"] == 2


def test_equipment_utilization_accumulates():
    """record_equipment_busy() 누적 후 equipment_busy에 반영"""
    mc = MetricsCollector()
    mc.record(_make_record())
    mc.record_equipment_busy("PROC-1", 3.0)
    mc.record_equipment_busy("PROC-1", 2.0)
    assert mc.equipment_busy["PROC-1"] == pytest.approx(5.0)


def test_empty_summary_returns_zero():
    """레코드 없으면 모든 지표 0"""
    mc = MetricsCollector()
    summary = mc.summary(simulation_duration=300.0, carrier_count=5)
    assert summary["makespan"] == 0.0
    assert summary["avg_transfer_time"] == 0.0
    assert summary["deadlock_count"] == 0


def test_avg_wait_time():
    """avg_wait_time = mean(pickup - request)"""
    mc = MetricsCollector()
    mc.record(_make_record(request_time=0.0, pickup_time=3.0, end_time=10.0))
    mc.record(_make_record(request_time=1.0, pickup_time=6.0, end_time=15.0))
    summary = mc.summary(simulation_duration=20.0, carrier_count=2)
    # wait: 3.0 + 5.0 = 8.0, mean = 4.0
    assert abs(summary["avg_wait_time"] - 4.0) < 0.01
