"""
FastAPI AI 엔진 서버 진입점
MCS 플랫폼 PPO 경로 추론 + SimPy 시뮬레이션 서버

실행:
    uvicorn main:app --reload --port 8000
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers.health import router as health_router
from routers.inference import router as inference_router
from routers.simulation import router as simulation_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작/종료 시 실행 (모델 프리로드)"""
    logger.info("AI 엔진 서버 시작")

    # PPO 모델 로딩 시도 (없으면 A* 폴백 모드)
    from engine.ppo_agent import ppo_agent
    loaded = ppo_agent.load(settings.model_path)
    if loaded:
        logger.info(f"PPO 모델 로딩 완료: {settings.model_path}")
    else:
        logger.warning("PPO 모델 없음 — A* 폴백 모드로 동작")

    yield  # 서버 실행 중

    logger.info("AI 엔진 서버 종료")


app = FastAPI(
    title="MCS AI 엔진",
    description="PPO 경로 추론 + SimPy 시뮬레이션 서버",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 설정 (Next.js → FastAPI 크로스 오리진 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(health_router)
app.include_router(inference_router)
app.include_router(simulation_router)


@app.get("/")
async def root():
    return {"message": "MCS AI 엔진 서버 동작 중"}
