"""
PPO 경로 추론 엔드포인트
POST /api/inference

프론트엔드 ai-route-view.tsx의 AiRouteStep 인터페이스에 맞춰 응답
"""
import time
import logging
from fastapi import APIRouter, HTTPException
from models.schemas import InferenceRequest, InferenceResponse, AiRouteStep

router = APIRouter(prefix="/api", tags=["inference"])
logger = logging.getLogger(__name__)


@router.post("/inference", response_model=InferenceResponse)
async def run_inference(req: InferenceRequest) -> InferenceResponse:
    """
    PPO 경로 추론 (모델 미존재 시 A* 폴백)

    요청: { layoutId, sourceUnitId, destUnitId, dynamicWeights? }
    응답: { route: AiRouteStep[], totalCost, confidence, inferenceTimeMs, fallback }
    """
    from services.graph_loader import load_graph
    from engine.ppo_agent import ppo_agent

    if not req.layoutId or not req.sourceUnitId or not req.destUnitId:
        raise HTTPException(status_code=400, detail="layoutId, sourceUnitId, destUnitId 필수")

    try:
        # 1. 그래프 로드
        graph, unit_labels = load_graph(req.layoutId)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"그래프 로드 실패: {e}")
        raise HTTPException(status_code=500, detail=f"그래프 로드 실패: {e}")

    # 2. 라벨 → UUID 변환 (unit_labels: {uuid: label})
    label_to_uuid = {v: k for k, v in unit_labels.items()}
    source_uuid = label_to_uuid.get(req.sourceUnitId, req.sourceUnitId)
    dest_uuid = label_to_uuid.get(req.destUnitId, req.destUnitId)

    if source_uuid not in label_to_uuid.values():
        raise HTTPException(status_code=404, detail=f"출발 노드 없음: {req.sourceUnitId}")
    if dest_uuid not in label_to_uuid.values():
        raise HTTPException(status_code=404, detail=f"도착 노드 없음: {req.destUnitId}")

    # 3. dynamicWeights 키 변환: 프론트는 라벨(ND-025) 기반 전달 → UUID로 변환
    raw_dw = req.dynamicWeights or {}
    dynamic_weights_uuid: dict[str, float] = {}
    for key, factor in raw_dw.items():
        # 키가 이미 UUID이면 그대로, 라벨이면 변환
        uuid_key = label_to_uuid.get(key, key)
        dynamic_weights_uuid[uuid_key] = float(factor)

    # 4. PPO 추론 (폴백 포함)
    start_ts = time.time()
    try:
        path_uuids, total_cost, confidence = ppo_agent.predict(
            graph=graph,
            source_id=source_uuid,
            dest_id=dest_uuid,
            unit_labels=unit_labels,
            dynamic_weights=dynamic_weights_uuid if dynamic_weights_uuid else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"추론 실패: {e}")
        raise HTTPException(status_code=500, detail=f"추론 실패: {e}")

    inference_time_ms = (time.time() - start_ts) * 1000
    is_fallback = not ppo_agent.is_loaded

    # 5. 응답 구성 (AiRouteStep 배열) — UUID 키로 변환된 맵 사용
    route_steps: list[AiRouteStep] = []

    for i, uid in enumerate(path_uuids):
        label = unit_labels.get(uid, uid)
        congestion = dynamic_weights_uuid.get(uid, 0.0)

        # 구간 가중치 계산 (이전 노드와의 엣지 weight)
        edge_weight = 1.0
        if i > 0:
            prev_uid = path_uuids[i - 1]
            if graph.has_edge(prev_uid, uid):
                edge_weight = graph[prev_uid][uid].get("weight", 1.0)

        # 예측 소요 시간 (ms): 거리 / 속도 * 혼잡 보정
        predicted_time_ms = (edge_weight / max(0.3, 0.001)) * 1000 * (1.0 + congestion * 0.5)

        # 동적 가중치: 혼잡도 기반 정규화 (0~1)
        dynamic_weight = max(0.0, min(1.0, 1.0 - congestion))

        route_steps.append(AiRouteStep(
            unitId=uid,
            unitLabel=label,
            weight=round(dynamic_weight, 3),
            congestionFactor=round(congestion, 3),
            predictedTimeMs=round(predicted_time_ms, 1),
        ))

    return InferenceResponse(
        route=route_steps,
        totalCost=round(total_cost, 3),
        confidence=round(confidence, 3),
        inferenceTimeMs=round(inference_time_ms, 1),
        fallback=is_fallback,
    )
