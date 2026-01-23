
from fastapi import APIRouter, Depends
from typing import List
from pydantic import BaseModel
from ..security.dependencies import verify_service_token
from ..pipelines.vitals_pipeline import generate_vital_explanation, generate_vital_explanations_batch

router = APIRouter()

class VitalBatchExplainRequest(BaseModel):
    vitals: List[dict]
    user_id: str | None = None

class VitalBatchExplainResponseItem(BaseModel):
    label: str
    value: str | float
    unit: str | None
    explanation: str | None = None
    advice: str | None = None

@router.post("/batch", response_model=List[VitalBatchExplainResponseItem])
async def explain_vitals_batch(payload: VitalBatchExplainRequest, _auth=Depends(verify_service_token)):
    """Generate explanations for a batch of vitals in a single OpenRouter call."""
    results = await generate_vital_explanations_batch(
        vitals=payload.vitals,
        user_id=payload.user_id
    )
    return results


class VitalExplainRequest(BaseModel):
    vital_type: str
    label: str
    value: str | float
    unit: str | None


class VitalExplainResponse(BaseModel):
    explanation: str
    status: str  # "normal", "warning", "alert"


@router.post("/", response_model=VitalExplainResponse)
async def explain_vital(payload: VitalExplainRequest, _auth=Depends(verify_service_token)):
    """Generate a 1-2 line explanation for a vital reading with health advice."""
    result = await generate_vital_explanation(
        vital_type=payload.vital_type,
        label=payload.label,
        value=payload.value,
        unit=payload.unit
    )
    return VitalExplainResponse(**result)
