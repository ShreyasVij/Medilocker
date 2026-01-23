from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..security.dependencies import verify_service_token
from ..pipelines.classification_pipeline import classify_text

router = APIRouter()


class ClassifyRequest(BaseModel):
    text: str


class ClassifyResponse(BaseModel):
    detected_type: str | None
    inferred_tags: list[str] | None
    confidence: float | None


@router.post("/", response_model=ClassifyResponse)
async def classify_document(payload: ClassifyRequest, _auth=Depends(verify_service_token)):
    result = await classify_text(payload.text)
    return ClassifyResponse(**result)
