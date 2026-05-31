"""
GraphMAPFEnv 단위 테스트
- reset / step 기본 동작
- vertex 충돌 처리
- edge swap 충돌 처리
- 목적지 도달 보상

의존성: pettingzoo (없으면 skip)
"""
import pytest
import networkx as nx
import numpy as np

pytest.importorskip("pettingzoo", reason="pettingzoo 미설치 — CACTUS 테스트 skip")

from engine.cactus.multi_agent_env import GraphMAPFEnv, sample_agent_tasks, MAX_NODES, MAX_NEIGHBORS


@pytest.fixture
def linear_graph():
    """4-노드 선형 양방향 그래프: 0 ↔ 1 ↔ 2 ↔ 3"""
    g = nx.DiGraph()
    nodes = ["n0", "n1", "n2", "n3"]
    for nd in nodes:
        g.add_node(nd, unit_type="Port")
    for i in range(len(nodes) - 1):
        g.add_edge(nodes[i], nodes[i + 1], weight=1.0)
        g.add_edge(nodes[i + 1], nodes[i], weight=1.0)
    return g


def test_reset_returns_correct_shapes(linear_graph):
    """reset() → obs dict 키=에이전트 수, 값 shape=(obs_dim,)"""
    env = GraphMAPFEnv(linear_graph, [("n0", "n3"), ("n3", "n0")])
    obs, infos = env.reset(seed=0)
    assert set(obs.keys()) == {"amr_0", "amr_1"}
    for a, o in obs.items():
        assert o.shape == (3 * MAX_NODES + MAX_NEIGHBORS,), f"{a} obs shape 오류: {o.shape}"
    assert set(infos.keys()) == {"amr_0", "amr_1"}


def test_step_valid_action_moves_agent(linear_graph):
    """유효 이웃 행동 → 에이전트 위치 변경"""
    env = GraphMAPFEnv(linear_graph, [("n0", "n3")])
    env.reset(seed=1)
    pos_before = env._positions["amr_0"]
    # n0의 이웃은 n1(인덱스 0)
    _, rewards, terminations, truncations, _ = env.step({"amr_0": 0})
    pos_after = env._positions.get("amr_0", pos_before)
    # 목적지 미도달이면 위치 변경됨
    if not terminations.get("amr_0", False):
        assert pos_after != pos_before, "유효 행동 시 위치가 바뀌어야 함"


def test_goal_reward(linear_graph):
    """목적지 도달 → reward=+100, terminated=True"""
    # n0 → n1 (인접 1홉)
    env = GraphMAPFEnv(linear_graph, [("n0", "n1")])
    env.reset(seed=2)
    _, rewards, terminations, _, _ = env.step({"amr_0": 0})
    assert rewards.get("amr_0", 0) == pytest.approx(100.0), "목적지 도달 보상 오류"
    assert terminations.get("amr_0", False) is True


def test_invalid_action_penalty(linear_graph):
    """인덱스 범위 초과 → reward=-10, 위치 불변"""
    env = GraphMAPFEnv(linear_graph, [("n0", "n3")])
    env.reset(seed=3)
    pos_before = env._positions["amr_0"]
    _, rewards, _, _, _ = env.step({"amr_0": MAX_NEIGHBORS - 1})  # n0 이웃은 1개
    # n0 이웃이 1개이므로 MAX_NEIGHBORS-1(9)는 무효
    neighbors_n0 = list(linear_graph.successors("n0"))
    if len(neighbors_n0) < MAX_NEIGHBORS - 1:
        assert rewards.get("amr_0", 0) == pytest.approx(-10.0)
        assert env._positions.get("amr_0") == pos_before


def test_vertex_collision_penalty(linear_graph):
    """두 에이전트가 같은 노드로 동시 이동 → 한 명 정지 + 페널티"""
    # n0→n1 (action=0), n2→n1 (action=0: n2 이웃 첫 번째가 n1)
    env = GraphMAPFEnv(linear_graph, [("n0", "n3"), ("n2", "n0")])
    env.reset(seed=4)
    # linear_graph에서 n0 이웃=[n1], n2 이웃=[n1, n3]
    # amr_0: action=0 → n1, amr_1: action=0 → n1 (같은 목적지 → vertex 충돌)
    _, rewards, _, _, _ = env.step({"amr_0": 0, "amr_1": 0})
    r0, r1 = rewards.get("amr_0", 0), rewards.get("amr_1", 0)
    collision_happened = (r0 == pytest.approx(-10.0) or r1 == pytest.approx(-10.0))
    assert collision_happened, f"vertex 충돌 페널티 없음: r0={r0}, r1={r1}"


def test_get_state_shape(linear_graph):
    """get_state() → (2 * MAX_NODES * n_agents,) shape"""
    env = GraphMAPFEnv(linear_graph, [("n0", "n3"), ("n3", "n0")])
    env.reset(seed=5)
    state = env.get_state()
    expected_dim = 2 * MAX_NODES * 2
    assert state.shape == (expected_dim,), f"state shape 오류: {state.shape}"


def test_sample_agent_tasks(linear_graph):
    """sample_agent_tasks → n_agents 개 (src, dst) 반환"""
    tasks = sample_agent_tasks(linear_graph, n_agents=2, bfs_max_dist=3, seed=0)
    assert len(tasks) == 2
    for src, dst in tasks:
        assert src in linear_graph.nodes()
        assert dst in linear_graph.nodes()
        assert src != dst
