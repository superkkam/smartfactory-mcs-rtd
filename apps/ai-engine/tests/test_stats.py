"""
stats.py 단위 테스트 (Phase 4)

검증 항목:
1. compute_ci — 알려진 분포에서 CI 폭 검증
2. wilcoxon_test — 동일 분포 p ≈ 1.0, 차이 큰 분포 p << 0.05
3. bonferroni_adjust — m배 팽창, 1.0 클램프
4. pairwise_wilcoxon — 쌍별 p-value 개수 검증
"""
import math
import pytest
from engine.stats import compute_ci, wilcoxon_test, bonferroni_adjust, pairwise_wilcoxon


def test_ci_symmetric():
    """CI는 평균 중심으로 대칭"""
    values = [10.0, 12.0, 14.0, 11.0, 13.0]
    lo, hi = compute_ci(values)
    mean = sum(values) / len(values)
    assert abs((lo + hi) / 2 - mean) < 0.01


def test_ci_wider_for_high_variance():
    """분산이 클수록 CI 폭 넓어짐"""
    narrow = [10.0, 10.1, 9.9, 10.0, 10.0]
    wide   = [1.0, 20.0, 5.0, 15.0, 8.0]
    lo_n, hi_n = compute_ci(narrow)
    lo_w, hi_w = compute_ci(wide)
    assert (hi_w - lo_w) > (hi_n - lo_n)


def test_ci_single_value():
    """단일값 CI = (v, v)"""
    lo, hi = compute_ci([5.0])
    assert lo == hi == 5.0


def test_wilcoxon_identical_returns_high_p():
    """동일 분포 — p ≈ 1.0"""
    a = [1.0, 2.0, 3.0, 4.0, 5.0]
    b = [1.0, 2.0, 3.0, 4.0, 5.0]
    p = wilcoxon_test(a, b)
    # scipy.stats.wilcoxon은 동일할 때 p=1.0 반환
    assert p >= 0.5


def test_wilcoxon_different_distributions():
    """명백히 다른 분포 — p < 0.1"""
    a = [1.0, 1.1, 0.9, 1.0, 1.0] * 5  # 평균 ≈ 1
    b = [10.0, 9.9, 10.1, 10.0, 10.0] * 5  # 평균 ≈ 10
    p = wilcoxon_test(a, b)
    assert p < 0.1


def test_wilcoxon_mismatched_length():
    """길이 다르면 p = 1.0 반환"""
    p = wilcoxon_test([1.0, 2.0], [1.0])
    assert p == 1.0


def test_bonferroni_scales_p():
    """Bonferroni: p_adj = p × m"""
    raw = [0.01, 0.02, 0.03]
    adj = bonferroni_adjust(raw)
    assert abs(adj[0] - 0.03) < 1e-9
    assert abs(adj[1] - 0.06) < 1e-9
    assert abs(adj[2] - 0.09) < 1e-9


def test_bonferroni_clamped_at_1():
    """Bonferroni 보정 후 1.0 초과 시 클램프"""
    adj = bonferroni_adjust([0.5, 0.5, 0.5])
    assert all(p <= 1.0 for p in adj)


def test_pairwise_wilcoxon_pair_count():
    """n개 알고리즘 → C(n,2)개 쌍"""
    raw = {
        "astar":  [1.0, 1.1, 0.9],
        "cbs_ts": [1.5, 1.6, 1.4],
        "ai_ppo": [1.2, 1.3, 1.1],
    }
    pairs = pairwise_wilcoxon(raw)
    assert len(pairs) == 3  # C(3,2) = 3
