"""
인메모리 시뮬레이션 진행률 + raw 데이터 저장소
BackgroundTasks에서 진행률/결과를 갱신하고, GET API에서 읽음
"""
from dataclasses import dataclass
from typing import Any, Dict, Optional
import threading


@dataclass
class SimulationState:
    run_id: str
    status: str = "Running"     # Running | Completed | Failed
    progress: int = 0           # 0~100
    error: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None        # 알고리즘별 raw 메트릭
    pvalue_data: Optional[Dict[str, Any]] = None     # 메트릭별 쌍별 p-value
    agent_traces_data: Optional[Dict[str, Any]] = None    # 알고리즘별 agent trace (재생 뷰용)
    conflict_events_data: Optional[Dict[str, Any]] = None # 알고리즘별 실제 충돌 이벤트


class SimulationStore:
    """스레드 안전한 시뮬레이션 상태 저장소"""

    def __init__(self):
        self._store: dict[str, SimulationState] = {}
        self._lock = threading.Lock()

    def create(self, run_id: str) -> SimulationState:
        state = SimulationState(run_id=run_id)
        with self._lock:
            self._store[run_id] = state
        return state

    def get(self, run_id: str) -> Optional[SimulationState]:
        with self._lock:
            return self._store.get(run_id)

    def update_progress(self, run_id: str, progress: int) -> None:
        with self._lock:
            if run_id in self._store:
                self._store[run_id].progress = min(progress, 100)

    def complete(self, run_id: str) -> None:
        with self._lock:
            if run_id in self._store:
                self._store[run_id].status = "Completed"
                self._store[run_id].progress = 100

    def fail(self, run_id: str, error: str) -> None:
        with self._lock:
            if run_id in self._store:
                self._store[run_id].status = "Failed"
                self._store[run_id].error = error

    def store_raw(self, run_id: str, raw_data: Dict[str, Any]) -> None:
        """raw 메트릭 데이터 저장 (분포 차트 / 통계 검정용)"""
        with self._lock:
            if run_id in self._store:
                self._store[run_id].raw_data = raw_data

    def get_raw(self, run_id: str) -> Optional[Dict[str, Any]]:
        """raw 메트릭 데이터 조회"""
        with self._lock:
            state = self._store.get(run_id)
            return state.raw_data if state else None

    def store_pvalues(self, run_id: str, pvalue_data: Dict[str, Any]) -> None:
        """Wilcoxon 검정 결과 저장"""
        with self._lock:
            if run_id in self._store:
                self._store[run_id].pvalue_data = pvalue_data

    def get_pvalues(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Wilcoxon p-value 데이터 조회"""
        with self._lock:
            state = self._store.get(run_id)
            return state.pvalue_data if state else None

    def store_agent_traces(self, run_id: str, traces_by_alg: Dict[str, Any]) -> None:
        """알고리즘별 agent trace 저장 (재생 뷰용)"""
        with self._lock:
            if run_id in self._store:
                self._store[run_id].agent_traces_data = traces_by_alg

    def get_agent_traces(self, run_id: str) -> Optional[Dict[str, Any]]:
        """알고리즘별 agent trace 조회"""
        with self._lock:
            state = self._store.get(run_id)
            return state.agent_traces_data if state else None

    def store_conflict_events(self, run_id: str, events_by_alg: Dict[str, Any]) -> None:
        """알고리즘별 실제 충돌 이벤트 저장"""
        with self._lock:
            if run_id in self._store:
                self._store[run_id].conflict_events_data = events_by_alg

    def get_conflict_events(self, run_id: str) -> Optional[Dict[str, Any]]:
        """알고리즘별 실제 충돌 이벤트 조회"""
        with self._lock:
            state = self._store.get(run_id)
            return state.conflict_events_data if state else None


# 전역 싱글턴
simulation_store = SimulationStore()
