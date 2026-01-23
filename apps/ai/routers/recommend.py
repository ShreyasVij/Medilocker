from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..security.dependencies import verify_service_token
from ..pipelines.recommendation_pipeline import generate_guidance

router = APIRouter()


class RecommendRequest(BaseModel):
    signals: dict


class Recommendation(BaseModel):
    message: str | None
    label: str | None
    confidence: float | None


class RecommendResponse(BaseModel):
    recommendations: list[Recommendation] | None


@router.post("/", response_model=RecommendResponse)
async def generate_recommendations(payload: RecommendRequest, _auth=Depends(verify_service_token)):
    result = await generate_guidance(payload.signals)
    return RecommendResponse(**result)
