"""
시뮬레이션 엔드포인트
POST /api/simulation/run   — 시뮬레이션 시작 (즉시 runId 반환)
GET  /api/simulation/status/{id} — 진행률 폴링
GET  /api/simulation/result/{id} — 완료 후 결과 조회
"""
import uuid
import logging
import numpy as np
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from models.schemas import (
    SimulationRunRequest,
    SimulationRunResponse,
    SimulationStatusResponse,
    SimulationResultResponse,
    SimulationResultItem,
    SimulationComparison,
    PairwisePvalues,
)
from services.simulation_store import simulation_store

router = APIRouter(prefix="/api/simulation", tags=["simulation"])
logger = logging.getLogger(__name__)


@router.post("/run", response_model=SimulationRunResponse)
async def start_simulation(
    req: SimulationRunRequest,
    background_tasks: BackgroundTasks,
) -> SimulationRunResponse:
    from services.supabase_client import get_supabase

    layout_id = req.scenarioParams.layoutId
    if not layout_id:
        raise HTTPException(status_code=400, detail="scenarioParams.layoutId 필수")

    run_id = str(uuid.uuid4())
    try:
        supabase = get_supabase()
        supabase.table("mcs_simulation_run").insert({
            "id": run_id,
            "layout_id": layout_id,
            "scenario_params": {
                "carrierCount":          req.scenarioParams.carrierCount,
                "utilizationRate":       req.scenarioParams.utilizationRate,
                "transferRequestCount":  req.scenarioParams.transferRequestCount,
                "simulationDuration":    req.scenarioParams.simulationDuration,
                "mode":                  req.scenarioParams.mode,
            },
            "algorithms": ",".join(req.algorithms),
            "status": "Running",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.error(f"시뮬레이션 DB 레코드 생성 실패: {e}")
        raise HTTPException(status_code=500, detail=f"DB 오류: {e}")

    simulation_store.create(run_id)
    background_tasks.add_task(_run_simulation_background, run_id=run_id, req=req)
    return SimulationRunResponse(runId=run_id, status="Running")


@router.get("/status/{run_id}", response_model=SimulationStatusResponse)
async def get_simulation_status(run_id: str) -> SimulationStatusResponse:
    state = simulation_store.get(run_id)
    if state is None:
        try:
            from services.supabase_client import get_supabase
            resp = get_supabase().table("mcs_simulation_run") \
                .select("status").eq("id", run_id).single().execute()
            db_status = resp.data.get("status", "Unknown") if resp.data else "Unknown"
            progress  = 100 if db_status == "Completed" else 0
            return SimulationStatusResponse(runId=run_id, status=db_status, progress=progress)
        except Exception:
            raise HTTPException(status_code=404, detail=f"시뮬레이션 없음: {run_id}")

    return SimulationStatusResponse(
        runId=run_id, status=state.status, progress=state.progress
    )


@router.get("/result/{run_id}", response_model=SimulationResultResponse)
async def get_simulation_result(run_id: str) -> SimulationResultResponse:
    from services.supabase_client import get_supabase

    try:
        supabase = get_supabase()
        run_resp = supabase.table("mcs_simulation_run") \
            .select("status").eq("id", run_id).single().execute()
        if not run_resp.data:
            raise HTTPException(status_code=404, detail=f"시뮬레이션 없음: {run_id}")
        status = run_resp.data["status"]

        res_resp = supabase.table("mcs_simulation_result") \
            .select("*").eq("simulation_run_id", run_id).execute()
        result_rows = res_resp.data or []
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"결과 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"DB 오류: {e}")

    results = [_row_to_result_item(row) for row in result_rows]

    # agent trace + conflict events attach (인메모리)
    traces_by_alg  = simulation_store.get_agent_traces(run_id) or {}
    events_by_alg  = simulation_store.get_conflict_events(run_id) or {}
    for item in results:
        raw_traces = traces_by_alg.get(item.algorithm)
        if raw_traces:
            from models.schemas import AgentTrace, ConflictEvent
            item.agentTraces = [
                AgentTrace(
                    agentId=t.get("agentId", ""),
                    srcUnit=t.get("srcUnit", ""),
                    dstUnit=t.get("dstUnit", ""),
                    path=t.get("path", []),
                    startTime=t.get("startTime", 0.0),
                    endTime=t.get("endTime", 0.0),
                )
                for t in raw_traces
                if t.get("path")
            ]
        raw_events = events_by_alg.get(item.algorithm)
        if raw_events:
            from models.schemas import ConflictEvent
            item.conflictEvents = [
                ConflictEvent(
                    carrierId=e.get("carrierId", ""),
                    nodeId=e.get("nodeId", ""),
                    time=e.get("time", 0.0),
                )
                for e in raw_events
            ]

    pvalues = simulation_store.get_pvalues(run_id)
    comparison    = _compute_comparison(results, pvalues)
    distributions = _compute_distributions_from_store(run_id, results)

    return SimulationResultResponse(
        runId=run_id,
        status=status,
        results=results,
        comparison=comparison,
        distributions=distributions,
    )


# ── 백그라운드 실행 ───────────────────────────────────────────────

def _run_simulation_background(run_id: str, req: SimulationRunRequest) -> None:
    from services.graph_loader import load_graph
    from services.supabase_client import get_supabase
    from engine.simulation import McsSimulation

    try:
        layout_id = req.scenarioParams.layoutId
        graph, unit_labels = load_graph(layout_id)

        scenario_dict = {
            "layoutId":             layout_id,
            "carrierCount":         req.scenarioParams.carrierCount,
            "utilizationRate":      req.scenarioParams.utilizationRate,
            "transferRequestCount": req.scenarioParams.transferRequestCount,
            "simulationDuration":   req.scenarioParams.simulationDuration,
            "mode":                 req.scenarioParams.mode,
        }

        seeds = req.seeds or [None]
        n_seeds = len([s for s in seeds if s is not None])
        raw_by_alg: dict = {alg: {} for alg in req.algorithms}

        if n_seeds >= 2:
            # ── 다중 시드: ExperimentRunner로 통계 + Wilcoxon 검정 ──
            from engine.experiment_runner import ExperimentRunner

            valid_seeds = [s for s in seeds if s is not None]
            runner = ExperimentRunner(
                graph=graph,
                unit_labels=unit_labels,
                scenario_params=scenario_dict,
                progress_callback=lambda p: simulation_store.update_progress(run_id, p),
            )
            exp_result = runner.run_replications(
                algorithms=req.algorithms,
                seeds=valid_seeds,
            )

            # raw 데이터를 simulation_store 형식으로 변환
            for alg in req.algorithms:
                raw_by_alg[alg] = exp_result["raw"].get(alg, {})

            # Wilcoxon p-value 저장
            simulation_store.store_pvalues(run_id, exp_result["pairwise_pvalues"])

            # 첫 시드 agent_traces 저장 (재생 뷰용)
            first_traces = exp_result.get("agent_traces", {})
            if first_traces:
                simulation_store.store_agent_traces(run_id, first_traces)

            # per_algorithm → DB 저장용 평균값 추출
            per_alg = exp_result["per_algorithm"]

            def get_mean(alg: str, key: str) -> float:
                return per_alg.get(alg, {}).get(key, {}).get("mean", 0.0)

            def get_ci(alg: str, key: str):
                d = per_alg.get(alg, {}).get(key, {})
                lo = d.get("ci_low")
                hi = d.get("ci_high")
                return lo, hi

            supabase = get_supabase()
            for alg in req.algorithms:
                makespan_ci_lo, makespan_ci_hi = get_ci(alg, "makespan")
                att_ci_lo, att_ci_hi           = get_ci(alg, "avg_transfer_time")
                fallback_list = raw_by_alg[alg].get("fallback", [])
                is_fallback   = any(fallback_list) if fallback_list else False

                supabase.table("mcs_simulation_result").insert({
                    "simulation_run_id":      run_id,
                    "algorithm":              alg,
                    "avg_transfer_time":      get_mean(alg, "avg_transfer_time"),
                    "throughput":             get_mean(alg, "throughput"),
                    "collision_count":        int(get_mean(alg, "collision_count")),
                    "load_balance_std":       0.0,
                    "equipment_utilization":  get_mean(alg, "equipment_utilization"),
                    "deadlock_count":         int(get_mean(alg, "deadlock_count")),
                    "route_efficiency_score": get_mean(alg, "route_efficiency_score"),
                }).execute()

                try:
                    supabase.table("mcs_simulation_result").update({
                        "makespan":                  get_mean(alg, "makespan"),
                        "sum_of_costs":              get_mean(alg, "sum_of_costs"),
                        "avg_wait_time":             get_mean(alg, "avg_wait_time"),
                        "amr_utilization":           get_mean(alg, "amr_utilization"),
                        "deadlock_rate":             get_mean(alg, "deadlock_rate"),
                        "path_optimality":           get_mean(alg, "path_optimality"),
                        "conflict_count":            int(get_mean(alg, "conflict_count")),
                        "makespan_ci_low":           makespan_ci_lo,
                        "makespan_ci_high":          makespan_ci_hi,
                        "avg_transfer_time_ci_low":  att_ci_lo,
                        "avg_transfer_time_ci_high": att_ci_hi,
                        "seed_count":                n_seeds,
                        "fallback":                  is_fallback,
                    }).eq("simulation_run_id", run_id).eq("algorithm", alg).execute()
                except Exception as e:
                    logger.warning(f"저널 메트릭 업데이트 건너뜀 (Migration 009 미적용?): {e}")

        else:
            # ── 단일 시드: 기존 방식 ──
            seed = seeds[0] if seeds else None

            sim = McsSimulation(
                graph=graph,
                unit_labels=unit_labels,
                scenario_params=scenario_dict,
                algorithms=req.algorithms,
                seed=seed,
            )
            results_this_seed = sim.run(
                progress_callback=lambda p: simulation_store.update_progress(run_id, int(p))
            )
            for alg, metrics in results_this_seed.items():
                for k, v in metrics.items():
                    # list-of-dict 필드는 덮어쓰기 (시드 단일이므로)
                    if k in ("agent_traces", "conflict_events"):
                        raw_by_alg[alg][k] = v
                        continue
                    if k not in raw_by_alg[alg]:
                        raw_by_alg[alg][k] = []
                    if isinstance(v, list):
                        raw_by_alg[alg][k].extend(v)
                    else:
                        raw_by_alg[alg][k].append(v)

            supabase = get_supabase()
            for alg, metric_lists in raw_by_alg.items():
                def avg(k: str, default: float = 0.0) -> float:
                    vals = metric_lists.get(k)
                    if vals and isinstance(vals[0], (int, float)):
                        return float(sum(vals) / len(vals))
                    return default

                fallback_list = metric_lists.get("fallback", [])
                is_fallback   = any(fallback_list) if fallback_list else False

                supabase.table("mcs_simulation_result").insert({
                    "simulation_run_id":      run_id,
                    "algorithm":              alg,
                    "avg_transfer_time":      avg("avg_transfer_time"),
                    "throughput":             avg("throughput"),
                    "collision_count":        int(avg("collision_count")),
                    "load_balance_std":       avg("load_balance_std"),
                    "equipment_utilization":  avg("equipment_utilization"),
                    "deadlock_count":         int(avg("deadlock_count")),
                    "route_efficiency_score": avg("route_efficiency_score"),
                }).execute()

                try:
                    supabase.table("mcs_simulation_result").update({
                        "makespan":       avg("makespan"),
                        "sum_of_costs":   avg("sum_of_costs"),
                        "avg_wait_time":  avg("avg_wait_time"),
                        "amr_utilization": avg("amr_utilization"),
                        "deadlock_rate":  avg("deadlock_rate"),
                        "path_optimality": avg("path_optimality"),
                        "conflict_count": int(avg("conflict_count")),
                        "seed_count":     1,
                        "fallback":       is_fallback,
                    }).eq("simulation_run_id", run_id).eq("algorithm", alg).execute()
                except Exception as e:
                    logger.warning(f"저널 메트릭 업데이트 건너뜀 (Migration 009 미적용?): {e}")

        supabase.table("mcs_simulation_run").update({
            "status": "Completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", run_id).execute()

        # raw 분포 데이터 저장 (분포 차트용)
        simulation_store.store_raw(run_id, raw_by_alg)

        # agent trace + conflict events 저장 (재생 뷰용)
        agent_traces_by_alg: dict = {}
        conflict_events_by_alg: dict = {}
        for alg in req.algorithms:
            traces = raw_by_alg[alg].get("agent_traces")
            if traces:
                if isinstance(traces[0], list):
                    agent_traces_by_alg[alg] = traces[0]
                else:
                    agent_traces_by_alg[alg] = traces
            events = raw_by_alg[alg].get("conflict_events")
            if events:
                conflict_events_by_alg[alg] = events
        simulation_store.store_agent_traces(run_id, agent_traces_by_alg)
        simulation_store.store_conflict_events(run_id, conflict_events_by_alg)

        simulation_store.complete(run_id)
        logger.info(f"시뮬레이션 완료: {run_id}")

    except Exception as e:
        logger.error(f"시뮬레이션 실행 오류 ({run_id}): {e}")
        simulation_store.fail(run_id, str(e))
        try:
            from services.supabase_client import get_supabase
            get_supabase().table("mcs_simulation_run").update({
                "status": "Failed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", run_id).execute()
        except Exception:
            pass


# ── 유틸 ─────────────────────────────────────────────────────────

def _row_to_result_item(row: dict) -> SimulationResultItem:
    def _f(key: str, default: float = 0.0) -> float:
        v = row.get(key)
        return float(v) if v is not None else default

    def _opt_f(key: str):
        v = row.get(key)
        return float(v) if v is not None else None

    return SimulationResultItem(
        algorithm=row["algorithm"],
        makespan=_f("makespan"),
        sumOfCosts=_f("sum_of_costs"),
        avgTransferTime=_f("avg_transfer_time"),
        avgWaitTime=_f("avg_wait_time"),
        amrUtilization=_f("amr_utilization"),
        throughput=_f("throughput"),
        deadlockCount=int(_f("deadlock_count")),
        deadlockRate=_f("deadlock_rate"),
        pathOptimality=_f("path_optimality"),
        conflictCount=int(_f("conflict_count")),
        collisionCount=int(_f("collision_count")),
        loadBalanceStd=_f("load_balance_std"),
        equipmentUtilization=_f("equipment_utilization"),
        routeEfficiencyScore=_f("route_efficiency_score"),
        makespanCiLow=_opt_f("makespan_ci_low") or 0.0,
        makespanCiHigh=_opt_f("makespan_ci_high") or 0.0,
        avgTransferTimeCiLow=_opt_f("avg_transfer_time_ci_low") or 0.0,
        avgTransferTimeCiHigh=_opt_f("avg_transfer_time_ci_high") or 0.0,
        seedCount=int(row.get("seed_count") or 1),
        fallback=bool(row.get("fallback", False)),
    )


def _compute_comparison(
    results: list,
    pvalues: Optional[dict] = None,
) -> Optional[SimulationComparison]:
    """A* 기준 N-알고리즘 비교 (부호 보존, 클램프 없음)"""
    astar = next((r for r in results if r.algorithm == "astar"), None)
    if not astar:
        return None

    def pct(old: float, new: float) -> float:
        return round((new - old) / old * 100.0, 1) if old != 0 else 0.0

    others = [r for r in results if r.algorithm != "astar"]
    if not others:
        return None

    best_time = min(others, key=lambda r: r.avgTransferTime)
    best_util = max(others, key=lambda r: r.amrUtilization)

    transfer_reduction = pct(astar.avgTransferTime, best_time.avgTransferTime) * -1
    util_increase      = pct(astar.amrUtilization,  best_util.amrUtilization)

    if astar.deadlockCount == 0:
        deadlock_elim = 0.0
    else:
        best_deadlock = min(others, key=lambda r: r.deadlockCount)
        deadlock_elim = round(
            (1 - best_deadlock.deadlockCount / max(astar.deadlockCount, 1)) * 100.0, 1
        )

    best_eff  = max(others, key=lambda r: r.pathOptimality)
    best_thru = max(others, key=lambda r: r.throughput)

    # Wilcoxon p-value (ExperimentRunner가 저장한 데이터)
    pairwise_pv = None
    if pvalues:
        # 키 형식: {"makespan": {"astar__vs__cbs_ts": 0.001, ...}, ...}
        pairwise_pv = PairwisePvalues(
            makespan=pvalues.get("makespan", {}),
            sumOfCosts=pvalues.get("sum_of_costs", {}),
            avgTransferTime=pvalues.get("avg_transfer_time", {}),
            pathOptimality=pvalues.get("path_optimality", {}),
        )

    return SimulationComparison(
        transferTimeReduction=transfer_reduction,
        utilizationIncrease=util_increase,
        deadlockElimination=deadlock_elim,
        efficiencyIncrease=pct(astar.pathOptimality, best_eff.pathOptimality),
        throughputIncrease=pct(astar.throughput,     best_thru.throughput),
        pairwisePvalues=pairwise_pv,
    )


def _compute_distributions_from_store(run_id: str, results: list[SimulationResultItem]) -> dict:
    """인메모리 raw 데이터 기반 진짜 분포 — 가짜 추정 데이터 없음"""
    raw_by_alg = simulation_store.get_raw(run_id) or {}

    # ── 반송 시간 히스토그램 (raw_transfer_times 기반) ──
    bins = [0, 5, 10, 15, 20, 30, 60, float("inf")]
    bin_labels = ["0-5s", "5-10s", "10-15s", "15-20s", "20-30s", "30-60s", "60s+"]

    transfer_time_dist = [{
        "range": label, **{
            alg: int(np.histogram(
                raw_by_alg.get(alg, {}).get("raw_transfer_times", [0]),
                bins=bins
            )[0][i])
            for alg in (raw_by_alg.keys() or [r.algorithm for r in results])
        }
    } for i, label in enumerate(bin_labels)]

    # ── 장비별 가동률 (equipment_busy 기반) ──
    # 모든 알고리즘에 공통 equipment 집합
    all_equip: set = set()
    for alg_data in raw_by_alg.values():
        eq_busy = alg_data.get("equipment_busy", {})
        if isinstance(eq_busy, list) and eq_busy:
            # 여러 시드 dict의 키 합집합
            for d in eq_busy:
                if isinstance(d, dict):
                    all_equip.update(d.keys())
        elif isinstance(eq_busy, dict):
            all_equip.update(eq_busy.keys())

    equipment_util_dist = []
    for eq in sorted(all_equip):
        row: dict = {"equipment": eq}
        for alg, alg_data in raw_by_alg.items():
            eq_busy = alg_data.get("equipment_busy", {})
            if isinstance(eq_busy, list):
                util_vals = [
                    d.get(eq, 0.0) for d in eq_busy if isinstance(d, dict)
                ]
                row[alg] = round(sum(util_vals) / len(util_vals), 1) if util_vals else 0.0
            elif isinstance(eq_busy, dict):
                row[alg] = round(eq_busy.get(eq, 0.0), 1)
            else:
                row[alg] = 0.0
        equipment_util_dist.append(row)

    # equipment가 없으면 빈 리스트 반환 (가짜 데이터 금지)
    return {
        "transferTime":         transfer_time_dist,
        "equipmentUtilization": equipment_util_dist,
    }
