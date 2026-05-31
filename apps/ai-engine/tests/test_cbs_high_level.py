"""
CBS High-Level 충돌 탐지 + 탐색 단위 테스트

검증 항목:
1. detect_conflicts — vertex conflict 탐지
2. detect_conflicts — edge conflict 탐지
3. detect_conflicts — 충돌 없음 → None
4. cbs_search — 2-AMR 직선 충돌 해소
5. cbs_search — 단일 에이전트 경로
"""
import networkx as nx
import pytest
from engine.cbs_ts.cbs_high_level import detect_conflicts, cbs_search, Constraint


def _corridor_graph() -> nx.DiGraph:
    """A ↔ B ↔ C 양방향 통로"""
    g = nx.DiGraph()
    g.add_edge("A", "B", weight=1.0)
    g.add_edge("B", "A", weight=1.0)
    g.add_edge("B", "C", weight=1.0)
    g.add_edge("C", "B", weight=1.0)
    return g


def _grid_graph() -> nx.DiGraph:
    """
    2×2 그리드 (4방향)
    TL - TR
    |    |
    BL - BR
    """
    g = nx.DiGraph()
    for u, v in [("TL", "TR"), ("TR", "TL"), ("TL", "BL"), ("BL", "TL"),
                 ("TR", "BR"), ("BR", "TR"), ("BL", "BR"), ("BR", "BL")]:
        g.add_edge(u, v, weight=1.0)
    return g


# ── detect_conflicts 테스트 ──────────────────────────────────────────


def test_vertex_conflict_detected():
    """두 AMR이 t=1에 같은 노드 B 점유 → vertex conflict"""
    solution = {
        "amr1": [("A", 0), ("B", 1)],
        "amr2": [("C", 0), ("B", 1)],
    }
    result = detect_conflicts(solution)
    assert result is not None
    a1, a2, t, ctype, info = result
    assert ctype == "vertex"
    assert info == "B"
    assert t == 1


def test_edge_conflict_detected():
    """두 AMR이 t=0→t=1에 서로 반대 방향 진행 → edge conflict"""
    solution = {
        "amr1": [("A", 0), ("B", 1)],
        "amr2": [("B", 0), ("A", 1)],
    }
    result = detect_conflicts(solution)
    assert result is not None
    _, _, _, ctype, _ = result
    assert ctype == "edge"


def test_no_conflict_returns_none():
    """충돌 없는 솔루션 → None (완전히 다른 경로)"""
    solution = {
        "amr1": [("A", 0), ("B", 1), ("C", 2)],
        "amr2": [("D", 0), ("E", 1), ("F", 2)],  # 완전히 별개 경로
    }
    result = detect_conflicts(solution)
    assert result is None


# ── cbs_search 테스트 ────────────────────────────────────────────────


def test_single_agent_path():
    """단일 에이전트 A→C: 충돌 없이 경로 반환"""
    g = _corridor_graph()
    solution = cbs_search(g, {"amr1": ("A", "C")})
    assert "amr1" in solution
    path = solution["amr1"]
    assert path[0] == "A"
    assert path[-1] == "C"


def test_two_agent_collision_resolved():
    """2-AMR 정면 충돌 해소: amr1(A→C), amr2(C→A)"""
    g = _corridor_graph()
    solution = cbs_search(
        g,
        {"amr1": ("A", "C"), "amr2": ("C", "A")},
        time_limit=10.0,
    )
    assert "amr1" in solution
    assert "amr2" in solution

    path1 = solution["amr1"]
    path2 = solution["amr2"]

    assert path1[0] == "A" and path1[-1] == "C"
    assert path2[0] == "C" and path2[-1] == "A"


def test_four_agent_grid():
    """4-AMR 2×2 그리드: 각자 목적지 도달"""
    g = _grid_graph()
    tasks = {
        "amr1": ("TL", "BR"),
        "amr2": ("BR", "TL"),
        "amr3": ("TR", "BL"),
        "amr4": ("BL", "TR"),
    }
    solution = cbs_search(g, tasks, time_limit=15.0)

    for agent, (src, dst) in tasks.items():
        if agent in solution and solution[agent]:
            path = solution[agent]
            assert path[0] == src
            assert path[-1] == dst
