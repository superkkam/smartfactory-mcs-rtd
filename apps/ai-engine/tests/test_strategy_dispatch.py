"""
Strategy 디스패처 단위 테스트
ASTAR/AI_PPO: is_available 확인
CACTUS/CBS_TS: NotImplementedError + is_available=False 검증
"""
import pytest
from engine.strategy import STRATEGY_REGISTRY, VALID_ALGORITHMS, get_strategy


def test_all_algorithms_registered():
    """4개 알고리즘 모두 Registry에 등록됨"""
    assert "astar"  in STRATEGY_REGISTRY
    assert "ai_ppo" in STRATEGY_REGISTRY
    assert "cactus" in STRATEGY_REGISTRY
    assert "cbs_ts" in STRATEGY_REGISTRY


def test_valid_algorithms_set():
    assert VALID_ALGORITHMS == frozenset({"astar", "ai_ppo", "cactus", "cbs_ts"})


def test_get_strategy_unknown_raises():
    with pytest.raises(ValueError, match="알 수 없는 알고리즘"):
        get_strategy("unknown_algo")


def test_astar_strategy_available():
    strategy = get_strategy("astar")
    assert strategy.is_available is True


def test_cactus_not_available():
    """CACTUS는 Task 025 미구현 → is_available=False"""
    strategy = get_strategy("cactus")
    assert strategy.is_available is False


def test_cbs_ts_not_available():
    """CBS-TS는 Task 026 미구현 → is_available=False"""
    strategy = get_strategy("cbs_ts")
    assert strategy.is_available is False


def test_cactus_predict_raises_not_implemented():
    strategy = get_strategy("cactus")
    with pytest.raises(NotImplementedError, match="Task 025"):
        strategy.predict(
            graph=None,  # type: ignore
            source_id="a",
            dest_id="b",
            unit_labels={},
        )


def test_cbs_ts_predict_raises_not_implemented():
    strategy = get_strategy("cbs_ts")
    with pytest.raises(NotImplementedError, match="Task 026"):
        strategy.predict(
            graph=None,  # type: ignore
            source_id="a",
            dest_id="b",
            unit_labels={},
        )
