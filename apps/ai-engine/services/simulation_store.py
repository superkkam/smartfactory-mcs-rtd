"""
인메모리 시뮬레이션 진행률 저장소
BackgroundTasks에서 진행률을 갱신하고, GET API에서 읽음
"""
from dataclasses import dataclass, field
from typing import Optional
import threading


@dataclass
class SimulationState:
    run_id: str
    status: str = "Running"     # Running | Completed | Failed
    progress: int = 0           # 0~100
    error: Optional[str] = None


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


# 전역 싱글턴
simulation_store = SimulationStore()
