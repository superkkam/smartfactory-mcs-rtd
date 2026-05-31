"""
통계 분석 유틸리티 — SCI 저널 표준 (Demšar JMLR 2006)

  compute_ci     — t-분포 기반 95% 신뢰구간
  wilcoxon_test  — Wilcoxon signed-rank (paired, 시드 동일)
  bonferroni_adjust — 다중 비교 Bonferroni 보정
  summary_stats  — 알고리즘별 메트릭 요약
"""
import math
import statistics
from typing import Dict, List, Tuple


def compute_ci(values: List[float], level: float = 0.95) -> Tuple[float, float]:
    """
    t-분포 기반 신뢰구간 (n<30: t분포, n≥30: 정규 근사)

    Returns:
        (lower, upper) — 신뢰구간 양 끝
    """
    n = len(values)
    if n == 0:
        return (0.0, 0.0)
    if n == 1:
        v = values[0]
        return (v, v)

    mean = statistics.mean(values)
    se   = statistics.stdev(values) / math.sqrt(n)

    # t-critical (간단 근사: df = n-1, 양측 95%)
    t_crit = _t_critical(n - 1, level)
    margin = t_crit * se
    return (mean - margin, mean + margin)


def wilcoxon_test(a: List[float], b: List[float]) -> float:
    """
    Wilcoxon signed-rank 검정 (paired).
    scipy 미존재 시 정규 근사 폴백.

    Returns:
        p-value (양측)
    """
    if len(a) != len(b) or len(a) == 0:
        return 1.0

    try:
        from scipy.stats import wilcoxon
        _, p = wilcoxon(a, b, zero_method="wilcox", alternative="two-sided")
        return float(p)
    except ImportError:
        pass
    except Exception:
        pass

    # 정규 근사 폴백 (n≥10 권장)
    n = len(a)
    diffs = [x - y for x, y in zip(a, b) if abs(x - y) > 1e-10]
    if not diffs:
        return 1.0
    r = sorted(range(len(diffs)), key=lambda i: abs(diffs[i]))
    W_plus = sum(i + 1 for i in r if diffs[i] > 0)
    n_eff  = len(diffs)
    mu_W   = n_eff * (n_eff + 1) / 4.0
    sigma_W = math.sqrt(n_eff * (n_eff + 1) * (2 * n_eff + 1) / 24.0)
    if sigma_W == 0:
        return 1.0
    z = (W_plus - mu_W) / sigma_W
    p = 2.0 * (1.0 - _norm_cdf(abs(z)))
    return p


def bonferroni_adjust(p_values: List[float]) -> List[float]:
    """
    Bonferroni 보정 — p_values[i] * m (m = 검정 수), 1.0 클램프

    Returns:
        보정된 p-value 리스트 (원래 순서 유지)
    """
    m = len(p_values)
    if m == 0:
        return []
    return [min(p * m, 1.0) for p in p_values]


def summary_stats(
    raw_values: Dict[str, List[float]],
    level: float = 0.95,
) -> Dict[str, Dict[str, float]]:
    """
    알고리즘별 메트릭 요약 통계

    Args:
        raw_values: {algorithm: [metric_value_per_seed]}
        level: 신뢰수준 (기본 0.95)

    Returns:
        {algorithm: {mean, std, ci_low, ci_high, n}}
    """
    result = {}
    for alg, vals in raw_values.items():
        if not vals:
            result[alg] = {"mean": 0.0, "std": 0.0, "ci_low": 0.0, "ci_high": 0.0, "n": 0}
            continue
        mean_v = statistics.mean(vals)
        std_v  = statistics.stdev(vals) if len(vals) > 1 else 0.0
        ci     = compute_ci(vals, level)
        result[alg] = {
            "mean":    round(mean_v, 4),
            "std":     round(std_v, 4),
            "ci_low":  round(ci[0], 4),
            "ci_high": round(ci[1], 4),
            "n":       len(vals),
        }
    return result


def pairwise_wilcoxon(
    raw_values: Dict[str, List[float]],
) -> Dict[Tuple[str, str], float]:
    """
    모든 알고리즘 쌍에 대해 Wilcoxon p-value 계산

    Returns:
        {(alg_a, alg_b): p_value}
    """
    algs = list(raw_values.keys())
    pairs: Dict[Tuple[str, str], float] = {}
    p_list: List[float] = []
    pair_keys: List[Tuple[str, str]] = []

    for i in range(len(algs)):
        for j in range(i + 1, len(algs)):
            a, b = algs[i], algs[j]
            key = (a, b)
            p = wilcoxon_test(raw_values[a], raw_values[b])
            pairs[key] = p
            p_list.append(p)
            pair_keys.append(key)

    # Bonferroni 보정 적용
    adjusted = bonferroni_adjust(p_list)
    for key, p_adj in zip(pair_keys, adjusted):
        pairs[key] = p_adj

    return pairs


# ── 내부 유틸 ──────────────────────────────────────────────────────

def _t_critical(df: int, level: float) -> float:
    """t-critical (양측) 근사 — 표준 값 테이블"""
    alpha = 1.0 - level
    # 자주 쓰는 df별 t-critical (양측 α=0.05)
    table = {
        1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
        6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
        12: 2.179, 15: 2.131, 20: 2.086, 24: 2.064, 25: 2.060,
        30: 2.042, 40: 2.021, 60: 2.000, 120: 1.980,
    }
    if level == 0.95:
        # 가장 가까운 df 조회
        if df >= 120:
            return 1.960
        keys = sorted(table.keys())
        for k in keys:
            if df <= k:
                return table[k]
        return 1.960
    # 다른 수준: 정규 근사
    return _norm_ppf(1.0 - alpha / 2.0)


def _norm_cdf(x: float) -> float:
    """표준 정규 CDF (수치 근사)"""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _norm_ppf(p: float) -> float:
    """표준 정규 분위수 (Beasley-Springer-Moro 근사)"""
    if p <= 0.0:
        return -math.inf
    if p >= 1.0:
        return math.inf
    # rational approximation
    a = [0, -3.969683028665376e+01, 2.209460984245205e+02,
         -2.759285104469687e+02, 1.383577518672690e+02,
         -3.066479806614716e+01, 2.506628277459239e+00]
    b = [0, -5.447609879822406e+01, 1.615858368580409e+02,
         -1.556989798598866e+02, 6.680131188771972e+01,
         -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01,
         -2.400758277161838e+00, -2.549732539343734e+00,
          4.374664141464968e+00,  2.938163982698783e+00]
    d = [7.784695709041462e-03, 3.224671290700398e-01,
         2.445134137142996e+00, 3.754408661907416e+00]
    p_low, p_high = 0.02425, 1 - 0.02425
    if p < p_low:
        q = math.sqrt(-2 * math.log(p))
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
               ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    elif p <= p_high:
        q = p - 0.5
        r = q * q
        return (((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q / \
               (((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1)
    else:
        q = math.sqrt(-2 * math.log(1 - p))
        return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
                ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
