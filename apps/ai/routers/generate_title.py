from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..security.dependencies import verify_service_token
from ..pipelines.title_generation_pipeline import generate_document_title

router = APIRouter()


class GenerateTitleRequest(BaseModel):
    ocr_text: str
    doc_type: str
    metadata: dict | None = None


class GenerateTitleResponse(BaseModel):
    title: str
    confidence: float


@router.post("/", response_model=GenerateTitleResponse)
async def generate_title(payload: GenerateTitleRequest, _auth=Depends(verify_service_token)):
    """
    Generate a smart, descriptive title for a medical document based on OCR text.
    Examples:
    - "Complete Blood Count (CBC) - Jan 2026"
    - "Liver Function Test - Abnormal Results"
    - "Chest X-Ray - Follow-up Required"
    """
    result = await generate_document_title(
        ocr_text=payload.ocr_text,
        doc_type=payload.doc_type,
        metadata=payload.metadata
    )
    return GenerateTitleResponse(**result)
