"""
FastAPI 요청/응답 Pydantic 스키마
프론트엔드 TypeScript 타입과 1:1 대응
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Tuple


# ── 추론 요청/응답 ────────────────────────────────────────────────

class InferenceRequest(BaseModel):
    layoutId: str
    sourceUnitId: str
    destUnitId: str
    dynamicWeights: Optional[Dict[str, float]] = None
    algorithm: Optional[str] = "ai_ppo"


class AiRouteStep(BaseModel):
    unitId: str
    unitLabel: str
    weight: float
    congestionFactor: float
    predictedTimeMs: float


class InferenceResponse(BaseModel):
    route: List[AiRouteStep]
    totalCost: float
    confidence: float
    inferenceTimeMs: float
    fallback: bool = False


# ── 시뮬레이션 요청/응답 ──────────────────────────────────────────

class ScenarioParams(BaseModel):
    layoutId: str
    carrierCount: int = Field(default=5, ge=1)
    # utilizationRate 지정 시 transferRequestCount는 백엔드에서 자동 계산
    utilizationRate: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    transferRequestCount: Optional[int] = Field(default=None, ge=1)
    simulationDuration: float = Field(default=300.0, gt=0)
    mode: str = Field(default="online")   # "online" | "batch"


class SimulationRunRequest(BaseModel):
    scenarioParams: ScenarioParams
    algorithms: List[str] = Field(default=["astar", "ai_ppo"])
    seeds: Optional[List[int]] = None    # None이면 단일 랜덤 실행, 지정하면 다중 시드


class SimulationRunResponse(BaseModel):
    runId: str
    status: str


class SimulationStatusResponse(BaseModel):
    runId: str
    status: str
    progress: int


class AgentTrace(BaseModel):
    """캐리어 1건의 이동 경로 (재생 뷰용)"""
    agentId: str
    srcUnit: str
    dstUnit: str
    path: List[str]
    startTime: float
    endTime: float


class ConflictEvent(BaseModel):
    """시뮬레이션 중 실제로 발생한 충돌 이벤트"""
    carrierId: str
    nodeId: str
    time: float


class SimulationResultItem(BaseModel):
    algorithm: str
    # ── MAPF 표준 메트릭 ──
    makespan: float = 0.0
    sumOfCosts: float = 0.0
    avgTransferTime: float = 0.0
    avgWaitTime: float = 0.0
    amrUtilization: float = 0.0
    throughput: float = 0.0
    deadlockCount: int = 0
    deadlockRate: float = 0.0
    pathOptimality: float = 0.0
    conflictCount: int = 0
    # ── 기존 호환 필드 ──
    collisionCount: int = 0
    loadBalanceStd: float = 0.0
    equipmentUtilization: float = 0.0
    routeEfficiencyScore: float = 0.0
    # ── 통계 (다중 시드 실행 시) ──
    makespanStd: float = 0.0
    makespanCiLow: float = 0.0
    makespanCiHigh: float = 0.0
    avgTransferTimeStd: float = 0.0
    avgTransferTimeCiLow: float = 0.0
    avgTransferTimeCiHigh: float = 0.0
    seedCount: int = 1
    fallback: bool = False
    # ── 재생 뷰용 경로 + 실제 충돌 이벤트 ──
    agentTraces: Optional[List[AgentTrace]] = None
    conflictEvents: Optional[List[ConflictEvent]] = None


class PairwisePvalues(BaseModel):
    """메트릭별 알고리즘 쌍 p-value"""
    makespan: Dict[str, float] = Field(default_factory=dict)
    sumOfCosts: Dict[str, float] = Field(default_factory=dict)
    avgTransferTime: Dict[str, float] = Field(default_factory=dict)
    pathOptimality: Dict[str, float] = Field(default_factory=dict)


class SimulationComparison(BaseModel):
    # 기존 호환 필드
    transferTimeReduction: float = 0.0
    utilizationIncrease: float = 0.0
    deadlockElimination: float = 0.0
    efficiencyIncrease: float = 0.0
    throughputIncrease: float = 0.0
    # 저널 추가 필드
    pairwisePvalues: Optional[PairwisePvalues] = None


class SimulationResultResponse(BaseModel):
    runId: str
    status: str
    results: List[SimulationResultItem]
    comparison: Optional[SimulationComparison] = None
    distributions: Optional[Dict[str, Any]] = None


# ── 헬스체크 ─────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    modelLoaded: bool
    modelPath: str
    supabaseConnected: bool
    cactusLoaded: bool = False
