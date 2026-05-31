"""
ExperimentRunner — 시드 다중 실행 + 통계 분석 (SCI 저널 게재용)

Stern et al. (SoCS 2019): 25시드 이상 반복, Wilcoxon + Bonferroni 권장
"""
import logging
import random
from typing import Callable, Dict, List, Optional

import networkx as nx

from engine.simulation import McsSimulation
from engine.stats import summary_stats, pairwise_wilcoxon

logger = logging.getLogger(__name__)

# 저널 표준 시드 집합 (재현 가능)
DEFAULT_SEEDS = list(range(1, 26))  # 1~25 (25시드)

# 보고할 메트릭 키 (raw_* / equipment_busy 제외)
REPORT_METRICS = [
    "makespan", "sum_of_costs", "avg_transfer_time", "avg_wait_time",
    "amr_utilization", "throughput", "deadlock_count", "deadlock_rate",
    "path_optimality", "conflict_count", "collision_count",
    "equipment_utilization", "route_efficiency_score",
]


class ExperimentRunner:
    """
    시드 다중 실행 + Wilcoxon 통계 검정을 한 번에 수행.

    사용 예:
        runner = ExperimentRunner(graph, unit_labels, scenario_params)
        result = runner.run_replications(
            algorithms=["astar", "cbs_ts"],
            seeds=DEFAULT_SEEDS,
        )
        # result["astar"]["makespan"] = {"mean": ..., "ci_low": ..., ...}
    """

    def __init__(
        self,
        graph: nx.DiGraph,
        unit_labels: Dict[str, str],
        scenario_params: dict,
        progress_callback: Optional[Callable[[int], None]] = None,
    ):
        self.graph            = graph
        self.unit_labels      = unit_labels
        self.scenario_params  = scenario_params
        self.progress_callback = progress_callback

    def run_replications(
        self,
        algorithms: List[str],
        seeds: List[int] = DEFAULT_SEEDS,
    ) -> Dict:
        """
        Args:
            algorithms: 비교할 알고리즘 목록
            seeds: 시드 목록

        Returns:
            {
              "per_algorithm": {
                algorithm: {
                  metric: {"mean", "std", "ci_low", "ci_high", "n"}
                }
              },
              "pairwise_pvalues": {
                metric: {(alg_a, alg_b): p_value}
              },
              "raw": {
                algorithm: {metric: [seed1_val, seed2_val, ...]}
              },
              "seed_count": int,
            }
        """
        total_runs = len(seeds) * len(algorithms)
        raw: Dict[str, Dict[str, List]] = {
            alg: {m: [] for m in REPORT_METRICS}
            for alg in algorithms
        }
        # 첫 시드 agent_traces 캡처 (재생 뷰 대표)
        first_seed_traces: Dict[str, list] = {}

        for run_idx, seed in enumerate(seeds):
            try:
                sim = McsSimulation(
                    graph=self.graph,
                    unit_labels=self.unit_labels,
                    scenario_params=self.scenario_params,
                    algorithms=algorithms,
                    seed=seed,
                )
                results = sim.run()

                for alg in algorithms:
                    metrics = results.get(alg, {})
                    for m in REPORT_METRICS:
                        val = metrics.get(m, 0.0)
                        raw[alg][m].append(float(val))
                    # 첫 시드에서만 agent_traces 수집
                    if run_idx == 0:
                        traces = metrics.get("agent_traces", [])
                        if traces:
                            first_seed_traces[alg] = traces

            except Exception as exc:
                logger.error(f"시드 {seed} 실행 실패: {exc}")

            if self.progress_callback:
                progress = int((run_idx + 1) / len(seeds) * 100)
                self.progress_callback(progress)

        # ── 통계 분석 ──
        per_algorithm: Dict = {}
        for alg in algorithms:
            per_algorithm[alg] = {}
            for m in REPORT_METRICS:
                stats = summary_stats({alg: raw[alg][m]})
                per_algorithm[alg][m] = stats.get(alg, {})

        # ── Wilcoxon pairwise (메트릭별) ──
        pairwise: Dict[str, Dict] = {}
        for m in REPORT_METRICS:
            raw_by_alg = {alg: raw[alg][m] for alg in algorithms}
            pairs = pairwise_wilcoxon(raw_by_alg)
            pairwise[m] = {
                f"{a}__vs__{b}": round(p, 6)
                for (a, b), p in pairs.items()
            }

        return {
            "per_algorithm": per_algorithm,
            "pairwise_pvalues": pairwise,
            "raw": raw,
            "seed_count": len(seeds),
            "algorithms": algorithms,
            "agent_traces": first_seed_traces,  # 첫 시드 대표 trace
        }
