"""
CAIE 저널 실험 — MAPF 알고리즘 4종 비교 (Computers and Industrial Engineering, Elsevier)

실험 설계:
  알고리즘 : A* (baseline), PPO-RL, CACTUS-MARL (QMix), CBS-TS (MILP+CBS)
  시나리오 : 3종 (소규모/중규모/대규모 반송 부하)
  반복     : 30 시드 (Stern et al., SoCS 2019 권장 기준 초과)
  모드     : online (실시간 배차, RTD 운영 조건)

통계 검정:
  Kruskal-Wallis H 검정 (전체 비교, 비모수 ANOVA)
  사후 Wilcoxon signed-rank + Holm-Bonferroni 보정
  효과 크기: rank-biserial correlation r
  유의수준: *** p<0.001, ** p<0.01, * p<0.05

출력:
  output/caie_<timestamp>/
    raw_results.json          — 시드별 원시 수치 전체
    summary_stats.json        — 알고리즘 × 시나리오 × 지표 요약 통계
    summary.csv               — 논문 표 작성용 CSV
    statistical_tests.json    — Kruskal-Wallis + Wilcoxon 결과
    figures/                  — 논문 그림 (caie_figures.py 별도 실행)
    tables/                   — LaTeX 표 (caie_tables.py 별도 실행)

사용법:
    cd apps/ai-engine

    # (1) 레이아웃 fixture 먼저 생성 (Supabase 필요, 1회)
    python scripts/export_layout.py --layout-id <UUID> --out scripts/fixtures/fab_layout.json
    # 또는 합성 레이아웃 (Supabase 불필요, PPO는 A*로 폴백)
    python scripts/export_layout.py --synthetic --out scripts/fixtures/fab_layout.json

    # (2) 실험 실행
    python scripts/caie_experiment.py --fixture scripts/fixtures/fab_layout.json
    python scripts/caie_experiment.py --fixture scripts/fixtures/fab_layout.json --seeds 30
    python scripts/caie_experiment.py --fixture scripts/fixtures/fab_layout.json --algorithms astar ai_ppo cbs_ts

참조:
  Stern et al. (2019). Multi-Agent Pathfinding: Definitions, Variants, and Benchmarks. SoCS.
  Demšar (2006). Statistical Comparisons of Classifiers over Multiple Data Sets. JMLR.
  Bahaji & Kuhl (2008). A simulation study of AMHS dispatching. IJPR.
"""
from __future__ import annotations

import argparse
import json
import logging
import math
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import csv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── 실험 설정 ─────────────────────────────────────────────────────

ALGORITHMS = ["astar", "ai_ppo", "cactus", "cbs_ts"]

ALG_LABELS = {
    "astar":       "A*",
    "ai_ppo":      "PPO-RL",
    "cactus":      "CACTUS",
    "cbs_ts":      "CBS-TS",
    "cbs_ts_batch": "CBS-TS (Batch)",  # 오프라인 사전 계획 모드
}

SCENARIOS = [
    {
        "name":  "S1_Low",
        "label": "Low Density (8 AGVs, 100 tasks)",
        "params": {
            "carrierCount":          8,
            "transferRequestCount":  100,
            "simulationDuration":    300.0,
            "mode":                  "online",
        },
    },
    {
        "name":  "S2_Medium",
        "label": "Medium Density (16 AGVs, 200 tasks)",
        "params": {
            "carrierCount":          16,
            "transferRequestCount":  200,
            "simulationDuration":    300.0,
            "mode":                  "online",
        },
    },
    {
        "name":  "S3_High",
        "label": "High Density (32 AGVs, 350 tasks)",
        "params": {
            "carrierCount":          32,
            "transferRequestCount":  350,
            "simulationDuration":    600.0,
            "mode":                  "online",
        },
    },
]

# CBS-TS 배치 모드 시나리오 (동일 설정, mode="batch"로만 변경)
SCENARIOS_BATCH = [
    {
        **sc,
        "params": {**sc["params"], "mode": "batch"},
    }
    for sc in SCENARIOS
]

# 보고 지표 (순서 = 논문 표 열 순서)
PRIMARY_METRICS = [
    "makespan",
    "avg_transfer_time",
    "amr_utilization",
    "throughput",
    "deadlock_count",
    "path_optimality",
]

METRIC_LABELS = {
    "makespan":           "Makespan (s)",
    "avg_transfer_time":  "Avg. Transfer Time (s)",
    "amr_utilization":    "AMR Utilization (%)",
    "throughput":         "Throughput (tasks/s)",
    "deadlock_count":     "Deadlock Count",
    "path_optimality":    "Path Optimality (%)",
}

# 낮을수록 좋은 지표 (논문 표에서 최솟값 bold 처리용)
LOWER_IS_BETTER = {"makespan", "avg_transfer_time", "deadlock_count", "conflict_count"}


# ── 통계 유틸 ─────────────────────────────────────────────────────

def _kruskal_wallis(groups: Dict[str, List[float]]) -> Tuple[float, float]:
    """Kruskal-Wallis H 검정 (비모수 ANOVA). scipy 없으면 근사값 반환."""
    try:
        from scipy.stats import kruskal
        vals = list(groups.values())
        stat, p = kruskal(*vals)
        return float(stat), float(p)
    except ImportError:
        pass
    except Exception:
        pass
    # 근사: 모든 데이터 통합 후 랭크
    all_vals: List[Tuple[float, str]] = []
    for alg, vals in groups.items():
        all_vals.extend((v, alg) for v in vals)
    all_vals.sort(key=lambda x: x[0])
    n_total = len(all_vals)
    n_per = {alg: len(v) for alg, v in groups.items()}
    rank_sum: Dict[str, float] = {alg: 0.0 for alg in groups}
    for rank, (_, alg) in enumerate(all_vals, 1):
        rank_sum[alg] += rank
    k = len(groups)
    H = (12.0 / (n_total * (n_total + 1))) * sum(
        rank_sum[alg] ** 2 / n_per[alg] for alg in groups
    ) - 3 * (n_total + 1)
    # p-value: chi2 근사 (df = k-1)
    p = _chi2_sf(H, k - 1)
    return H, p


def _chi2_sf(x: float, df: int) -> float:
    """chi2 생존 함수 (오른쪽 꼬리). 근사."""
    try:
        from scipy.stats import chi2
        return float(chi2.sf(x, df))
    except ImportError:
        pass
    # 간단 근사: df=3인 경우 (알고리즘 4개 → df=3)
    if x <= 0:
        return 1.0
    if df == 3:
        table = [(6.25, 0.1), (7.81, 0.05), (11.35, 0.01), (16.27, 0.001)]
        for thresh, p in table:
            if x < thresh:
                return p
        return 0.0001
    return 0.05  # 보수적 기본값


def _wilcoxon(a: List[float], b: List[float]) -> Tuple[float, float]:
    """Wilcoxon signed-rank 검정. (p-value, effect_size r) 반환."""
    if len(a) != len(b) or len(a) == 0:
        return 1.0, 0.0
    try:
        from scipy.stats import wilcoxon
        stat, p = wilcoxon(a, b, zero_method="wilcox", alternative="two-sided")
        n = len([x for x, y in zip(a, b) if abs(x - y) > 1e-10])
        r = 1.0 - (2.0 * stat) / (n * (n + 1)) if n > 0 else 0.0
        return float(p), round(abs(float(r)), 3)
    except Exception:
        pass
    # 정규 근사 폴백
    import math
    diffs = [x - y for x, y in zip(a, b) if abs(x - y) > 1e-10]
    if not diffs:
        return 1.0, 0.0
    n = len(diffs)
    ranked = sorted(range(n), key=lambda i: abs(diffs[i]))
    W_plus = sum(i + 1 for i in ranked if diffs[i] > 0)
    mu_W = n * (n + 1) / 4.0
    sigma_W = math.sqrt(n * (n + 1) * (2 * n + 1) / 24.0)
    if sigma_W == 0:
        return 1.0, 0.0
    z = (W_plus - mu_W) / sigma_W
    p = 2.0 * (1.0 - _norm_cdf(abs(z)))
    r = abs(z) / math.sqrt(n)
    return p, round(r, 3)


def _norm_cdf(x: float) -> float:
    import math
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _holm_bonferroni(p_values: List[float]) -> List[float]:
    """Holm-Bonferroni 보정 (Bonferroni보다 검정력이 높음)."""
    m = len(p_values)
    if m == 0:
        return []
    indexed = sorted(enumerate(p_values), key=lambda x: x[1])
    adjusted = [1.0] * m
    for rank, (orig_idx, p) in enumerate(indexed):
        adj = p * (m - rank)
        adjusted[orig_idx] = min(adj, 1.0)
    # 단조성 보장: adjusted[i] >= adjusted[i-1] (오름차순)
    for i in range(1, len(indexed)):
        _, (idx_prev, _) = indexed[i - 1], indexed[i - 1]
        _, (idx_curr, _) = indexed[i], indexed[i]
        if adjusted[idx_curr] < adjusted[idx_prev]:
            adjusted[idx_curr] = adjusted[idx_prev]
    return adjusted


def sig_marker(p: float) -> str:
    if p < 0.001:
        return "***"
    if p < 0.01:
        return "**"
    if p < 0.05:
        return "*"
    return "ns"


# ── 요약 통계 ─────────────────────────────────────────────────────

def compute_summary(raw: List[float]) -> Dict[str, float]:
    if not raw:
        return {"mean": 0.0, "std": 0.0, "median": 0.0, "ci_low": 0.0, "ci_high": 0.0, "n": 0}
    import statistics
    n = len(raw)
    mean = statistics.mean(raw)
    std  = statistics.stdev(raw) if n > 1 else 0.0
    med  = statistics.median(raw)
    # 95% CI (t-분포 근사)
    t_crit = _t_critical_95(n - 1)
    se = std / math.sqrt(n)
    return {
        "mean":    round(mean, 4),
        "std":     round(std, 4),
        "median":  round(med, 4),
        "ci_low":  round(mean - t_crit * se, 4),
        "ci_high": round(mean + t_crit * se, 4),
        "n":       n,
    }


def _t_critical_95(df: int) -> float:
    table = {
        1: 12.706, 2: 4.303, 4: 2.776, 9: 2.262, 14: 2.145,
        19: 2.093, 24: 2.064, 29: 2.045, 39: 2.023, 59: 2.000,
    }
    for k in sorted(table.keys()):
        if df <= k:
            return table[k]
    return 1.960


# ── 실험 실행 ─────────────────────────────────────────────────────

def _preload_models(algorithms: List[str]) -> None:
    """PPO / CACTUS 모델을 실험 전 명시적으로 로드한다."""
    from config import settings

    if "ai_ppo" in algorithms:
        from engine.ppo_agent import ppo_agent
        if not ppo_agent.is_loaded:
            ok = ppo_agent.load(settings.model_path)
            logger.info(f"PPO 모델 {'로드 완료' if ok else '로드 실패 → A* 폴백'}: {settings.model_path}")

    if "cactus" in algorithms:
        from engine.cactus.qmix_agent import qmix_agent
        if not qmix_agent.is_loaded:
            ok = qmix_agent.load(settings.cactus_model_path)
            logger.info(f"CACTUS 모델 {'로드 완료' if ok else '로드 실패 → A* 폴백'}: {settings.cactus_model_path}")


def run_experiment(
    graph,
    unit_labels: Dict[str, str],
    algorithms: List[str],
    scenarios: List[Dict],
    seeds: List[int],
    out_dir: Path,
) -> Dict[str, Any]:
    """
    전체 실험 실행.

    Returns:
        results dict — raw, summary_stats, statistical_tests 포함
    """
    from engine.simulation import McsSimulation

    total_runs = len(scenarios) * len(seeds)
    completed  = 0

    all_raw: Dict[str, Dict[str, Dict[str, List[float]]]] = {}
    # all_raw[scenario_name][algorithm][metric] = [seed1, seed2, ...]

    for sc in scenarios:
        sc_name = sc["name"]
        sc_params = sc["params"]
        all_raw[sc_name] = {alg: {m: [] for m in PRIMARY_METRICS} for alg in algorithms}

        logger.info(
            f"\n{'='*60}\n"
            f"  시나리오: {sc['label']}\n"
            f"  {len(seeds)} 시드 × {len(algorithms)} 알고리즘 = {len(seeds)*len(algorithms)} 실행\n"
            f"{'='*60}"
        )

        for seed in seeds:
            t0 = time.perf_counter()
            try:
                sim = McsSimulation(
                    graph=graph,
                    unit_labels=unit_labels,
                    scenario_params=sc_params,
                    algorithms=algorithms,
                    seed=seed,
                )
                seed_results = sim.run()

                for alg in algorithms:
                    metrics = seed_results.get(alg, {})
                    for m in PRIMARY_METRICS:
                        val = metrics.get(m, 0.0)
                        all_raw[sc_name][alg][m].append(float(val))

            except Exception as exc:
                logger.warning(f"  [시드 {seed}] 오류 — {exc}")
                for alg in algorithms:
                    for m in PRIMARY_METRICS:
                        all_raw[sc_name][alg][m].append(0.0)

            completed += 1
            elapsed = time.perf_counter() - t0
            logger.info(
                f"  [{completed}/{total_runs}] 시드 {seed:3d} | {elapsed:.1f}s | "
                + " | ".join(
                    f"{ALG_LABELS.get(a,a)}: {all_raw[sc_name][a]['makespan'][-1]:.0f}s"
                    for a in algorithms
                )
            )

    # ── 요약 통계 ────────────────────────────────────────────────
    logger.info("\n요약 통계 계산 중...")
    summary_stats: Dict[str, Any] = {}
    for sc_name, sc_data in all_raw.items():
        summary_stats[sc_name] = {}
        for alg, alg_data in sc_data.items():
            summary_stats[sc_name][alg] = {}
            for metric, vals in alg_data.items():
                summary_stats[sc_name][alg][metric] = compute_summary(vals)

    # ── 통계 검정 ────────────────────────────────────────────────
    logger.info("통계 검정 실행 중...")
    stat_tests: Dict[str, Any] = {}

    for sc_name, sc_data in all_raw.items():
        stat_tests[sc_name] = {}
        for metric in PRIMARY_METRICS:
            groups = {alg: sc_data[alg][metric] for alg in algorithms}
            h_stat, kw_p = _kruskal_wallis(groups)
            stat_tests[sc_name][metric] = {
                "kruskal_wallis": {
                    "H":       round(h_stat, 4),
                    "p_value": round(kw_p, 6),
                    "sig":     sig_marker(kw_p),
                },
                "pairwise": {},
            }

            # 사후 pairwise Wilcoxon
            pairs = []
            raw_p = []
            alg_list = list(algorithms)
            for i in range(len(alg_list)):
                for j in range(i + 1, len(alg_list)):
                    a, b = alg_list[i], alg_list[j]
                    p, r_eff = _wilcoxon(sc_data[a][metric], sc_data[b][metric])
                    pairs.append((a, b, r_eff))
                    raw_p.append(p)

            adj_p = _holm_bonferroni(raw_p)
            for (a, b, r_eff), p_adj in zip(pairs, adj_p):
                key = f"{a}_vs_{b}"
                stat_tests[sc_name][metric]["pairwise"][key] = {
                    "p_adj":       round(p_adj, 6),
                    "effect_r":    r_eff,
                    "sig":         sig_marker(p_adj),
                }

    # ── CSV 저장 ─────────────────────────────────────────────────
    csv_path = out_dir / "summary.csv"
    _write_csv(summary_stats, algorithms, csv_path)
    logger.info(f"CSV 저장: {csv_path}")

    return {
        "raw":               all_raw,
        "summary_stats":     summary_stats,
        "statistical_tests": stat_tests,
        "algorithms":        algorithms,
        "scenarios":         [sc["name"] for sc in scenarios],
        "seeds":             seeds,
        "timestamp":         datetime.now().isoformat(),
    }


def run_cbsts_batch_experiment(
    graph,
    unit_labels: Dict[str, str],
    scenarios: List[Dict],
    seeds: List[int],
) -> Dict[str, Any]:
    """
    CBS-TS 배치 모드 보조 실험.
    온라인 실험의 CBS-TS(= A*)와 달리, 모든 작업을 사전에 CBS로 계획하여
    실제 충돌 해소 성능을 측정한다.

    Returns:
        {"raw": {sc_name: {"cbs_ts_batch": {metric: [...]}}},
         "summary_stats": {sc_name: {"cbs_ts_batch": {metric: stats}}}}
    """
    from engine.simulation import McsSimulation

    total_runs = len(scenarios) * len(seeds)
    completed  = 0
    alg_key    = "cbs_ts"  # McsSimulation 내부 키
    out_key    = "cbs_ts_batch"  # 결과 병합 키

    all_raw: Dict[str, Dict[str, Dict[str, List[float]]]] = {}

    for sc in scenarios:
        sc_name   = sc["name"]
        sc_params = sc["params"]  # mode: "batch" 포함
        all_raw[sc_name] = {out_key: {m: [] for m in PRIMARY_METRICS}}

        logger.info(
            f"\n{'='*60}\n"
            f"  [CBS-TS Batch] 시나리오: {sc['label']}\n"
            f"  {len(seeds)} 시드 실행\n"
            f"{'='*60}"
        )

        for seed in seeds:
            t0 = time.perf_counter()
            try:
                sim = McsSimulation(
                    graph=graph,
                    unit_labels=unit_labels,
                    scenario_params=sc_params,
                    algorithms=[alg_key],
                    seed=seed,
                )
                seed_results = sim.run()
                metrics = seed_results.get(alg_key, {})
                for m in PRIMARY_METRICS:
                    all_raw[sc_name][out_key][m].append(float(metrics.get(m, 0.0)))
            except Exception as exc:
                logger.warning(f"  [CBS-TS Batch 시드 {seed}] 오류 — {exc}")
                for m in PRIMARY_METRICS:
                    all_raw[sc_name][out_key][m].append(0.0)

            completed += 1
            elapsed = time.perf_counter() - t0
            logger.info(
                f"  [{completed}/{total_runs}] 시드 {seed:3d} | {elapsed:.1f}s | "
                f"CBS-TS(Batch): makespan={all_raw[sc_name][out_key]['makespan'][-1]:.0f}s"
            )

    summary_stats: Dict[str, Any] = {}
    for sc_name, sc_data in all_raw.items():
        summary_stats[sc_name] = {}
        for alg, alg_data in sc_data.items():
            summary_stats[sc_name][alg] = {}
            for metric, vals in alg_data.items():
                summary_stats[sc_name][alg][metric] = compute_summary(vals)

    return {"raw": all_raw, "summary_stats": summary_stats}


def _write_csv(
    summary_stats: Dict,
    algorithms: List[str],
    csv_path: Path,
) -> None:
    rows = []
    header = ["scenario", "algorithm"] + [f"{m}_mean" for m in PRIMARY_METRICS] + \
             [f"{m}_std"  for m in PRIMARY_METRICS]

    for sc_name, sc_data in summary_stats.items():
        for alg in algorithms:
            row = [sc_name, ALG_LABELS.get(alg, alg)]
            for m in PRIMARY_METRICS:
                row.append(round(sc_data.get(alg, {}).get(m, {}).get("mean", 0.0), 3))
            for m in PRIMARY_METRICS:
                row.append(round(sc_data.get(alg, {}).get(m, {}).get("std", 0.0), 3))
            rows.append(row)

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


# ── CLI ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="CAIE 저널 실험 — MAPF 알고리즘 4종 비교",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--fixture",
        default="scripts/fixtures/fab_layout.json",
        help="레이아웃 fixture JSON (export_layout.py로 생성)",
    )
    parser.add_argument(
        "--seeds", type=int, default=30,
        help="반복 시드 수 (기본: 30)",
    )
    parser.add_argument(
        "--algorithms", nargs="+", default=ALGORITHMS,
        choices=ALGORITHMS,
        help="비교할 알고리즘 (기본: 전체 4종)",
    )
    parser.add_argument(
        "--scenarios", nargs="+",
        default=["S1_Low", "S2_Medium", "S3_High"],
        choices=["S1_Low", "S2_Medium", "S3_High"],
        help="실행할 시나리오",
    )
    parser.add_argument(
        "--out", default="output",
        help="결과 저장 루트 디렉토리",
    )
    parser.add_argument(
        "--no-batch", action="store_true",
        help="CBS-TS 배치 모드 보조 실험 생략",
    )
    args = parser.parse_args()

    # ── 레이아웃 로드 ──────────────────────────────────────────────
    fixture_path = Path(args.fixture)
    if not fixture_path.exists():
        logger.error(
            f"fixture 파일 없음: {fixture_path}\n"
            "먼저 실행하세요:\n"
            "  python scripts/export_layout.py --synthetic --out scripts/fixtures/fab_layout.json"
        )
        sys.exit(1)

    import importlib.util
    _spec = importlib.util.spec_from_file_location(
        "export_layout",
        Path(__file__).parent / "export_layout.py",
    )
    _mod = importlib.util.module_from_spec(_spec)  # type: ignore[arg-type]
    _spec.loader.exec_module(_mod)                 # type: ignore[union-attr]
    graph, unit_labels = _mod.load_fixture(str(fixture_path))

    port_nodes = [n for n, d in graph.nodes(data=True) if d.get("unit_type") == "Port"]
    logger.info(
        f"그래프: {graph.number_of_nodes()}노드, {graph.number_of_edges()}엣지, "
        f"포트 {len(port_nodes)}개"
    )

    if len(port_nodes) < 2:
        logger.error("Port 노드가 2개 미만입니다. 레이아웃 fixture를 확인하세요.")
        sys.exit(1)

    # ── 출력 디렉토리 ──────────────────────────────────────────────
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = Path(args.out) / f"caie_{ts}"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "figures").mkdir(exist_ok=True)
    (out_dir / "tables").mkdir(exist_ok=True)
    logger.info(f"결과 저장 위치: {out_dir}")

    # ── 시나리오 필터 ──────────────────────────────────────────────
    selected_sc = [sc for sc in SCENARIOS if sc["name"] in args.scenarios]
    seeds = list(range(1, args.seeds + 1))

    logger.info(
        f"\n실험 시작\n"
        f"  알고리즘: {[ALG_LABELS.get(a,a) for a in args.algorithms]}\n"
        f"  시나리오: {[sc['name'] for sc in selected_sc]}\n"
        f"  시드 수 : {len(seeds)} (1~{len(seeds)})\n"
        f"  총 실행 : {len(selected_sc) * len(seeds) * len(args.algorithms)}회"
    )

    # ── 모델 사전 로딩 (PPO/CACTUS) ───────────────────────────────
    _preload_models(args.algorithms)

    t_start = time.perf_counter()

    results = run_experiment(
        graph=graph,
        unit_labels=unit_labels,
        algorithms=args.algorithms,
        scenarios=selected_sc,
        seeds=seeds,
        out_dir=out_dir,
    )

    elapsed_total = time.perf_counter() - t_start
    logger.info(f"\n온라인 실험 소요 시간: {elapsed_total/60:.1f}분")

    # ── CBS-TS 배치 모드 보조 실험 ────────────────────────────────
    batch_results = None
    if not args.no_batch and "cbs_ts" in args.algorithms:
        logger.info("\n\nCBS-TS 배치 모드 보조 실험 시작 (오프라인 사전 계획)...")
        t_batch = time.perf_counter()
        batch_sc = [sc for sc in SCENARIOS_BATCH if sc["name"] in args.scenarios]
        try:
            batch_results = run_cbsts_batch_experiment(
                graph=graph,
                unit_labels=unit_labels,
                scenarios=batch_sc,
                seeds=seeds,
            )
            # 온라인 결과에 병합
            for sc_name in results["summary_stats"]:
                if sc_name in batch_results["summary_stats"]:
                    results["summary_stats"][sc_name].update(
                        batch_results["summary_stats"][sc_name]
                    )
                    results["raw"][sc_name].update(
                        batch_results["raw"][sc_name]
                    )
            elapsed_batch = time.perf_counter() - t_batch
            logger.info(f"CBS-TS 배치 실험 완료: {elapsed_batch/60:.1f}분")
        except Exception as exc:
            logger.warning(f"CBS-TS 배치 실험 실패 (건너뜀): {exc}")

    t_end = time.perf_counter()
    logger.info(f"\n총 실험 소요 시간: {(t_end - t_start)/60:.1f}분")

    # ── 결과 저장 ──────────────────────────────────────────────────
    all_algs = list(args.algorithms)
    if batch_results is not None:
        all_algs_with_batch = all_algs + ["cbs_ts_batch"]
    else:
        all_algs_with_batch = all_algs

    raw_path  = out_dir / "raw_results.json"
    summ_path = out_dir / "summary_stats.json"
    stat_path = out_dir / "statistical_tests.json"
    meta_path = out_dir / "experiment_meta.json"

    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(results["raw"], f, ensure_ascii=False, indent=2)

    with open(summ_path, "w", encoding="utf-8") as f:
        json.dump(results["summary_stats"], f, ensure_ascii=False, indent=2)

    with open(stat_path, "w", encoding="utf-8") as f:
        json.dump(results["statistical_tests"], f, ensure_ascii=False, indent=2)

    # 배치 포함 CSV 재작성
    csv_path = out_dir / "summary.csv"
    _write_csv(results["summary_stats"], all_algs_with_batch, csv_path)
    logger.info(f"CSV 저장 (배치 포함): {csv_path}")

    meta = {
        "fixture_path":     str(fixture_path),
        "graph_nodes":      graph.number_of_nodes(),
        "graph_edges":      graph.number_of_edges(),
        "port_count":       len(port_nodes),
        "algorithms":       all_algs_with_batch,
        "algorithm_labels": ALG_LABELS,
        "scenarios":        [sc["name"] for sc in selected_sc],
        "seed_count":       len(seeds),
        "seeds":            seeds,
        "elapsed_seconds":  round(time.perf_counter() - t_start, 1),
        "timestamp":        results["timestamp"],
        "cbsts_batch_included": batch_results is not None,
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    logger.info(
        f"\n결과 파일:\n"
        f"  {raw_path}\n"
        f"  {summ_path}\n"
        f"  {stat_path}\n"
        f"  {out_dir}/summary.csv\n"
        f"  {meta_path}\n"
        f"\n다음 단계:\n"
        f"  python scripts/caie_figures.py --results-dir {out_dir}\n"
        f"  python scripts/caie_tables.py  --results-dir {out_dir}"
    )

    # ── 콘솔 요약 출력 ─────────────────────────────────────────────
    _print_summary(results["summary_stats"], results["statistical_tests"], all_algs_with_batch)


def _print_summary(summary_stats, stat_tests, algorithms):
    print("\n" + "="*70)
    print("실험 결과 요약")
    print("="*70)

    for sc_name, sc_data in summary_stats.items():
        print(f"\n[{sc_name}]")
        header = f"{'지표':<28}" + "".join(f"{ALG_LABELS.get(a,a):>14}" for a in algorithms)
        print(header)
        print("-" * len(header))

        for m in PRIMARY_METRICS:
            label = METRIC_LABELS.get(m, m)[:26]
            row_str = f"  {label:<26}"
            vals = {alg: sc_data.get(alg, {}).get(m, {}).get("mean", 0.0) for alg in algorithms}
            # 최선값 표시 (* 마크)
            if m in LOWER_IS_BETTER:
                best = min(vals.values())
            else:
                best = max(vals.values())
            for alg in algorithms:
                v = vals[alg]
                mark = "*" if abs(v - best) < 1e-6 else " "
                row_str += f"{v:>12.2f}{mark} "
            # KW p-value
            kw_p = stat_tests.get(sc_name, {}).get(m, {}).get("kruskal_wallis", {}).get("p_value", 1.0)
            row_str += f"  KW: {sig_marker(kw_p)}"
            print(row_str)

    print("\n* = 해당 지표 최선값")
    print("KW: Kruskal-Wallis 유의수준 (*** p<0.001, ** p<0.01, * p<0.05, ns)")


if __name__ == "__main__":
    main()
