"""
FastAPI 요청/응답 Pydantic 스키마
프론트엔드 TypeScript 타입과 1:1 대응
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


# ── 추론 요청/응답 ────────────────────────────────────────────────

class InferenceRequest(BaseModel):
    layoutId: str
    sourceUnitId: str
    destUnitId: str
    # 동적 가중치: unitId → 혼잡도 팩터 (0.0~1.0)
    dynamicWeights: Optional[Dict[str, float]] = None


class AiRouteStep(BaseModel):
    """프론트엔드 ai-route-view.tsx의 AiRouteStep 인터페이스와 1:1 대응"""
    unitId: str
    unitLabel: str
    weight: float           # 동적 가중치 (0~1)
    congestionFactor: float # 혼잡도 팩터 (0~1)
    predictedTimeMs: float  # 예측 소요 시간 (ms)


class InferenceResponse(BaseModel):
    route: List[AiRouteStep]
    totalCost: float
    confidence: float       # 0~1 (PPO 신뢰도, 폴백 시 0.0)
    inferenceTimeMs: float
    fallback: bool = False  # 모델 미존재 시 A* 폴백 여부


# ── 시뮬레이션 요청/응답 ──────────────────────────────────────────

class ScenarioParams(BaseModel):
    layoutId: str
    carrierCount: int = Field(default=5, ge=1)
    transferRequestCount: int = Field(default=20, ge=1)
    simulationDuration: float = Field(default=300.0, gt=0)  # 초 단위


class SimulationRunRequest(BaseModel):
    scenarioParams: ScenarioParams
    algorithms: List[str] = Field(default=["astar", "ai_ppo"])


class SimulationRunResponse(BaseModel):
    runId: str
    status: str


class SimulationStatusResponse(BaseModel):
    runId: str
    status: str     # Pending | Running | Completed | Failed
    progress: int   # 0~100


class SimulationResultItem(BaseModel):
    algorithm: str
    avgTransferTime: float
    throughput: float
    collisionCount: int
    loadBalanceStd: float
    equipmentUtilization: float
    deadlockCount: int
    routeEfficiencyScore: float


class TransferTimeDistributionItem(BaseModel):
    range: str
    astar: int
    ai_ppo: int


class EquipmentUtilizationItem(BaseModel):
    equipment: str
    astar: float
    ai_ppo: float


class SimulationComparison(BaseModel):
    transferTimeReduction: float    # % (AI가 A*보다 더 빠른 비율)
    utilizationIncrease: float      # %
    deadlockElimination: float      # % (0이면 0%, 모두 제거하면 100%)
    efficiencyIncrease: float       # %
    throughputIncrease: float       # %


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
