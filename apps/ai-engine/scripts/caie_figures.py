"""
CAIE 저널 논문 그림 생성기 (Elsevier 스타일, 300 DPI)

생성 그림:
  fig1_boxplots_makespan.pdf/png     — Makespan 박스플롯 (3 시나리오 × 4 알고리즘)
  fig2_boxplots_transfer.pdf/png     — Avg. Transfer Time 박스플롯
  fig3_boxplots_util.pdf/png         — AMR Utilization 박스플롯
  fig4_boxplots_throughput.pdf/png   — Throughput 박스플롯
  fig5_boxplots_deadlock.pdf/png     — Deadlock Count 박스플롯
  fig6_boxplots_pathopt.pdf/png      — Path Optimality 박스플롯
  fig7_bar_primary.pdf/png           — 6개 주요 지표 바차트 (CI 에러바)
  fig8_heatmap_pvalues.pdf/png       — Wilcoxon p-value 히트맵 (3 시나리오)
  fig9_radar_summary.pdf/png         — 레이더 차트 (알고리즘 비교 요약)

사용법:
    python scripts/caie_figures.py --results-dir output/caie_<timestamp>
    python scripts/caie_figures.py --results-dir output/caie_<timestamp> --fmt pdf  # PDF만
    python scripts/caie_figures.py --results-dir output/caie_<timestamp> --fmt both # PDF+PNG (기본)

필요 패키지:
    pip install matplotlib scipy numpy
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np


# ── Elsevier 스타일 설정 ──────────────────────────────────────────
ELSEVIER_STYLE = {
    "font.family":       "serif",
    "font.serif":        ["Times New Roman", "DejaVu Serif"],
    "font.size":         10,
    "axes.titlesize":    11,
    "axes.labelsize":    10,
    "xtick.labelsize":   9,
    "ytick.labelsize":   9,
    "legend.fontsize":   9,
    "figure.dpi":        300,
    "savefig.dpi":       300,
    "figure.facecolor":  "white",
    "axes.facecolor":    "white",
    "axes.grid":         True,
    "grid.alpha":        0.3,
    "grid.linestyle":    "--",
    "axes.spines.top":   False,
    "axes.spines.right": False,
    "lines.linewidth":   1.5,
    "patch.linewidth":   0.8,
}

# 알고리즘별 색상 (Elsevier 권장 색약 친화 팔레트)
ALG_COLORS = {
    "astar":   "#2196F3",   # 파랑 (baseline)
    "ai_ppo":  "#4CAF50",   # 초록 (RL)
    "cactus":  "#FF9800",   # 주황 (MARL)
    "cbs_ts":  "#F44336",   # 빨강 (CBS)
}

ALG_LABELS = {
    "astar":   "A*",
    "ai_ppo":  "PPO-RL",
    "cactus":  "CACTUS",
    "cbs_ts":  "CBS-TS",
}

ALG_MARKERS = {
    "astar":   "o",
    "ai_ppo":  "s",
    "cactus":  "^",
    "cbs_ts":  "D",
}

SCENARIO_LABELS = {
    "S1_Small":  "Small\n(3 AGVs, 30 tasks)",
    "S2_Medium": "Medium\n(5 AGVs, 60 tasks)",
    "S3_Large":  "Large\n(8 AGVs, 100 tasks)",
}

METRIC_LABELS = {
    "makespan":          "Makespan (s)",
    "avg_transfer_time": "Avg. Transfer Time (s)",
    "amr_utilization":   "AMR Utilization (%)",
    "throughput":        "Throughput (tasks/s)",
    "deadlock_count":    "Deadlock Count",
    "path_optimality":   "Path Optimality (%)",
}

METRIC_TITLES = {
    "makespan":          "Makespan Comparison",
    "avg_transfer_time": "Average Transfer Time Comparison",
    "amr_utilization":   "AMR Utilization Comparison",
    "throughput":        "Throughput Comparison",
    "deadlock_count":    "Deadlock Count Comparison",
    "path_optimality":   "Path Optimality Comparison",
}

PRIMARY_METRICS = [
    "makespan", "avg_transfer_time", "amr_utilization",
    "throughput", "deadlock_count", "path_optimality",
]


def _sig_marker(p: float) -> str:
    if p < 0.001:
        return "***"
    if p < 0.01:
        return "**"
    if p < 0.05:
        return "*"
    return "ns"


def _save(fig, path: Path, fmts: List[str]) -> None:
    for fmt in fmts:
        out = path.with_suffix(f".{fmt}")
        fig.savefig(out, bbox_inches="tight", dpi=300)
    plt.close(fig)


# ── Fig 1~6: 박스플롯 (지표별) ────────────────────────────────────
def plot_boxplot_per_metric(
    raw: Dict,
    summary_stats: Dict,
    stat_tests: Dict,
    algorithms: List[str],
    scenarios: List[str],
    metric: str,
    out_dir: Path,
    fmts: List[str],
    fig_number: int,
) -> None:
    """
    한 지표에 대해 시나리오별 박스플롯 그림 생성.
    각 서브플롯 = 1 시나리오, x축 = 알고리즘.
    """
    n_sc = len(scenarios)
    fig, axes = plt.subplots(1, n_sc, figsize=(4.5 * n_sc, 4.2), sharey=False)
    if n_sc == 1:
        axes = [axes]

    for ax, sc_name in zip(axes, scenarios):
        data_per_alg = [raw[sc_name][alg][metric] for alg in algorithms]
        colors = [ALG_COLORS[a] for a in algorithms]

        bp = ax.boxplot(
            data_per_alg,
            patch_artist=True,
            widths=0.55,
            medianprops=dict(color="black", linewidth=1.5),
            whiskerprops=dict(linewidth=1.0),
            capprops=dict(linewidth=1.0),
            flierprops=dict(marker=".", markersize=4, alpha=0.5),
        )
        for patch, color in zip(bp["boxes"], colors):
            patch.set_facecolor(color)
            patch.set_alpha(0.75)

        ax.set_xticks(range(1, len(algorithms) + 1))
        ax.set_xticklabels([ALG_LABELS[a] for a in algorithms], rotation=30, ha="right")
        ax.set_title(SCENARIO_LABELS.get(sc_name, sc_name), fontsize=10)
        ax.set_ylabel(METRIC_LABELS.get(metric, metric) if sc_name == scenarios[0] else "")

        # KW p-value 표시
        kw = stat_tests.get(sc_name, {}).get(metric, {}).get("kruskal_wallis", {})
        kw_p  = kw.get("p_value", 1.0)
        kw_sig = _sig_marker(kw_p)
        ax.text(
            0.98, 0.97, f"KW: {kw_sig} (p={kw_p:.3f})",
            transform=ax.transAxes, fontsize=8, ha="right", va="top",
            bbox=dict(boxstyle="round,pad=0.3", facecolor="lightyellow", alpha=0.8),
        )

    fig.suptitle(METRIC_TITLES.get(metric, metric), fontsize=12, fontweight="bold", y=1.02)

    legend_patches = [
        mpatches.Patch(facecolor=ALG_COLORS[a], alpha=0.75, label=ALG_LABELS[a])
        for a in algorithms
    ]
    fig.legend(
        handles=legend_patches, loc="lower center",
        ncol=len(algorithms), frameon=True,
        bbox_to_anchor=(0.5, -0.06), fontsize=9,
    )

    fig.tight_layout()
    stem = out_dir / f"fig{fig_number}_boxplot_{metric}"
    _save(fig, stem, fmts)
    print(f"  저장: {stem}.{fmts[0]}")


# ── Fig 7: 주요 지표 바차트 (CI 에러바) ───────────────────────────
def plot_bar_primary(
    summary_stats: Dict,
    algorithms: List[str],
    scenarios: List[str],
    out_dir: Path,
    fmts: List[str],
) -> None:
    """
    6개 주요 지표 × 3 시나리오 bar chart. (3×2 서브플롯)
    95% CI 에러바 포함.
    """
    n_metrics = len(PRIMARY_METRICS)
    fig, axes = plt.subplots(2, 3, figsize=(13, 7.5))
    axes_flat = axes.flatten()

    x = np.arange(len(scenarios))
    bar_width = 0.2
    offsets = np.linspace(
        -(len(algorithms) - 1) / 2 * bar_width,
         (len(algorithms) - 1) / 2 * bar_width,
        len(algorithms),
    )

    for ax_idx, (ax, metric) in enumerate(zip(axes_flat, PRIMARY_METRICS)):
        for alg, offset in zip(algorithms, offsets):
            means = []
            ci_errs = []
            for sc in scenarios:
                s = summary_stats.get(sc, {}).get(alg, {}).get(metric, {})
                mean = s.get("mean", 0.0)
                ci_l = s.get("ci_low", mean)
                ci_h = s.get("ci_high", mean)
                means.append(mean)
                ci_errs.append([(mean - ci_l), (ci_h - mean)])

            ci_arr = np.array(ci_errs).T  # (2, n_scenarios)
            bars = ax.bar(
                x + offset, means,
                width=bar_width,
                color=ALG_COLORS[alg],
                alpha=0.8,
                label=ALG_LABELS[alg],
            )
            ax.errorbar(
                x + offset, means,
                yerr=ci_arr,
                fmt="none",
                color="black",
                capsize=3,
                linewidth=0.8,
            )

        ax.set_title(METRIC_LABELS.get(metric, metric), fontsize=10, fontweight="bold")
        ax.set_xticks(x)
        ax.set_xticklabels(
            [sc.replace("_", "\n") for sc in scenarios],
            fontsize=8,
        )
        ax.yaxis.set_tick_params(labelsize=8)

        if ax_idx == 0:
            ax.legend(fontsize=8, ncol=2, framealpha=0.8)

    # 빈 서브플롯 숨기기
    for i in range(n_metrics, len(axes_flat)):
        axes_flat[i].set_visible(False)

    fig.suptitle(
        "Algorithm Comparison Across Scenarios\n(95% CI error bars, 30 replications)",
        fontsize=12, fontweight="bold",
    )
    fig.tight_layout(rect=(0, 0, 1, 0.96))
    stem = out_dir / "fig7_bar_primary"
    _save(fig, stem, fmts)
    print(f"  저장: {stem}.{fmts[0]}")


# ── Fig 8: p-value 히트맵 ─────────────────────────────────────────
def plot_pvalue_heatmap(
    stat_tests: Dict,
    algorithms: List[str],
    scenarios: List[str],
    metrics: List[str],
    out_dir: Path,
    fmts: List[str],
) -> None:
    """
    각 시나리오 × 지표의 pairwise Wilcoxon p-value 히트맵.
    행 = 지표, 열 = 알고리즘 쌍.
    """
    n_sc = len(scenarios)
    fig, axes = plt.subplots(1, n_sc, figsize=(5.5 * n_sc, 5.5))
    if n_sc == 1:
        axes = [axes]

    pairs = []
    alg_list = list(algorithms)
    for i in range(len(alg_list)):
        for j in range(i + 1, len(alg_list)):
            pairs.append(f"{ALG_LABELS[alg_list[i]]} vs\n{ALG_LABELS[alg_list[j]]}")

    pair_keys = []
    for i in range(len(alg_list)):
        for j in range(i + 1, len(alg_list)):
            pair_keys.append(f"{alg_list[i]}_vs_{alg_list[j]}")

    metric_labels = [METRIC_LABELS.get(m, m) for m in metrics]

    for ax, sc_name in zip(axes, scenarios):
        matrix = np.ones((len(metrics), len(pair_keys)))
        for mi, metric in enumerate(metrics):
            pairwise = stat_tests.get(sc_name, {}).get(metric, {}).get("pairwise", {})
            for pi, pk in enumerate(pair_keys):
                p = pairwise.get(pk, {}).get("p_adj", 1.0)
                matrix[mi, pi] = p

        # -log10(p) 변환 (p=1 → 0, p=0.001 → 3)
        log_matrix = -np.log10(np.clip(matrix, 1e-10, 1.0))
        vmax = max(3.0, log_matrix.max())

        im = ax.imshow(log_matrix, aspect="auto", cmap="YlOrRd", vmin=0, vmax=vmax)

        ax.set_xticks(range(len(pairs)))
        ax.set_xticklabels(pairs, fontsize=8, rotation=30, ha="right")
        ax.set_yticks(range(len(metrics)))
        ax.set_yticklabels(metric_labels, fontsize=8)
        ax.set_title(SCENARIO_LABELS.get(sc_name, sc_name).replace("\n", " "), fontsize=10)

        # p-value 텍스트 + 유의성 마커 표시
        for mi in range(len(metrics)):
            for pi in range(len(pair_keys)):
                p_val = matrix[mi, pi]
                sig   = _sig_marker(p_val)
                color = "white" if log_matrix[mi, pi] > vmax * 0.6 else "black"
                ax.text(
                    pi, mi, sig,
                    ha="center", va="center",
                    fontsize=8, fontweight="bold", color=color,
                )

        plt.colorbar(im, ax=ax, label=r"$-\log_{10}(p)$", fraction=0.04, pad=0.02)

    fig.suptitle(
        "Pairwise Wilcoxon p-values (Holm-Bonferroni Corrected)",
        fontsize=12, fontweight="bold",
    )
    fig.tight_layout()
    stem = out_dir / "fig8_heatmap_pvalues"
    _save(fig, stem, fmts)
    print(f"  저장: {stem}.{fmts[0]}")


# ── Fig 9: 레이더 차트 (알고리즘 종합 비교) ──────────────────────
def plot_radar_summary(
    summary_stats: Dict,
    algorithms: List[str],
    scenarios: List[str],
    out_dir: Path,
    fmts: List[str],
) -> None:
    """
    S2_Medium 기준 정규화 레이더 차트.
    각 지표를 0~1로 정규화 (높을수록 좋은 방향).
    """
    SC_REF = "S2_Medium" if "S2_Medium" in scenarios else scenarios[0]
    sc_data = summary_stats.get(SC_REF, {})

    metrics_radar = ["makespan", "avg_transfer_time", "amr_utilization", "throughput", "path_optimality"]
    labels_radar  = ["Makespan\n(↓)", "Transfer\nTime (↓)", "AMR\nUtil. (↑)", "Throughput\n(↑)", "Path\nOpt. (↑)"]
    lower_better  = {"makespan", "avg_transfer_time"}

    # 지표별 전체 최솟값/최댓값 (0~1 정규화)
    all_vals = {m: [sc_data.get(a, {}).get(m, {}).get("mean", 0.0) for a in algorithms] for m in metrics_radar}
    min_v    = {m: min(v) for m, v in all_vals.items()}
    max_v    = {m: max(v) for m, v in all_vals.items()}

    def normalize(alg, metric):
        v   = sc_data.get(alg, {}).get(metric, {}).get("mean", 0.0)
        lo  = min_v[metric]
        hi  = max_v[metric]
        if hi == lo:
            return 0.5
        normalized = (v - lo) / (hi - lo)
        return (1.0 - normalized) if metric in lower_better else normalized

    n_vars = len(metrics_radar)
    angles = [2 * math.pi * i / n_vars for i in range(n_vars)]
    angles += angles[:1]  # 폐쇄

    fig, ax = plt.subplots(figsize=(6.5, 6.5), subplot_kw=dict(polar=True))

    for alg in algorithms:
        values = [normalize(alg, m) for m in metrics_radar]
        values += values[:1]

        ax.plot(angles, values, "o-", linewidth=2, label=ALG_LABELS[alg],
                color=ALG_COLORS[alg], markersize=6)
        ax.fill(angles, values, alpha=0.1, color=ALG_COLORS[alg])

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels_radar, fontsize=9)
    ax.set_ylim(0, 1)
    ax.set_yticks([0.2, 0.4, 0.6, 0.8, 1.0])
    ax.set_yticklabels(["0.2", "0.4", "0.6", "0.8", "1.0"], fontsize=7)
    ax.grid(color="gray", linestyle="--", alpha=0.4)

    sc_label = SCENARIO_LABELS.get(SC_REF, SC_REF).replace("\n", " ")
    ax.set_title(
        f"Algorithm Performance Summary ({sc_label})\n"
        "(Normalized: 1.0 = best performance)",
        fontsize=11, fontweight="bold", pad=20,
    )

    ax.legend(loc="upper right", bbox_to_anchor=(1.35, 1.15), fontsize=9, framealpha=0.9)

    fig.tight_layout()
    stem = out_dir / "fig9_radar_summary"
    _save(fig, stem, fmts)
    print(f"  저장: {stem}.{fmts[0]}")


# ── Fig 10: 시나리오 스케일링 라인 차트 ──────────────────────────
def plot_scaling(
    summary_stats: Dict,
    algorithms: List[str],
    scenarios: List[str],
    out_dir: Path,
    fmts: List[str],
) -> None:
    """
    시나리오 크기에 따른 알고리즘 성능 변화 (Makespan + AMR Utilization).
    """
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9, 4.5))

    sc_ticks = range(1, len(scenarios) + 1)
    sc_xlabels = [SCENARIO_LABELS.get(s, s).replace("\n", " ") for s in scenarios]

    for alg in algorithms:
        makespan_means = [
            summary_stats.get(sc, {}).get(alg, {}).get("makespan", {}).get("mean", 0.0)
            for sc in scenarios
        ]
        util_means = [
            summary_stats.get(sc, {}).get(alg, {}).get("amr_utilization", {}).get("mean", 0.0)
            for sc in scenarios
        ]
        makespan_cis = [
            (
                summary_stats.get(sc, {}).get(alg, {}).get("makespan", {}).get("mean", 0.0)
                - summary_stats.get(sc, {}).get(alg, {}).get("makespan", {}).get("ci_low", 0.0),
                summary_stats.get(sc, {}).get(alg, {}).get("makespan", {}).get("ci_high", 0.0)
                - summary_stats.get(sc, {}).get(alg, {}).get("makespan", {}).get("mean", 0.0),
            )
            for sc in scenarios
        ]
        ci_arr = np.array(makespan_cis).T

        ax1.plot(sc_ticks, makespan_means, f"{ALG_MARKERS[alg]}-",
                 label=ALG_LABELS[alg], color=ALG_COLORS[alg], linewidth=2, markersize=7)
        ax1.fill_between(
            sc_ticks,
            [m - e[0] for m, e in zip(makespan_means, makespan_cis)],
            [m + e[1] for m, e in zip(makespan_means, makespan_cis)],
            alpha=0.15, color=ALG_COLORS[alg],
        )

        ax2.plot(sc_ticks, util_means, f"{ALG_MARKERS[alg]}-",
                 label=ALG_LABELS[alg], color=ALG_COLORS[alg], linewidth=2, markersize=7)

    ax1.set_title("Makespan vs. Workload Scale", fontsize=11, fontweight="bold")
    ax1.set_xlabel("Scenario")
    ax1.set_ylabel("Makespan (s)")
    ax1.set_xticks(sc_ticks)
    ax1.set_xticklabels(sc_xlabels, fontsize=8, rotation=10)
    ax1.legend(fontsize=8, framealpha=0.9)

    ax2.set_title("AMR Utilization vs. Workload Scale", fontsize=11, fontweight="bold")
    ax2.set_xlabel("Scenario")
    ax2.set_ylabel("AMR Utilization (%)")
    ax2.set_xticks(sc_ticks)
    ax2.set_xticklabels(sc_xlabels, fontsize=8, rotation=10)
    ax2.set_ylim(0, 105)

    fig.suptitle(
        "Scalability Analysis: Performance Under Increasing Workload",
        fontsize=12, fontweight="bold",
    )
    fig.tight_layout()
    stem = out_dir / "fig10_scaling"
    _save(fig, stem, fmts)
    print(f"  저장: {stem}.{fmts[0]}")


# ── 메인 ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CAIE 논문 그림 생성")
    parser.add_argument("--results-dir", required=True, help="caie_experiment.py 출력 디렉토리")
    parser.add_argument(
        "--fmt", default="both", choices=["pdf", "png", "both"],
        help="출력 형식 (기본: both = PDF+PNG)",
    )
    args = parser.parse_args()

    results_dir = Path(args.results_dir)
    fmts = ["pdf", "png"] if args.fmt == "both" else [args.fmt]

    # ── 데이터 로드 ──────────────────────────────────────────────
    summ_path  = results_dir / "summary_stats.json"
    raw_path   = results_dir / "raw_results.json"
    stat_path  = results_dir / "statistical_tests.json"
    meta_path  = results_dir / "experiment_meta.json"

    for p in [summ_path, raw_path, stat_path, meta_path]:
        if not p.exists():
            print(f"파일 없음: {p}")
            sys.exit(1)

    with open(summ_path) as f:
        summary_stats = json.load(f)
    with open(raw_path) as f:
        raw = json.load(f)
    with open(stat_path) as f:
        stat_tests = json.load(f)
    with open(meta_path) as f:
        meta = json.load(f)

    algorithms = meta["algorithms"]
    scenarios  = meta["scenarios"]
    out_dir    = results_dir / "figures"
    out_dir.mkdir(exist_ok=True)

    # ── 스타일 적용 ──────────────────────────────────────────────
    plt.rcParams.update(ELSEVIER_STYLE)

    print(f"\nCAIE 논문 그림 생성 시작")
    print(f"  알고리즘: {algorithms}")
    print(f"  시나리오: {scenarios}")
    print(f"  출력 형식: {fmts}")
    print(f"  저장 위치: {out_dir}\n")

    # ── Fig 1~6: 지표별 박스플롯 ─────────────────────────────────
    for fig_num, metric in enumerate(PRIMARY_METRICS, start=1):
        print(f"Fig {fig_num}: {METRIC_TITLES.get(metric, metric)}")
        plot_boxplot_per_metric(
            raw=raw,
            summary_stats=summary_stats,
            stat_tests=stat_tests,
            algorithms=algorithms,
            scenarios=scenarios,
            metric=metric,
            out_dir=out_dir,
            fmts=fmts,
            fig_number=fig_num,
        )

    # ── Fig 7: 주요 지표 바차트 ──────────────────────────────────
    print("Fig 7: Primary Metrics Bar Chart")
    plot_bar_primary(summary_stats, algorithms, scenarios, out_dir, fmts)

    # ── Fig 8: p-value 히트맵 ────────────────────────────────────
    print("Fig 8: Pairwise p-value Heatmap")
    plot_pvalue_heatmap(stat_tests, algorithms, scenarios, PRIMARY_METRICS, out_dir, fmts)

    # ── Fig 9: 레이더 차트 ───────────────────────────────────────
    print("Fig 9: Radar Summary Chart")
    plot_radar_summary(summary_stats, algorithms, scenarios, out_dir, fmts)

    # ── Fig 10: 스케일링 분석 ────────────────────────────────────
    print("Fig 10: Scaling Analysis")
    plot_scaling(summary_stats, algorithms, scenarios, out_dir, fmts)

    print(f"\n모든 그림 생성 완료: {out_dir}/")


if __name__ == "__main__":
    main()
