from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..security.dependencies import verify_service_token
from ..pipelines.trend_pipeline import analyze_series

router = APIRouter()


class TrendPoint(BaseModel):
    timestamp: str
    value: float


class TrendsRequest(BaseModel):
    series: list[TrendPoint]


class TrendsResponse(BaseModel):
    pattern: str | None
    confidence: float | None


@router.post("/", response_model=TrendsResponse)
async def analyze_trends(payload: TrendsRequest, _auth=Depends(verify_service_token)):
    result = await analyze_series([p.dict() for p in payload.series])
    return TrendsResponse(**result)
