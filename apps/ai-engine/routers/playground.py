"""
Algorithm Playground — 추상 그리드에서 알고리즘별 경로/충돌 즉석 비교 API
Supabase 미사용, in-memory 그리드 그래프만 사용
"""
import time
import logging
from typing import List, Literal, Tuple

import networkx as nx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/playground", tags=["playground"])


# ── 요청/응답 스키마 ─────────────────────────────────────────────────

class PlaygroundRequest(BaseModel):
    grid_size: int = Field(10, ge=4, le=20)
    obstacles: List[Tuple[int, int]] = []
    starts: List[Tuple[int, int]] = Field(..., min_length=1, max_length=8)
    goals: List[Tuple[int, int]] = Field(..., min_length=1, max_length=8)
    algorithm: Literal["astar", "ai_ppo", "cbs_ts", "prioritized"]


class AgentPath(BaseModel):
    agent_id: str
    path: List[Tuple[int, int]]  # (col, row) 시퀀스


class PlaygroundResponse(BaseModel):
    agent_paths: List[AgentPath]
    cost: float
    makespan: int
    conflict_count: int
    runtime_ms: float
    fallback: bool


# ── 그리드 → DiGraph 변환 ────────────────────────────────────────────

def _build_grid_graph(grid_size: int, obstacles: List[Tuple[int, int]]) -> nx.DiGraph:
    """4-방향 인접 그리드 DiGraph 생성. obstacle 노드는 제외."""
    obstacle_set = set(map(tuple, obstacles))
    g = nx.DiGraph()

    for row in range(grid_size):
        for col in range(grid_size):
            if (col, row) in obstacle_set:
                continue
            node = f"{col},{row}"
            g.add_node(node, col=col, row=row, amr_type="TYPE_A")

    for row in range(grid_size):
        for col in range(grid_size):
            if (col, row) in obstacle_set:
                continue
            node = f"{col},{row}"
            for dc, dr in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                nc, nr = col + dc, row + dr
                neighbor = f"{nc},{nr}"
                if 0 <= nc < grid_size and 0 <= nr < grid_size:
                    if (nc, nr) not in obstacle_set:
                        g.add_edge(node, neighbor, weight=1.0)

    return g


def _node_id(col: int, row: int) -> str:
    return f"{col},{row}"


def _parse_node(node_id: str) -> Tuple[int, int]:
    col, row = node_id.split(",")
    return int(col), int(row)


# ── 충돌 검출 ────────────────────────────────────────────────────────

def _count_conflicts(paths: List[List[str]]) -> int:
    """vertex + edge conflict 수 계산"""
    if len(paths) <= 1:
        return 0

    max_len = max(len(p) for p in paths)
    # 경로가 짧으면 마지막 위치에 정지
    padded = [p + [p[-1]] * (max_len - len(p)) for p in paths]

    conflicts = 0
    for t in range(max_len):
        positions = [padded[i][t] for i in range(len(padded))]
        # vertex conflict: 같은 시각 같은 셀
        conflicts += len(positions) - len(set(positions))

    # edge conflict: t→t+1에서 swap
    for t in range(max_len - 1):
        for i in range(len(padded)):
            for j in range(i + 1, len(padded)):
                if padded[i][t] == padded[j][t + 1] and padded[i][t + 1] == padded[j][t]:
                    conflicts += 1

    return conflicts


# ── 알고리즘별 다중 에이전트 경로 계산 ──────────────────────────────

def _solve_astar(graph: nx.DiGraph, tasks: dict) -> Tuple[dict, bool]:
    from engine.astar import run_astar
    paths = {}
    for agent_id, (src, dst) in tasks.items():
        try:
            path, _ = run_astar(graph, src, dst)
            paths[agent_id] = path
        except Exception:
            paths[agent_id] = [src, dst]
    return paths, False


def _solve_ppo(graph: nx.DiGraph, tasks: dict) -> Tuple[dict, bool]:
    from engine.ppo_agent import ppo_agent
    paths = {}
    fallback = False
    for agent_id, (src, dst) in tasks.items():
        try:
            path, _, conf = ppo_agent.predict(
                graph=graph,
                source_id=src,
                dest_id=dst,
                unit_labels={n: n for n in graph.nodes},
            )
            if conf == 0.0:
                fallback = True
        except Exception:
            from engine.astar import run_astar
            path, _ = run_astar(graph, src, dst)
            fallback = True
        paths[agent_id] = path
    return paths, fallback


def _solve_prioritized(graph: nx.DiGraph, tasks: dict) -> Tuple[dict, bool]:
    from engine.prioritized_planning import prioritized_planning
    solutions = prioritized_planning(graph, tasks, time_limit=10.0)
    return solutions, False


def _solve_cbs_ts(graph: nx.DiGraph, tasks: dict) -> Tuple[dict, bool]:
    """CBS High-level 직접 호출 (MILP 할당 생략, 그리드용 단순화)"""
    try:
        from engine.cbs_ts.cbs_high_level import cbs_search

        result = cbs_search(
            graph=graph,
            tasks=tasks,  # agent_id → (src, dst)
            amr_types={aid: "TYPE_A" for aid in tasks},
            time_limit=10.0,
        )
        if result:
            return result, False
        logger.warning("CBS-TS 탐색 실패, Prioritized로 폴백")
        return _solve_prioritized(graph, tasks)
    except Exception as exc:
        logger.warning(f"CBS-TS 실패, Prioritized로 폴백: {exc}")
        return _solve_prioritized(graph, tasks)


# ── 엔드포인트 ───────────────────────────────────────────────────────

@router.post("/solve", response_model=PlaygroundResponse)
async def solve(req: PlaygroundRequest) -> PlaygroundResponse:
    """
    그리드 + 출발/목적지 + 알고리즘 → 에이전트별 경로 + 지표 반환
    Supabase 미사용, 완전 in-memory
    """
    if len(req.starts) != len(req.goals):
        raise HTTPException(
            status_code=422,
            detail="starts 와 goals 길이가 같아야 합니다.",
        )

    graph = _build_grid_graph(req.grid_size, req.obstacles)

    # tasks: {agent_id: (src_node, dst_node)}
    tasks = {}
    for i, (sc, sg) in enumerate(zip(req.starts, req.goals)):
        src = _node_id(*sc)
        dst = _node_id(*sg)
        if src not in graph:
            raise HTTPException(status_code=422, detail=f"시작 셀 {sc}이 장애물이거나 범위 밖입니다.")
        if dst not in graph:
            raise HTTPException(status_code=422, detail=f"목적 셀 {sg}이 장애물이거나 범위 밖입니다.")
        tasks[f"agent_{i}"] = (src, dst)

    t0 = time.perf_counter()

    algo = req.algorithm
    if algo == "astar":
        paths_by_id, fallback = _solve_astar(graph, tasks)
    elif algo == "ai_ppo":
        paths_by_id, fallback = _solve_ppo(graph, tasks)
    elif algo == "prioritized":
        paths_by_id, fallback = _solve_prioritized(graph, tasks)
    elif algo == "cbs_ts":
        paths_by_id, fallback = _solve_cbs_ts(graph, tasks)
    else:
        raise HTTPException(status_code=422, detail=f"알 수 없는 알고리즘: {algo}")

    runtime_ms = (time.perf_counter() - t0) * 1000

    # (col, row) 튜플 경로로 변환
    agent_paths = []
    all_raw_paths = []
    total_cost = 0.0
    for agent_id, path in paths_by_id.items():
        xy_path = [_parse_node(n) for n in path]
        agent_paths.append(AgentPath(agent_id=agent_id, path=xy_path))
        all_raw_paths.append(path)
        total_cost += max(len(path) - 1, 0)

    makespan = max((len(p) - 1 for p in all_raw_paths), default=0)
    conflicts = _count_conflicts(all_raw_paths)

    return PlaygroundResponse(
        agent_paths=agent_paths,
        cost=total_cost,
        makespan=makespan,
        conflict_count=conflicts,
        runtime_ms=round(runtime_ms, 2),
        fallback=fallback,
    )
