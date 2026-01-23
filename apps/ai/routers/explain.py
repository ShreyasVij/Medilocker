from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..security.dependencies import verify_service_token
from ..pipelines.explain_pipeline import explain_model_output

router = APIRouter()


class ExplainRequest(BaseModel):
    model_output: dict


class ExplainResponse(BaseModel):
    rationale: list[str] | None
    confidence: float | None


@router.post("/", response_model=ExplainResponse)
async def explain_output(payload: ExplainRequest, _auth=Depends(verify_service_token)):
    result = await explain_model_output(payload.model_output)
    return ExplainResponse(**result)
