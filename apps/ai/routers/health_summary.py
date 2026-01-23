
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..security.dependencies import verify_service_token
from ..pipelines.health_summary_pipeline import generate_comprehensive_health_summary
import logging

router = APIRouter()

logger = logging.getLogger("health_summary_router")

class HealthSummaryRequest(BaseModel):
    ocr_texts: list[str]
    document_count: int

class HealthSummarySection(BaseModel):
    heading: str
    content: str

class HealthSummaryResponse(BaseModel):
    summary: str
    sections: list[HealthSummarySection]

@router.post("/", response_model=HealthSummaryResponse)
async def generate_health_summary(payload: HealthSummaryRequest, _auth=Depends(verify_service_token)):
    """Generate comprehensive health summary from all user documents."""
    logger.info(f"[HEALTH_SUMMARY] Received request: document_count={payload.document_count}, ocr_texts_count={len(payload.ocr_texts)}")
    if payload.ocr_texts:
        logger.info(f"[HEALTH_SUMMARY] First OCR text sample (truncated): {payload.ocr_texts[0][:200]}...")
    else:
        logger.warning("[HEALTH_SUMMARY] No OCR texts provided in payload!")
    try:
        result = await generate_comprehensive_health_summary(
            ocr_texts=payload.ocr_texts,
            document_count=payload.document_count
        )
        logger.info(f"[HEALTH_SUMMARY] Summary generated. Length: {len(result.get('summary',''))}, Sections: {len(result.get('sections',[]))}")
        if result.get('summary'):
            logger.debug(f"[HEALTH_SUMMARY] Summary preview: {result['summary'][:300]}...")
        return HealthSummaryResponse(**result)
    except Exception as e:
        logger.error(f"[HEALTH_SUMMARY] Exception during summary generation: {e}")
        raise
