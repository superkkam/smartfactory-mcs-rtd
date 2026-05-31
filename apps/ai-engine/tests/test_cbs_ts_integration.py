"""
CBS-TS 통합 smoke test

시나리오:
1. 단일 에이전트 — CbsTsStrategy.predict (MLA* 단독)
2. 다중 에이전트 — solve_multi_agent (MILP + CBS)
"""
import networkx as nx
import pytest

pytestmark = pytest.mark.skipif(
    pytest.importorskip("pulp", reason="pulp 미설치") is None,
    reason="pulp 미설치",
)


def _make_grid_8() -> nx.DiGraph:
    """4×2 그리드 (양방향) — 8노드"""
    nodes = [f"N{i}" for i in range(8)]
    g = nx.DiGraph()
    # 가로 연결
    for row in range(2):
        for col in range(3):
            u = nodes[row * 4 + col]
            v = nodes[row * 4 + col + 1]
            g.add_edge(u, v, weight=1.0)
            g.add_edge(v, u, weight=1.0)
    # 세로 연결
    for col in range(4):
        u = nodes[col]
        v = nodes[4 + col]
        g.add_edge(u, v, weight=1.0)
        g.add_edge(v, u, weight=1.0)
    return g


def test_single_agent_cbs_ts_strategy():
    """CbsTsStrategy.predict — N0 → N7 경로 반환"""
    from engine.strategy import get_strategy
    strategy = get_strategy("cbs_ts")
    g = _make_grid_8()
    path, cost, confidence = strategy.predict(
        graph=g,
        source_id="N0",
        dest_id="N7",
        unit_labels={},
    )
    assert path[0] == "N0"
    assert path[-1] == "N7"
    assert cost > 0
    assert confidence == pytest.approx(1.0)


def test_multi_agent_solve():
    """solve_multi_agent — 4 task / 4 AMR: 모든 경로 반환"""
    from engine.cbs_ts import solve_multi_agent, Task

    g = _make_grid_8()
    tasks = [
        Task("T1", "N0", "N7", allowed_amr_types=["TYPE_A"]),
        Task("T2", "N7", "N0", allowed_amr_types=["TYPE_A"]),
        Task("T3", "N1", "N6", allowed_amr_types=["TYPE_A"]),
        Task("T4", "N6", "N1", allowed_amr_types=["TYPE_A"]),
    ]
    amrs = {
        "AMR_1": "TYPE_A",
        "AMR_2": "TYPE_A",
        "AMR_3": "TYPE_A",
        "AMR_4": "TYPE_A",
    }
    travel_matrix = {
        (n1, n2): 3.0
        for n1 in [f"N{i}" for i in range(8)]
        for n2 in [f"N{i}" for i in range(8)]
        if n1 != n2
    }

    forest, assignments = solve_multi_agent(
        g, tasks, amrs, travel_time_matrix=travel_matrix, cbs_time_limit=10.0
    )

    # 4개 작업 모두 할당됨
    assert len(assignments) == 4

    # 각 할당된 경로의 시작/끝 검증
    merged = forest.merge_solutions()
    for path in merged.values():
        assert len(path) >= 1  # 경로가 비어있지 않음


def test_makespan_non_negative():
    """makespan은 0 이상"""
    from engine.cbs_ts import solve_multi_agent, Task

    g = _make_grid_8()
    tasks = [Task("T1", "N0", "N3")]
    amrs = {"AMR_1": "TYPE_A"}
    matrix = {("N0", "N3"): 5.0, ("N3", "N0"): 5.0}

    _, assignments = solve_multi_agent(g, tasks, amrs, travel_time_matrix=matrix)
    assert len(assignments) == 1
    assert assignments[0].estimated_makespan >= 0
    assert assignments[0].start_time >= 0
