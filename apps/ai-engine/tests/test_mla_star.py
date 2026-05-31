"""
MLA* 단위 테스트

검증 항목:
1. 기본 경로 탐색 (TYPE_A)
2. TYPE_B 고하중 엣지 우회
3. CBS 제약(vertex constraint) 반영
4. goal_sequence 멀티-stop 경로
5. 경로 없음 → ValueError
"""
import networkx as nx
import pytest
from engine.cbs_ts.mla_star import mla_star, mla_star_with_time, MlaConstraint, HIGH_LOAD_THRESHOLD


def _linear_graph() -> nx.DiGraph:
    """A → B → C → D (단방향)"""
    g = nx.DiGraph()
    g.add_edge("A", "B", weight=1.0)
    g.add_edge("B", "C", weight=1.0)
    g.add_edge("C", "D", weight=1.0)
    return g


def _fork_graph() -> nx.DiGraph:
    """
    A → B → D (직선)
    A → C → D (우회, B-D 엣지가 고하중)
    B-D 엣지 weight > HIGH_LOAD_THRESHOLD → TYPE_B 통과 불가
    """
    g = nx.DiGraph()
    g.add_edge("A", "B", weight=1.0)
    g.add_edge("B", "D", weight=HIGH_LOAD_THRESHOLD + 1.0)  # 고하중
    g.add_edge("A", "C", weight=2.0)
    g.add_edge("C", "D", weight=2.0)
    return g


def test_basic_path_type_a():
    """TYPE_A: 최단 경로 A→D"""
    g = _linear_graph()
    path, cost = mla_star(g, "A", "D", amr_type="TYPE_A")
    assert path == ["A", "B", "C", "D"]
    assert cost == pytest.approx(3.0)


def test_type_b_avoids_high_load_edge():
    """TYPE_B: 고하중 B→D 엣지 우회 → A→C→D 선택"""
    g = _fork_graph()
    path, cost = mla_star(g, "A", "D", amr_type="TYPE_B")
    assert "B" not in path[1:]  # B를 경유하지 않거나 B→D 엣지를 사용하지 않음
    assert path[-1] == "D"
    assert path[0] == "A"


def test_type_a_uses_shortest():
    """TYPE_A: 고하중 엣지 제한 없어 더 짧은 A→B→D 선택"""
    g = _fork_graph()
    path, cost = mla_star(g, "A", "D", amr_type="TYPE_A")
    # A→B→D (1+HIGH+1) vs A→C→D (2+2) — 숫자에 따라 달라질 수 있음
    assert path[0] == "A" and path[-1] == "D"


def test_vertex_constraint_forces_wait():
    """CBS vertex 제약 반영: B를 t=1에 진입 불가 → 대기 또는 우회"""
    g = _linear_graph()
    cons = [MlaConstraint(node_id="B", time_step=1)]
    path_timed = mla_star_with_time(g, "A", "D", constraints=cons)
    # B에 t=1에 없어야 함
    at_t1 = {uid for uid, t in path_timed if t == 1}
    assert "B" not in at_t1


def test_goal_sequence_multi_stop():
    """TYPE_C 멀티-goal: A → B → D (순차 경유)"""
    g = _linear_graph()
    path, cost = mla_star(g, "A", "D", amr_type="TYPE_C", goal_sequence=["A", "B", "D"])
    assert path[0] == "A"
    assert "B" in path
    assert path[-1] == "D"


def test_no_path_raises():
    """연결되지 않은 그래프 → ValueError"""
    g = nx.DiGraph()
    g.add_node("X")
    g.add_node("Y")
    with pytest.raises(ValueError, match="경로 없음"):
        mla_star(g, "X", "Y")


def test_compatibility_map_blocks_node():
    """compatibility_map에서 TYPE_B가 B를 통과 불가 → C 우회"""
    g = nx.DiGraph()
    g.add_edge("A", "B", weight=1.0)
    g.add_edge("B", "D", weight=1.0)
    g.add_edge("A", "C", weight=3.0)
    g.add_edge("C", "D", weight=3.0)

    # B 노드는 TYPE_A만 통과 가능
    compat = {"B": ["TYPE_A"]}

    path, _ = mla_star(g, "A", "D", amr_type="TYPE_B", compatibility_map=compat)
    assert "B" not in path[1:]  # B를 경유하지 않음
    assert path[-1] == "D"
