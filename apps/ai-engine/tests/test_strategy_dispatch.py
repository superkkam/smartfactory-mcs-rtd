"""
Strategy 디스패처 단위 테스트
ASTAR/AI_PPO/CBS_TS: is_available 확인
CACTUS: NotImplementedError + is_available=False 검증
"""
import networkx as nx
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


def test_cactus_not_available_without_checkpoint():
    """체크포인트 없으면 CACTUS is_available=False (A* fallback 모드)"""
    from engine.cactus.qmix_agent import qmix_agent
    if not qmix_agent.is_loaded:
        strategy = get_strategy("cactus")
        assert strategy.is_available is False


def test_cbs_ts_available_when_pulp_installed():
    """CBS-TS는 pulp 설치 시 is_available=True"""
    pytest.importorskip("pulp")
    strategy = get_strategy("cbs_ts")
    assert strategy.is_available is True


def test_cactus_predict_returns_path_via_astar_fallback():
    """체크포인트 없을 때 CACTUS.predict → A* fallback 경로 반환 (예외 없음)"""
    strategy = get_strategy("cactus")
    g = _make_mini_graph()
    path, cost, confidence = strategy.predict(
        graph=g,
        source_id="A",
        dest_id="C",
        unit_labels={},
    )
    assert path[0] == "A"
    assert path[-1] == "C"
    assert cost > 0


def _make_mini_graph() -> nx.DiGraph:
    """A → B → C 단방향 선형 그래프"""
    g = nx.DiGraph()
    g.add_edge("A", "B", weight=1.0)
    g.add_edge("B", "C", weight=2.0)
    return g


def test_cbs_ts_predict_returns_path():
    """CBS-TS.predict — 올바른 경로(A~C) 반환 검증"""
    pytest.importorskip("pulp")
    strategy = get_strategy("cbs_ts")
    g = _make_mini_graph()
    path, cost, confidence = strategy.predict(
        graph=g,
        source_id="A",
        dest_id="C",
        unit_labels={"A": "a", "B": "b", "C": "c"},
    )
    assert path[0] == "A"
    assert path[-1] == "C"
    assert cost > 0
    assert confidence == 1.0


def test_astar_predict_returns_path():
    """AstarStrategy.predict 기본 동작 검증"""
    strategy = get_strategy("astar")
    g = _make_mini_graph()
    path, cost, confidence = strategy.predict(
        graph=g,
        source_id="A",
        dest_id="C",
        unit_labels={},
    )
    assert path == ["A", "B", "C"]
    assert cost == pytest.approx(3.0)
    assert confidence == 1.0
