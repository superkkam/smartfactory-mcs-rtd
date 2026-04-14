"""
헬스체크 엔드포인트
GET /api/health — 서버 상태, PPO 모델 로딩 여부, Supabase 연결 확인
"""
from fastapi import APIRouter
from models.schemas import HealthResponse
from config import settings

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """서버 및 의존성 상태 확인"""
    from engine.ppo_agent import ppo_agent
    from services.supabase_client import check_connection

    supabase_ok = check_connection()

    return HealthResponse(
        status="ok",
        modelLoaded=ppo_agent.is_loaded,
        modelPath=ppo_agent.model_path or settings.model_path,
        supabaseConnected=supabase_ok,
    )
