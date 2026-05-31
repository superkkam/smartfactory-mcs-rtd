"""
CAIE 저널 LaTeX 표 생성기

생성 표:
  table1_main_results.tex    — 주요 결과 표 (Mean ± SD, 유의성 마커)
  table2_significance.tex    — 쌍별 Wilcoxon 유의성 표
  table3_ranking.tex         — 알고리즘 평균 순위 표 (전체 시나리오)
  table_scenario_<sc>.tex    — 시나리오별 상세 표 (CI 포함)

LaTeX 패키지:
  \\usepackage{booktabs, multirow, xcolor, array, caption}

사용법:
    python scripts/caie_tables.py --results-dir output/caie_<timestamp>
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List


PRIMARY_METRICS = [
    "makespan", "avg_transfer_time", "amr_utilization",
    "throughput", "deadlock_count", "path_optimality",
]

METRIC_LABELS = {
    "makespan":          r"Makespan (s)",
    "avg_transfer_time": r"Avg. Transfer Time (s)",
    "amr_utilization":   r"AMR Utilization (\%)",
    "throughput":        r"Throughput (tasks/s)",
    "deadlock_count":    r"Deadlock Count",
    "path_optimality":   r"Path Optimality (\%)",
}

METRIC_SHORT = {
    "makespan":          "MS",
    "avg_transfer_time": "ATT",
    "amr_utilization":   "AMRU",
    "throughput":        "TP",
    "deadlock_count":    "DL",
    "path_optimality":   "PO",
}

ALG_LABELS = {
    "astar":   r"A*",
    "ai_ppo":  r"PPO-RL",
    "cactus":  r"CACTUS",
    "cbs_ts":  r"CBS-TS",
}

SCENARIO_LABELS = {
    "S1_Small":  r"Small (3 AGVs, 30 tasks)",
    "S2_Medium": r"Medium (5 AGVs, 60 tasks)",
    "S3_Large":  r"Large (8 AGVs, 100 tasks)",
}

LOWER_IS_BETTER = {"makespan", "avg_transfer_time", "deadlock_count", "conflict_count"}


def _sig_marker(p: float) -> str:
    if p < 0.001:
        return "***"
    if p < 0.01:
        return "**"
    if p < 0.05:
        return "*"
    return "ns"


def _bold(s: str) -> str:
    return r"\textbf{" + s + r"}"


def _fmt_val(val: float, metric: str, decimals: int = 2) -> str:
    if metric in ("deadlock_count", "conflict_count"):
        return str(int(round(val)))
    return f"{val:.{decimals}f}"


def _is_best(alg: str, metric: str, sc_data: dict, algorithms: List[str]) -> bool:
    vals = {a: sc_data.get(a, {}).get(metric, {}).get("mean", 0.0) for a in algorithms}
    if metric in LOWER_IS_BETTER:
        best_val = min(vals.values())
    else:
        best_val = max(vals.values())
    return abs(vals[alg] - best_val) < 1e-6


# ── 표 1: 주요 결과 (Mean ± SD) ───────────────────────────────────
def make_main_results_table(
    summary_stats: Dict,
    algorithms: List[str],
    scenarios: List[str],
) -> str:
    """
    모든 시나리오 × 알고리즘 × 지표 결과 표.
    최선값 Bold, Kruskal-Wallis 유의수준 포함.
    """
    n_alg = len(algorithms)
    col_spec = "llr" + "r" * n_alg   # scenario | metric | alg × n

    lines = []
    lines.append(r"\begin{table*}[htbp]")
    lines.append(r"\centering")
    lines.append(r"\caption{Performance comparison of MAPF algorithms across three workload scenarios.")
    lines.append(r"Values are Mean $\pm$ SD over 30 independent replications.")
    lines.append(r"Best values in each row are \textbf{bold}.")
    lines.append(r"KW: Kruskal-Wallis significance (*** $p<0.001$, ** $p<0.01$, * $p<0.05$).}")
    lines.append(r"\label{tab:main_results}")
    lines.append(r"\resizebox{\textwidth}{!}{%")
    lines.append(r"\begin{tabular}{@{}ll" + "r" * n_alg + r"r@{}}")
    lines.append(r"\toprule")

    # 헤더
    alg_header = " & ".join(ALG_LABELS.get(a, a) for a in algorithms)
    lines.append(r"\textbf{Scenario} & \textbf{Metric} & " + alg_header + r" & \textbf{KW} \\")
    lines.append(r"\midrule")

    for sc_idx, sc_name in enumerate(scenarios):
        sc_label = SCENARIO_LABELS.get(sc_name, sc_name)
        sc_data  = summary_stats.get(sc_name, {})

        # \midrule between scenarios (not before first)
        if sc_idx > 0:
            lines.append(r"\midrule")

        first_in_sc = True
        for metric in PRIMARY_METRICS:
            m_label = METRIC_LABELS.get(metric, metric)

            cells = []
            for alg in algorithms:
                s    = sc_data.get(alg, {}).get(metric, {})
                mean = s.get("mean", 0.0)
                std  = s.get("std", 0.0)
                val_str = _fmt_val(mean, metric) + r" $\pm$ " + _fmt_val(std, metric)
                if _is_best(alg, metric, sc_data, algorithms):
                    val_str = _bold(val_str)
                cells.append(val_str)

            # KW p-value (from stat_tests)
            kw_sig = ""  # will be filled later if stat_tests available

            row_parts = cells + [kw_sig]

            if first_in_sc:
                sc_str = r"\multirow{" + str(len(PRIMARY_METRICS)) + r"}{*}{\textbf{" + sc_label + r"}}"
                first_in_sc = False
            else:
                sc_str = ""

            lines.append(
                sc_str + " & " + m_label + " & " + " & ".join(cells) + r" & -- \\"
            )

    lines.append(r"\bottomrule")
    lines.append(r"\end{tabular}}")
    lines.append(r"\end{table*}")

    return "\n".join(lines)


def make_main_results_with_kw(
    summary_stats: Dict,
    stat_tests: Dict,
    algorithms: List[str],
    scenarios: List[str],
) -> str:
    """
    KW p-value 포함 주요 결과 표 (완전판).
    """
    n_alg = len(algorithms)

    lines = []
    lines.append(r"\begin{table*}[htbp]")
    lines.append(r"\centering")
    lines.append(
        r"\caption{Performance comparison of MAPF algorithms. "
        r"Values: Mean $\pm$ SD (30 replications). "
        r"Bold: best value per row. "
        r"KW: Kruskal--Wallis significance "
        r"(${}^{***}p<0.001$, ${}^{**}p<0.01$, ${}^{*}p<0.05$, ${}^{\text{ns}}$not significant).}"
    )
    lines.append(r"\label{tab:main_results}")
    lines.append(r"\setlength{\tabcolsep}{4pt}")
    lines.append(r"\small")
    lines.append(r"\begin{tabular}{@{}ll" + "r" * n_alg + r"c@{}}")
    lines.append(r"\toprule")

    alg_header = " & ".join(r"\textbf{" + ALG_LABELS.get(a, a) + r"}" for a in algorithms)
    lines.append(
        r"\textbf{Scenario} & \textbf{Metric} & "
        + alg_header
        + r" & \textbf{KW} \\"
    )
    lines.append(r"\midrule")

    for sc_idx, sc_name in enumerate(scenarios):
        sc_label = SCENARIO_LABELS.get(sc_name, sc_name)
        sc_data  = summary_stats.get(sc_name, {})
        sc_stat  = stat_tests.get(sc_name, {})

        if sc_idx > 0:
            lines.append(r"\midrule")

        for mi, metric in enumerate(PRIMARY_METRICS):
            m_label = METRIC_LABELS.get(metric, metric)
            cells = []
            for alg in algorithms:
                s    = sc_data.get(alg, {}).get(metric, {})
                mean = s.get("mean", 0.0)
                std  = s.get("std", 0.0)
                val_str = _fmt_val(mean, metric) + r" $\pm$ " + _fmt_val(std, metric)
                if _is_best(alg, metric, sc_data, algorithms):
                    val_str = _bold(val_str)
                cells.append(val_str)

            kw_info = sc_stat.get(metric, {}).get("kruskal_wallis", {})
            kw_sig  = kw_info.get("sig", "--")
            kw_p    = kw_info.get("p_value", 1.0)
            if kw_sig != "ns":
                kw_cell = r"$" + kw_sig + r"$"
            else:
                kw_cell = r"ns"

            if mi == 0:
                sc_str = r"\multirow{" + str(len(PRIMARY_METRICS)) + r"}{*}{\begin{tabular}[c]{@{}l@{}}\textbf{" + sc_label + r"}\end{tabular}}"
            else:
                sc_str = ""

            lines.append(
                sc_str + " & " + m_label + " & "
                + " & ".join(cells) + " & " + kw_cell + r" \\"
            )

    lines.append(r"\bottomrule")
    lines.append(r"\end{tabular}")
    lines.append(r"\end{table*}")
    return "\n".join(lines)


# ── 표 2: 쌍별 Wilcoxon 유의성 ────────────────────────────────────
def make_significance_table(
    stat_tests: Dict,
    algorithms: List[str],
    scenarios: List[str],
    scenario: str = "S2_Medium",
) -> str:
    """
    S2_Medium 시나리오 기준 지표별 쌍별 p-value 표.
    """
    sc_data = stat_tests.get(scenario, {})

    alg_list = list(algorithms)
    pairs = []
    pair_labels = []
    for i in range(len(alg_list)):
        for j in range(i + 1, len(alg_list)):
            pairs.append(f"{alg_list[i]}_vs_{alg_list[j]}")
            pair_labels.append(
                ALG_LABELS.get(alg_list[i], alg_list[i])
                + r" vs "
                + ALG_LABELS.get(alg_list[j], alg_list[j])
            )

    n_pairs = len(pairs)
    col_spec = "l" + "c" * n_pairs

    sc_label = SCENARIO_LABELS.get(scenario, scenario)
    lines = []
    lines.append(r"\begin{table}[htbp]")
    lines.append(r"\centering")
    lines.append(
        r"\caption{Pairwise post-hoc comparison results (Wilcoxon signed-rank test, "
        r"Holm--Bonferroni corrected) for "
        + sc_label
        + r". "
        r"Effect size: rank-biserial $r$. "
        r"Significance: ${}^{***}p<0.001$, ${}^{**}p<0.01$, ${}^{*}p<0.05$.}"
    )
    lines.append(r"\label{tab:significance}")
    lines.append(r"\small")
    lines.append(r"\begin{tabular}{@{}" + col_spec + r"@{}}")
    lines.append(r"\toprule")

    pair_header = " & ".join(r"\textbf{" + pl + r"}" for pl in pair_labels)
    lines.append(r"\textbf{Metric} & " + pair_header + r" \\")
    lines.append(r"\midrule")

    for metric in PRIMARY_METRICS:
        m_label = METRIC_LABELS.get(metric, metric)
        pairwise = sc_data.get(metric, {}).get("pairwise", {})
        cells = []
        for pk in pairs:
            info = pairwise.get(pk, {})
            p_adj   = info.get("p_adj", 1.0)
            r_eff   = info.get("effect_r", 0.0)
            sig     = _sig_marker(p_adj)
            if sig != "ns":
                cell = f"$p={p_adj:.3f}^{{{sig}}}$\n($r={r_eff:.2f}$)"
            else:
                cell = f"$p={p_adj:.3f}$\n($r={r_eff:.2f}$)"
            cells.append(cell.replace("\n", r"\\"))
        lines.append(m_label + " & " + " & ".join(cells) + r" \\")

    lines.append(r"\bottomrule")
    lines.append(r"\end{tabular}")
    lines.append(r"\end{table}")
    return "\n".join(lines)


# ── 표 3: 알고리즘 순위 ───────────────────────────────────────────
def make_ranking_table(
    summary_stats: Dict,
    algorithms: List[str],
    scenarios: List[str],
) -> str:
    """
    알고리즘별 시나리오 × 지표 평균 순위 표.
    낮은 순위 = 더 좋은 성능.
    """
    # 순위 계산
    rank_sum: Dict[str, float] = {a: 0.0 for a in algorithms}
    rank_count = 0

    for sc_name in scenarios:
        sc_data = summary_stats.get(sc_name, {})
        for metric in PRIMARY_METRICS:
            vals = {a: sc_data.get(a, {}).get(metric, {}).get("mean", 0.0) for a in algorithms}
            sorted_algs = sorted(
                algorithms,
                key=lambda a: vals[a],
                reverse=(metric not in LOWER_IS_BETTER),
            )
            for rank, alg in enumerate(sorted_algs, 1):
                rank_sum[alg] += rank
            rank_count += 1

    avg_ranks = {a: rank_sum[a] / rank_count for a in algorithms}
    sorted_by_rank = sorted(algorithms, key=lambda a: avg_ranks[a])

    lines = []
    lines.append(r"\begin{table}[htbp]")
    lines.append(r"\centering")
    lines.append(
        r"\caption{Average rank of each algorithm across all scenarios and metrics "
        r"(lower rank = better performance). Ranks computed per metric per scenario, "
        r"then averaged over $3 \times 6 = 18$ evaluations.}"
    )
    lines.append(r"\label{tab:ranking}")
    lines.append(r"\begin{tabular}{@{}clcccc@{}}")
    lines.append(r"\toprule")
    lines.append(r"\textbf{Rank} & \textbf{Algorithm} & \textbf{Avg. Rank} & "
                 r"\textbf{Best Metric Count} & \textbf{Wins} & \textbf{Losses} \\")
    lines.append(r"\midrule")

    # 지표별 1위 횟수 계산
    best_count: Dict[str, int] = {a: 0 for a in algorithms}
    wins: Dict[str, int] = {a: 0 for a in algorithms}  # 모든 쌍별 비교 이김

    for sc_name in scenarios:
        sc_data = summary_stats.get(sc_name, {})
        for metric in PRIMARY_METRICS:
            vals = {a: sc_data.get(a, {}).get(metric, {}).get("mean", 0.0) for a in algorithms}
            if metric in LOWER_IS_BETTER:
                best_val = min(vals.values())
            else:
                best_val = max(vals.values())
            for a in algorithms:
                if abs(vals[a] - best_val) < 1e-6:
                    best_count[a] += 1

    losses: Dict[str, int] = {a: 0 for a in algorithms}
    for i, alg_i in enumerate(algorithms):
        for j, alg_j in enumerate(algorithms):
            if i == j:
                continue
            for sc_name in scenarios:
                sc_data = summary_stats.get(sc_name, {})
                for metric in PRIMARY_METRICS:
                    vi = sc_data.get(alg_i, {}).get(metric, {}).get("mean", 0.0)
                    vj = sc_data.get(alg_j, {}).get(metric, {}).get("mean", 0.0)
                    if metric in LOWER_IS_BETTER:
                        if vi < vj:
                            wins[alg_i] += 1
                        elif vi > vj:
                            losses[alg_i] += 1
                    else:
                        if vi > vj:
                            wins[alg_i] += 1
                        elif vi < vj:
                            losses[alg_i] += 1

    for rank_pos, alg in enumerate(sorted_by_rank, 1):
        ar = avg_ranks[alg]
        bc = best_count[alg]
        w  = wins[alg]
        l  = losses[alg]
        alg_str = ALG_LABELS.get(alg, alg)
        if rank_pos == 1:
            alg_str = _bold(alg_str)
        lines.append(
            f"{rank_pos} & {alg_str} & {ar:.2f} & {bc} & {w} & {l} \\\\"
        )

    lines.append(r"\bottomrule")
    lines.append(r"\end{tabular}")
    lines.append(r"\end{table}")
    return "\n".join(lines)


# ── 표 4: 시나리오별 상세 (CI 포함) ──────────────────────────────
def make_scenario_detail_table(
    summary_stats: Dict,
    stat_tests: Dict,
    algorithms: List[str],
    sc_name: str,
) -> str:
    """
    특정 시나리오의 전 지표 상세 표 (Mean ± SD, 95% CI, KW p-value).
    부록(Appendix)용.
    """
    sc_label = SCENARIO_LABELS.get(sc_name, sc_name)
    sc_data  = summary_stats.get(sc_name, {})
    sc_stat  = stat_tests.get(sc_name, {})
    n_alg    = len(algorithms)

    lines = []
    lines.append(r"\begin{table}[htbp]")
    lines.append(r"\centering")
    lines.append(
        r"\caption{Detailed results for "
        + sc_label
        + r" scenario. Values: Mean $\pm$ SD [95\% CI]. Best in \textbf{bold}.}"
    )
    lines.append(r"\label{tab:detail_" + sc_name.lower() + r"}")
    lines.append(r"\small")
    lines.append(r"\begin{tabular}{@{}l" + "r" * n_alg + r"c@{}}")
    lines.append(r"\toprule")

    alg_header = " & ".join(r"\textbf{" + ALG_LABELS.get(a, a) + r"}" for a in algorithms)
    lines.append(r"\textbf{Metric} & " + alg_header + r" & \textbf{KW} \\")
    lines.append(r"\midrule")

    for metric in PRIMARY_METRICS:
        m_label = METRIC_LABELS.get(metric, metric)
        cells   = []
        for alg in algorithms:
            s    = sc_data.get(alg, {}).get(metric, {})
            mean = s.get("mean", 0.0)
            std  = s.get("std",  0.0)
            ci_l = s.get("ci_low",  mean)
            ci_h = s.get("ci_high", mean)
            val_str = (
                _fmt_val(mean, metric)
                + r" $\pm$ "
                + _fmt_val(std, metric)
                + r" ["
                + _fmt_val(ci_l, metric)
                + r", "
                + _fmt_val(ci_h, metric)
                + r"]"
            )
            if _is_best(alg, metric, sc_data, algorithms):
                val_str = _bold(val_str)
            cells.append(val_str)

        kw_info = sc_stat.get(metric, {}).get("kruskal_wallis", {})
        kw_p    = kw_info.get("p_value", 1.0)
        kw_sig  = _sig_marker(kw_p)
        kw_cell = r"$^{" + kw_sig + r"}$" if kw_sig != "ns" else "ns"

        lines.append(m_label + " & " + " & ".join(cells) + " & " + kw_cell + r" \\")

    lines.append(r"\bottomrule")
    lines.append(r"\end{tabular}")
    lines.append(r"\end{table}")
    return "\n".join(lines)


# ── LaTeX 헤더/푸터 ───────────────────────────────────────────────
LATEX_HEADER = r"""\documentclass[review]{elsarticle}
\usepackage{booktabs}
\usepackage{multirow}
\usepackage{xcolor}
\usepackage{array}
\usepackage{caption}
\usepackage{amsmath}
\begin{document}
%% ============================================================
%% CAIE 논문 표 — caie_tables.py 자동 생성
%% ============================================================
"""

LATEX_FOOTER = r"""
\end{document}
"""


# ── 메인 ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="CAIE 논문 LaTeX 표 생성")
    parser.add_argument("--results-dir", required=True, help="caie_experiment.py 출력 디렉토리")
    parser.add_argument("--sig-scenario", default="S2_Medium",
                        help="유의성 표에 사용할 시나리오 (기본: S2_Medium)")
    args = parser.parse_args()

    results_dir = Path(args.results_dir)
    summ_path   = results_dir / "summary_stats.json"
    stat_path   = results_dir / "statistical_tests.json"
    meta_path   = results_dir / "experiment_meta.json"

    for p in [summ_path, stat_path, meta_path]:
        if not p.exists():
            print(f"파일 없음: {p}")
            sys.exit(1)

    with open(summ_path) as f:
        summary_stats = json.load(f)
    with open(stat_path) as f:
        stat_tests = json.load(f)
    with open(meta_path) as f:
        meta = json.load(f)

    algorithms = meta["algorithms"]
    scenarios  = meta["scenarios"]
    out_dir    = results_dir / "tables"
    out_dir.mkdir(exist_ok=True)

    print(f"\nCAIE LaTeX 표 생성 시작")
    print(f"  알고리즘: {algorithms}")
    print(f"  시나리오: {scenarios}")
    print(f"  저장 위치: {out_dir}\n")

    # ── 표 1: 주요 결과 ─────────────────────────────────────────
    t1 = make_main_results_with_kw(summary_stats, stat_tests, algorithms, scenarios)
    p1 = out_dir / "table1_main_results.tex"
    p1.write_text(t1, encoding="utf-8")
    print(f"  저장: {p1}")

    # ── 표 2: 유의성 ────────────────────────────────────────────
    sig_sc = args.sig_scenario if args.sig_scenario in scenarios else scenarios[0]
    t2 = make_significance_table(stat_tests, algorithms, scenarios, scenario=sig_sc)
    p2 = out_dir / "table2_significance.tex"
    p2.write_text(t2, encoding="utf-8")
    print(f"  저장: {p2}")

    # ── 표 3: 순위 ──────────────────────────────────────────────
    t3 = make_ranking_table(summary_stats, algorithms, scenarios)
    p3 = out_dir / "table3_ranking.tex"
    p3.write_text(t3, encoding="utf-8")
    print(f"  저장: {p3}")

    # ── 표 4: 시나리오별 상세 ────────────────────────────────────
    for sc_name in scenarios:
        t4 = make_scenario_detail_table(summary_stats, stat_tests, algorithms, sc_name)
        p4 = out_dir / f"table_scenario_{sc_name.lower()}.tex"
        p4.write_text(t4, encoding="utf-8")
        print(f"  저장: {p4}")

    # ── 통합 .tex 파일 ───────────────────────────────────────────
    all_tex = LATEX_HEADER
    all_tex += "\n\n%% === Table 1: Main Results ===\n" + t1
    all_tex += "\n\n%% === Table 2: Statistical Significance ===\n" + t2
    all_tex += "\n\n%% === Table 3: Algorithm Ranking ===\n" + t3
    for sc_name in scenarios:
        t_sc = make_scenario_detail_table(summary_stats, stat_tests, algorithms, sc_name)
        all_tex += f"\n\n%% === Table: {sc_name} Detail ===\n" + t_sc
    all_tex += LATEX_FOOTER

    p_all = out_dir / "all_tables.tex"
    p_all.write_text(all_tex, encoding="utf-8")
    print(f"\n통합 파일: {p_all}")
    print(
        "\n사용법:\n"
        "  LaTeX 컴파일: pdflatex all_tables.tex\n"
        "  또는 개별 표를 \\input{} 으로 논문에 삽입\n"
        "\n  \\input{tables/table1_main_results}\n"
        "  \\input{tables/table2_significance}\n"
        "  \\input{tables/table3_ranking}"
    )


if __name__ == "__main__":
    main()
