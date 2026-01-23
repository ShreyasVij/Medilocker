from __future__ import annotations

import base64
from fastapi import APIRouter, Depends, HTTPException
import logging
from pydantic import BaseModel, Field

from ..security.dependencies import verify_service_token
from ..services.ocr_service import extract_text
from ..services.extraction_service import structure_text
from ..services.logger import log_openrouter_event
import hashlib
import re

router = APIRouter()
logger = logging.getLogger("ml.extract")


class ExtractRequest(BaseModel):
    file_name: str = Field(..., example="prescription.pdf")
    content_base64: str = Field(..., description="Base64-encoded file bytes")


class ExtractResponse(BaseModel):
    task_id: str
    status: str
    data: dict | None


class ExtractMultiFile(BaseModel):
    file_name: str = Field(..., example="page-1.png")
    content_base64: str = Field(..., description="Base64-encoded file bytes")


class ExtractMultiRequest(BaseModel):
    files: list[ExtractMultiFile] = Field(..., description="List of image/PDF parts to bundle")


@router.post("/", response_model=ExtractResponse)
async def extract(payload: ExtractRequest, _auth=Depends(verify_service_token)):
    try:
        content_bytes = base64.b64decode(payload.content_base64)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=400, detail="Invalid base64 payload") from exc

    # OCR step
    ocr_result = await extract_text(file_name=payload.file_name, content_bytes=content_bytes)
    try:
        log_openrouter_event('extract_ocr_output', f"file={payload.file_name} text_len={len(ocr_result.get('text') or '')} engine={ocr_result.get('engine')} conf={ocr_result.get('confidence')}")
    except Exception:
        pass

    # --- Save OCR text to ocrOutputs collection ---
    from ..services.db import collection
    import datetime
    # Attempt to parse documentId and versionId from file_name (if encoded)
    # You may want to adjust this logic to match your actual file naming/versioning scheme
    document_id = None
    version_id = None
    storage_key = payload.file_name
    # Example: if file_name is "<documentId>-<versionId>.pdf" or similar
    import re
    m = re.match(r"([\w-]+)[-_]([\w\d]+)\.", payload.file_name)
    if m:
        document_id = m.group(1)
        version_id = m.group(2)
    # Fallback: use file_name as document_id if nothing else
    if not document_id:
        document_id = payload.file_name
    if not version_id:
        version_id = "v1"
    
    # Prepare OCR document with proper type handling
    ocr_doc = {
        "id": f"{document_id}:{version_id}",
        "documentId": document_id,
        "versionId": version_id,
        "storageKey": storage_key,
        "text": ocr_result.get("text") or "",
        "createdAt": datetime.datetime.utcnow(),
    }
    
    # Add optional fields only if they exist and are not None
    if ocr_result.get("engine"):
        ocr_doc["engine"] = str(ocr_result.get("engine"))
    if ocr_result.get("confidence") is not None:
        # Ensure confidence is a float/number
        try:
            ocr_doc["confidence"] = float(ocr_result.get("confidence"))
        except (ValueError, TypeError):
            pass  # Skip if can't convert to float
    
    try:
        collection("ocrOutputs").update_one({"id": ocr_doc["id"]}, {"$set": ocr_doc}, upsert=True)
    except Exception as e:
        logger.error(f"Failed to upsert OCR output: {e}")
        # Log the document structure for debugging
        logger.error(f"OCR document structure: {ocr_doc}")

    # Structure via LLM (or fallback when no text)
    structured = await structure_text(ocr_text=ocr_result.get("text") or "")
    
    # Debug: log what structure_text returned
    try:
        summ_val = structured.get("summary")
        vitals_val = structured.get("vitals")
        log_openrouter_event('extract_structured_debug', f"summary_type={type(summ_val).__name__} summary_len={len(summ_val) if isinstance(summ_val, str) else 0} vitals_count={len(vitals_val) if isinstance(vitals_val, list) else 0}")
    except Exception:
        pass

    # Normalize: convert empty strings to null, ensure arrays/objects have expected shapes
    def _norm(value):
        if isinstance(value, str):
            return value if value.strip() else None
        if isinstance(value, list):
            return [_norm(v) for v in value]
        if isinstance(value, dict):
            return {k: _norm(v) for k, v in value.items()}
        return value

    # Field-casing and synonym normalization (models sometimes vary casing)
    def pick(*keys: str):
        for k in keys:
            v = structured.get(k)
            if v is not None and (not isinstance(v, str) or v.strip()):
                return v
        return None

    # Pass through model-provided vitals as-is (no unit normalization or splitting)
    vitals_src = structured.get("vitals") or []
    vitals_norm = []
    if isinstance(vitals_src, list):
        for it in vitals_src:
            if not isinstance(it, dict):
                continue
            # Preserve units exactly as returned by AI; only normalize label
            raw_unit = it.get("unit") if it.get("unit") is not None else it.get("units")
            vitals_norm.append({
                "label": _norm(it.get("label") or it.get("name")),
                "value": it.get("value"),
                "unit": raw_unit,  # Pass through verbatim; do not call _norm on units
            })

    normalized = {
        "patient_name": _norm(pick("patient_name", "patientName", "name")),
        "dob": _norm(pick("dob", "date_of_birth", "dateOfBirth")),
        "report_date": _norm(pick("report_date", "reportDate", "date")),
        "doctor_name": _norm(pick("doctor_name", "doctorName", "doctor", "doctorFullName", "physician", "physician_name", "referring_physician", "provider")),
        "diagnosis": _norm(pick("diagnosis", "impression", "interpretation")),
        "medications": _norm(structured.get("medications") or []),
        "vitals": vitals_norm or [],  # Already normalized above; don't re-normalize
        # Accept common synonyms for summary to avoid dropping valid content
        "summary": pick("summary", "in_depth_summary", "summary_text", "explanation"),  # Don't _norm summary; preserve verbatim
        "classification": structured.get("classification") or "Other",
        "raw_text": structured.get("raw_text") or "",
    }

    # Fallback: derive doctor name from raw_text if still missing
    if not normalized.get("doctor_name") and isinstance(normalized.get("raw_text"), str):
        raw = normalized.get("raw_text") or ""
        doc = None
        # Dr. First Last pattern
        m = re.search(r"Dr\.?\s+([A-Z][A-Za-z\.]+(?:\s+[A-Z][A-Za-z\.]+)*)", raw)
        if m:
            doc = m.group(0)
        else:
            # First Last, Degree (M.D., MD, MBBS, D.O., DO, DM, MCh, FRCS, MRCP)
            m2 = re.search(r"([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\s*,\s*(M\.?D\.?|MBBS|M\.B\.B\.S\.|D\.?O\.?|DO|DM|MCh|FRCS|MRCP)\b", raw)
            if m2:
                doc = f"{m2.group(1)}, {m2.group(2)}"
            else:
                # Name preceding specialty line
                m3 = re.search(r"\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\b\s*\n\s*(Internal Medicine|Cardiology|Neurology|Oncology|Pediatrics)", raw)
                if m3:
                    doc = m3.group(1)
        if doc:
            normalized["doctor_name"] = doc

    # Emit an operations log line to the OpenRouter log for observability
    try:
        rt = normalized.get("raw_text", "") or ""
        sha = hashlib.sha256(rt.encode("utf-8")).hexdigest() if rt else "n/a"
        diag_present = 1 if (normalized.get('diagnosis') or '') else 0
        summ_len = len(normalized.get('summary') or '')
        vitals_list = normalized.get('vitals') or []
        with_unit = [v for v in vitals_list if isinstance(v, dict) and (v.get('unit') or '')]
        missing_units = [str(v.get('label') or '') for v in vitals_list if isinstance(v, dict) and not (v.get('unit') or '')]
        log_openrouter_event('extract_result', f"raw_text_len={len(rt)} sha256={sha} patient={normalized.get('patient_name')} cls={normalized.get('classification')} diag={diag_present} summary_len={summ_len} vitals_with_unit={len(with_unit)} missing_units={','.join(missing_units) if missing_units else 'none'} doctor={normalized.get('doctor_name') or 'none'}")
    except Exception:
        pass

    try:
        logger.info(
            "extract done: len=%s patient=%s doctor=%s dob=%s cls=%s",
            len(normalized.get("raw_text", "")),
            normalized.get("patient_name"),
            normalized.get("doctor_name"),
            normalized.get("dob"),
            normalized.get("classification"),
        )
    except Exception:
        pass

    # In a real system you would enqueue and return a task id; here we respond synchronously.
    return ExtractResponse(task_id="stub-task", status="completed", data=normalized)


@router.post("/multi", response_model=ExtractResponse)
async def extract_multi(payload: ExtractMultiRequest, _auth=Depends(verify_service_token)):
    # OCR each file and concatenate text with page separators
    texts: list[str] = []
    for idx, f in enumerate(payload.files):
        try:
            content_bytes = base64.b64decode(f.content_base64)
        except Exception as exc:  # pragma: no cover - defensive
            raise HTTPException(status_code=400, detail="Invalid base64 payload") from exc
        ocr_result = await extract_text(file_name=f.file_name, content_bytes=content_bytes)
        try:
            log_openrouter_event('extract_ocr_output', f"file={f.file_name} text_len={len(ocr_result.get('text') or '')} engine={ocr_result.get('engine')} conf={ocr_result.get('confidence')}")
        except Exception:
            pass
        page_header = f"\n\n=== Page {idx + 1}: {f.file_name} ===\n\n"
        texts.append(page_header + (ocr_result.get("text") or ""))

    combined_text = "".join(texts)

    # Structure combined text
    structured = await structure_text(ocr_text=combined_text)

    def _norm(value):
        if isinstance(value, str):
            return value if value.strip() else None
        if isinstance(value, list):
            return [_norm(v) for v in value]
        if isinstance(value, dict):
            return {k: _norm(v) for k, v in value.items()}
        return value

    def pick(*keys: str):
        for k in keys:
            v = structured.get(k)
            if v is not None and (not isinstance(v, str) or v.strip()):
                return v
        return None

    vitals_src = structured.get("vitals") or []
    vitals_norm = []
    if isinstance(vitals_src, list):
        for it in vitals_src:
            if not isinstance(it, dict):
                continue
            # Preserve units exactly as returned by AI; only normalize label
            raw_unit = it.get("unit") if it.get("unit") is not None else it.get("units")
            vitals_norm.append({
                "label": _norm(it.get("label") or it.get("name")),
                "value": it.get("value"),
                "unit": raw_unit,  # Pass through verbatim; do not call _norm on units
            })

    normalized = {
        "patient_name": _norm(pick("patient_name", "patientName", "name")),
        "dob": _norm(pick("dob", "date_of_birth", "dateOfBirth")),
        "report_date": _norm(pick("report_date", "reportDate", "date")),
        "doctor_name": _norm(pick("doctor_name", "doctorName", "doctor", "doctorFullName", "physician", "physician_name", "referring_physician", "provider")),
        "diagnosis": _norm(pick("diagnosis", "impression", "interpretation")),
        "medications": _norm(structured.get("medications") or []),
        "vitals": vitals_norm or [],  # Already normalized above; don't re-normalize
        # Accept common synonyms for summary to avoid dropping valid content
        "summary": pick("summary", "in_depth_summary", "summary_text", "explanation"),  # Don't _norm summary; preserve verbatim
        "classification": structured.get("classification") or "Other",
        "raw_text": combined_text,
    }

    # Fallback doctor from combined text if missing
    if not normalized.get("doctor_name") and isinstance(normalized.get("raw_text"), str):
        raw = normalized.get("raw_text") or ""
        doc = None
        m = re.search(r"Dr\.?\s+([A-Z][A-Za-z\.]+(?:\s+[A-Z][A-Za=z\.]+)*)", raw)
        if m:
            doc = m.group(0)
        else:
            m2 = re.search(r"([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za=z]+){0,3})\s*,\s*(M\.?D\.?|MBBS|M\.B\.B\.S\.|D\.?O\.?|DO|DM|MCh|FRCS|MRCP)\b", raw)
            if m2:
                doc = f"{m2.group(1)}, {m2.group(2)}"
            else:
                m3 = re.search(r"\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za=z]+){0,3})\b\s*\n\s*(Internal Medicine|Cardiology|Neurology|Oncology|Pediatrics)", raw)
                if m3:
                    doc = m3.group(1)
        if doc:
            normalized["doctor_name"] = doc

    try:
        rt = normalized.get("raw_text", "") or ""
        sha = hashlib.sha256(rt.encode("utf-8")).hexdigest() if rt else "n/a"
        diag_present = 1 if (normalized.get('diagnosis') or '') else 0
        summ_len = len(normalized.get('summary') or '')
        vitals_list = normalized.get('vitals') or []
        with_unit = [v for v in vitals_list if isinstance(v, dict) and (v.get('unit') or '')]
        missing_units = [str(v.get('label') or '') for v in vitals_list if isinstance(v, dict) and not (v.get('unit') or '')]
        log_openrouter_event('extract_result_multi', f"raw_text_len={len(rt)} sha256={sha} patient={normalized.get('patient_name')} cls={normalized.get('classification')} diag={diag_present} summary_len={summ_len} vitals_with_unit={len(with_unit)} missing_units={','.join(missing_units) if missing_units else 'none'} doctor={normalized.get('doctor_name') or 'none'}")
    except Exception:
        pass

    return ExtractResponse(task_id="stub-task", status="completed", data=normalized)
