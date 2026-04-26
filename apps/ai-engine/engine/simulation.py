"""
SimPy 이산 이벤트 시뮬레이션 엔진
A* vs PPO 알고리즘 비교 실험

시뮬레이션 모델:
  - Carrier 프로세스: 출발→목적지 반송 (알고리즘으로 경로 계산 → 엣지별 시간 소비)
  - TransferRequest 생성기: inter_arrival_time 간격으로 반송 요청 생성
  - 엣지 자원: simpy.Resource(capacity=1)로 충돌/대기 모델링

수집 지표 (mcs_simulation_result 7개 컬럼):
  avg_transfer_time, throughput, collision_count, load_balance_std,
  equipment_utilization, deadlock_count, route_efficiency_score
"""
import simpy
import random
import statistics
import math
import logging
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple
import networkx as nx

from config import settings
from engine.astar import run_astar

logger = logging.getLogger(__name__)

CARRIER_SPEED = settings.carrier_speed  # m/s


@dataclass
class TransferRecord:
    """개별 반송 완료 기록"""
    carrier_id: int
    source_id: str
    dest_id: str
    path: List[str]
    start_time: float
    end_time: float
    waited: bool = False        # 충돌/대기 발생 여부

    @property
    def duration(self) -> float:
        return self.end_time - self.start_time


@dataclass
class MetricsCollector:
    """알고리즘별 성과 지표 수집기"""
    records: List[TransferRecord] = field(default_factory=list)
    collision_count: int = 0
    node_pass_counts: Dict[str, int] = field(default_factory=dict)
    deadlock_count: int = 0
    optimal_costs: List[float] = field(default_factory=list)  # A* 최적 비용 (비교용)

    def record(self, record: TransferRecord, optimal_cost: float) -> None:
        self.records.append(record)
        if record.waited:
            self.collision_count += 1
        for node_id in record.path:
            self.node_pass_counts[node_id] = self.node_pass_counts.get(node_id, 0) + 1
        self.optimal_costs.append(optimal_cost)

    def summary(self, simulation_duration: float) -> dict:
        """7개 성과 지표 계산"""
        if not self.records:
            return self._empty_summary()

        durations = [r.duration for r in self.records]
        avg_transfer_time = statistics.mean(durations)
        throughput = len(self.records) / max(simulation_duration, 1.0)

        # 부하 균형: 노드별 통과 횟수의 표준편차
        pass_counts = list(self.node_pass_counts.values())
        load_balance_std = statistics.stdev(pass_counts) if len(pass_counts) > 1 else 0.0

        # 장비 가동률: 총 이동 시간 / (노드 수 * 시뮬레이션 시간)
        total_move_time = sum(durations)
        n_nodes = max(len(self.node_pass_counts), 1)
        equipment_utilization = min(
            (total_move_time / (n_nodes * max(simulation_duration, 1.0))) * 100.0,
            100.0,
        )

        # 경로 효율 점수: 실제 비용 대비 A* 최적 비용 비율
        if self.optimal_costs and durations:
            optimal_times = [c / CARRIER_SPEED * 1000 for c in self.optimal_costs]  # ms
            actual_times = [r.duration * 1000 for r in self.records]
            ratios = [
                min(opt / max(act, 0.001), 1.0)
                for opt, act in zip(optimal_times, actual_times)
            ]
            route_efficiency_score = statistics.mean(ratios) * 100.0
        else:
            route_efficiency_score = 70.0

        return {
            "avg_transfer_time": round(avg_transfer_time, 3),
            "throughput": round(throughput, 3),
            "collision_count": self.collision_count,
            "load_balance_std": round(load_balance_std, 3),
            "equipment_utilization": round(equipment_utilization, 2),
            "deadlock_count": self.deadlock_count,
            "route_efficiency_score": round(route_efficiency_score, 2),
        }

    def _empty_summary(self) -> dict:
        return {
            "avg_transfer_time": 0.0,
            "throughput": 0.0,
            "collision_count": 0,
            "load_balance_std": 0.0,
            "equipment_utilization": 0.0,
            "deadlock_count": 0,
            "route_efficiency_score": 0.0,
        }


class McsSimulation:
    """SimPy 기반 MCS 반송 시뮬레이션"""

    def __init__(
        self,
        graph: nx.DiGraph,
        unit_labels: Dict[str, str],
        scenario_params: dict,
        algorithms: List[str],
    ):
        """
        Args:
            graph: NetworkX DiGraph
            unit_labels: {uuid: label_str}
            scenario_params: {carrierCount, transferRequestCount, simulationDuration, layoutId}
            algorithms: ['astar', 'ai_ppo'] 또는 부분 집합
        """
        self.graph = graph
        self.unit_labels = unit_labels
        self.params = scenario_params
        self.algorithms = algorithms

        self.env = simpy.Environment()
        # 엣지별 SimPy 자원 (충돌 모델링)
        self.edge_resources: Dict[Tuple[str, str], simpy.Resource] = {}
        self.metrics: Dict[str, MetricsCollector] = {
            alg: MetricsCollector() for alg in algorithms
        }

        # 모든 연결된 노드 (경로 계산용)
        self._node_list = [n for n in graph.nodes() if graph.out_degree(n) > 0 or graph.in_degree(n) > 0]

        # Port 노드만 (반송 요청 S/D용 — Node는 경유점으로만 사용)
        self._port_node_list = [
            n for n in self._node_list
            if graph.nodes[n].get("unit_type") == "Port"
        ]

        if len(self._port_node_list) < 2:
            raise ValueError("시뮬레이션에 필요한 Port 노드가 부족합니다 (최소 2개 이상).")

    def _get_edge_resource(self, u: str, v: str) -> simpy.Resource:
        key = (u, v)
        if key not in self.edge_resources:
            self.edge_resources[key] = simpy.Resource(self.env, capacity=1)
        return self.edge_resources[key]

    def _carrier_process(
        self,
        carrier_id: int,
        source: str,
        dest: str,
        algorithm: str,
    ):
        """개별 캐리어 반송 프로세스"""
        start_time = self.env.now
        waited = False

        try:
            # 경로 계산 — Strategy 디스패치 (astar/ai_ppo/cactus/cbs_ts)
            from engine.strategy import get_strategy
            strategy = get_strategy(algorithm)
            path, _, _ = strategy.predict(
                graph=self.graph,
                source_id=source,
                dest_id=dest,
                unit_labels=self.unit_labels,
            )

            # A* 최적 비용 계산 (효율 점수 비교용)
            try:
                _, optimal_cost = run_astar(self.graph, source, dest)
            except Exception:
                optimal_cost = 1.0

            # 경로 이동 (엣지별 자원 요청 + 이동 시간)
            for i in range(len(path) - 1):
                u, v = path[i], path[i + 1]
                weight = self.graph[u][v].get("weight", 1.0) if self.graph.has_edge(u, v) else 1.0
                travel_time = weight / max(CARRIER_SPEED, 0.001)

                resource = self._get_edge_resource(u, v)
                with resource.request() as req:
                    result = yield req | self.env.timeout(travel_time * 0.1)
                    if req not in result:
                        # 대기 발생 (충돌)
                        waited = True
                        yield req  # 실제 자원 획득까지 대기

                    # 이동 시간
                    yield self.env.timeout(travel_time)

        except Exception as e:
            logger.debug(f"캐리어 {carrier_id} 경로 오류: {e}")
            # 경로 오류 시 기본 이동 시간만 소비
            yield self.env.timeout(5.0)
            path = [source, dest]
            optimal_cost = 1.0

        end_time = self.env.now
        record = TransferRecord(
            carrier_id=carrier_id,
            source_id=source,
            dest_id=dest,
            path=path if "path" in dir() else [source, dest],
            start_time=start_time,
            end_time=end_time,
            waited=waited,
        )
        self.metrics[algorithm].record(record, optimal_cost if "optimal_cost" in dir() else 1.0)

    def _transfer_generator(self, algorithm: str):
        """반송 요청 생성기"""
        total_requests = self.params.get("transferRequestCount", 20)
        carrier_count = self.params.get("carrierCount", 5)
        simulation_duration = self.params.get("simulationDuration", 300.0)

        # 평균 inter-arrival time
        inter_arrival = simulation_duration / max(total_requests, 1)

        for i in range(total_requests):
            # Port 노드 중에서만 출발/목적지 선택 (Node는 경유점 전용)
            if len(self._port_node_list) < 2:
                break
            source, dest = random.sample(self._port_node_list, 2)
            carrier_id = (i % carrier_count) + 1

            self.env.process(self._carrier_process(carrier_id, source, dest, algorithm))

            # 지수 분포 간격
            yield self.env.timeout(random.expovariate(1.0 / max(inter_arrival, 0.1)))

    def run(self, progress_callback: Optional[Callable[[int], None]] = None) -> Dict[str, dict]:
        """
        시뮬레이션 실행

        Args:
            progress_callback: 진행률(0-100) 콜백

        Returns:
            {algorithm: metrics_dict} — 알고리즘별 7개 지표
        """
        simulation_duration = self.params.get("simulationDuration", 300.0)

        # 각 알고리즘의 반송 요청 생성기 등록
        for algorithm in self.algorithms:
            self.env.process(self._transfer_generator(algorithm))

        # 진행률 보고하며 실행 (5% 단위)
        steps = 20
        for step in range(1, steps + 1):
            until_time = simulation_duration * step / steps
            self.env.run(until=until_time)
            progress = int(step * 100 / steps)
            if progress_callback:
                progress_callback(progress)

        # 결과 집계
        results = {}
        for algorithm in self.algorithms:
            results[algorithm] = self.metrics[algorithm].summary(simulation_duration)

        return results
