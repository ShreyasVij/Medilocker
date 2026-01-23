from fastapi import APIRouter, Depends
from pydantic import BaseModel
import hashlib
from ..services.logger import log_openrouter_event
from ..security.dependencies import verify_service_token
from ..pipelines.summarization_pipeline import summarize_structured_data

router = APIRouter()


class SummarizeRequest(BaseModel):
    structured_data: dict


class SummarizeResponse(BaseModel):
    summary: dict | str | None
    explanations: list[str] | None
    confidence: float | None


@router.post("/", response_model=SummarizeResponse)
async def summarize_lab(payload: SummarizeRequest, _auth=Depends(verify_service_token)):
    try:
        sd = payload.structured_data or {}
        raw_text = sd.get("raw_text") if isinstance(sd, dict) else None
        text_len = len(raw_text or "")
        sha = hashlib.sha256((raw_text or "").encode("utf-8")).hexdigest() if raw_text else "n/a"
        keys = ",".join(sorted(list(sd.keys()))) if isinstance(sd, dict) else "n/a"
        log_openrouter_event('summarize_input', f"raw_text_len={text_len} sha256={sha} keys={keys}")
    except Exception:
        pass
    result = await summarize_structured_data(payload.structured_data)
    return SummarizeResponse(**result)
