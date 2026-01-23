"""Minimal polling worker for ingestion jobs.

This avoids requiring a full queue broker. It periodically requests a job
from the web service, downloads the file via a signed URL, runs OCR, and
posts results back to complete the job.
"""
from __future__ import annotations

import os
import sys
import time
import requests
from typing import Optional
from pathlib import Path

# Add parent directory to path for absolute imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from apps.ai.services.ocr_service import extract_text
from apps.ai.pipelines.classification_pipeline import classify_text
from apps.ai.services.extraction_service import structure_text
from apps.ai.pipelines.summarization_pipeline import summarize_structured_data
from apps.ai.pipelines.title_generation_pipeline import generate_document_title
from apps.ai.services.db import collection
from apps.ai.services.storage import create_signed_url as sb_signed_url


def _load_env():
  """Load .env file from apps/ai directory"""
  env_path = Path(__file__).resolve().parent.parent / ".env"
  if env_path.exists():
    for line in env_path.read_text().splitlines():
      line = line.strip()
      if not line or line.startswith("#") or "=" not in line:
        continue
      key, value = line.split("=", 1)
      if key and key not in os.environ:
        os.environ[key] = value

_load_env()

WEB_BASE_URL = os.getenv("WEB_BASE_URL", "http://localhost:3000")
INTERNAL_TOKEN = os.getenv("INTERNAL_AUTH_TOKEN", "")


def _post_json(path: str, payload: dict) -> Optional[dict]:
  url = WEB_BASE_URL.rstrip("/") + path
  headers = {"x-internal-token": INTERNAL_TOKEN, "content-type": "application/json"}
  try:
    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    if resp.status_code != 200:
      return None
    return resp.json()
  except Exception:
    return None


def _get_bytes(url: str) -> Optional[bytes]:
  try:
    r = requests.get(url, timeout=60)
    if r.status_code == 200:
      return r.content
  except Exception:
    pass
  return None


def process_one_job() -> bool:
  data = _post_json("/api/jobs/next", {})
  job = (data or {}).get("job") if data else None
  if not job:
    return False

  job_id = job.get("id")
  payload = job.get("payload") or {}
  storage_key = payload.get("storageKey")
  signed_url = job.get("signedUrl")
  version_id = payload.get("versionId")
  document_id = payload.get("documentId")
  job_type = job.get("type")

  try:
    if job_type == "ingest":
      if not signed_url or not storage_key or not document_id or not version_id:
        # Try to generate our own signed URL via Supabase if storage_key present
        if storage_key:
          try:
            signed_url = sb_signed_url(storage_key, expires_in=300)
          except Exception:
            signed_url = None
        if not signed_url:
          _post_json("/api/jobs/complete", {"id": job_id, "status": "failed", "error": "missing fields"})
          return True
      file_name = os.path.basename(storage_key)
      content = _get_bytes(signed_url)
      if not content:
        _post_json("/api/jobs/complete", {"id": job_id, "status": "failed", "error": "download failed"})
        return True
      import asyncio
      loop_result = asyncio.run(extract_text(file_name=file_name or "file", content_bytes=content))
      text = (loop_result or {}).get("text") or ""
      engine = (loop_result or {}).get("engine") or None
      confidence = (loop_result or {}).get("confidence") or None
      if text:
        _post_json("/api/jobs/complete", {
          "id": job_id,
          "status": "completed",
          "ocrText": text,
          "engine": engine,
          "confidence": confidence,
        })
      else:
        _post_json("/api/jobs/complete", {"id": job_id, "status": "failed", "error": "ocr empty"})
    elif job_type == "classify":
      # Use OCR text from payload
      ocr_text = payload.get("ocrText") or ""
      if not ocr_text:
        _post_json("/api/jobs/complete", {"id": job_id, "status": "failed", "error": "no ocrText"})
        return True
      import asyncio
      cls = asyncio.run(classify_text(ocr_text))
      _post_json("/api/jobs/complete", {
        "id": job_id,
        "status": "completed",
        "detectedType": cls.get("detected_type"),
        "inferredTags": cls.get("inferred_tags"),
        "confidence": cls.get("confidence"),
      })
    elif job_type == "extract-structured":
      ocr_text = payload.get("ocrText") or ""
      if not ocr_text:
        _post_json("/api/jobs/complete", {"id": job_id, "status": "failed", "error": "no ocrText"})
        return True
      import asyncio
      st = asyncio.run(structure_text(ocr_text=ocr_text))
      vitals = st.get("vitals") or []
      observations = []
      for v in vitals:
        name = v.get("label") or v.get("name") or "value"
        value = v.get("value")
        unit = v.get("unit")
        if name and value is not None:
          observations.append({"name": str(name), "value": value, "unit": unit})
      # Collect document-level metadata to persist alongside observations
      doc_meta = {
        "patient_name": st.get("patient_name"),
        "dob": st.get("dob"),
        "doctor_name": st.get("doctor_name"),
        "diagnosis": st.get("diagnosis"),
        "report_date": st.get("report_date"),
        "medications": st.get("medications") or [],
      }
      _post_json("/api/jobs/complete", {
        "id": job_id,
        "status": "completed",
        "panel": st.get("panel") or "general",
        "observations": observations,
        "docMeta": doc_meta,
      })
    elif job_type == "summarize-doc":
      # Build simple doc summary from classification observations
      import asyncio
      document_id = payload.get("documentId")
      if not document_id:
        _post_json("/api/jobs/complete", {"id": job_id, "status": "failed", "error": "missing documentId"})
        return True
      # Prefer OCR-based structuring if available for richer context
      ocr_text = payload.get("ocrText") or ""
      structured = None
      if ocr_text:
        try:
          structured = asyncio.run(structure_text(ocr_text=ocr_text))
          if isinstance(structured, dict):
            structured["raw_text"] = ocr_text
        except Exception:
          structured = None
      if not structured:
        # Fallback to classification collection
        class_doc = collection("classification").find_one({"documentId": document_id}) or {}
        panel = class_doc.get("panel") or "general"
        observations = class_doc.get("observations") or []
        detected_type = class_doc.get("detectedType") or None
        structured = {
          "patient_name": "Patient",
          "diagnosis": None,
          "medications": [],
          "vitals": [
            {"label": (o.get("name") or "value"), "value": o.get("value"), "unit": o.get("unit")}
            for o in (observations or []) if o is not None
          ],
          "panel": panel,
          "classification": detected_type,
          "raw_text": ocr_text or "",
        }
      result = asyncio.run(summarize_structured_data(structured))
      _post_json("/api/jobs/complete", {
        "id": job_id,
        "status": "completed",
        "docSummary": result.get("summary"),
        "explanations": result.get("explanations"),
        "confidence": result.get("confidence"),
      })
    elif job_type == "generate-title":
      # Generate AI-powered document title from OCR text
      document_id = payload.get("documentId")
      ocr_text = payload.get("ocrText") or ""
      
      if not document_id or not ocr_text:
        _post_json("/api/jobs/complete", {"id": job_id, "status": "failed", "error": "missing documentId or ocrText"})
        return True
      
      # Get document type from classification if available
      class_doc = collection("classification").find_one({"documentId": document_id}) or {}
      doc_type = class_doc.get("detectedType") or "other"
      
      import asyncio
      result = asyncio.run(generate_document_title(
        ocr_text=ocr_text,
        doc_type=doc_type,
        metadata=payload.get("metadata")
      ))
      
      _post_json("/api/jobs/complete", {
        "id": job_id,
        "status": "completed",
        "generatedTitle": result.get("title"),
        "titleConfidence": result.get("confidence"),
      })
    elif job_type == "history-summary":
      # Construct a lightweight profile summary placeholder
      profile_id = payload.get("profileId")
      if not profile_id:
        _post_json("/api/jobs/complete", {"id": job_id, "status": "failed", "error": "missing profileId"})
        return True
      # Use Mongo to read recent documents and trend insights for the profile
      docs_cur = collection("documents").find({"profileId": profile_id}, {"id": 1, "docType": 1, "createdAt": 1}).sort("createdAt", -1).limit(20)
      docs = list(docs_cur)
      type_counts = {}
      for d in docs:
        t = (d.get("docType") or "unknown").lower()
        type_counts[t] = type_counts.get(t, 0) + 1
      trends_cur = collection("trends").find({"profileId": profile_id}, {"metricKey": 1, "analysis": 1, "lastValue": 1})
      trends = list(trends_cur)
      trend_bits = []
      for tr in trends[:5]:
        mk = tr.get("metricKey")
        an = tr.get("analysis")
        lv = tr.get("lastValue")
        if mk and an:
          trend_bits.append(f"{mk}: {an} (last {lv})")
      type_part = ", ".join([f"{k}: {v}" for k, v in sorted(type_counts.items(), key=lambda x: -x[1])]) or "no documents yet"
      trend_part = "; ".join(trend_bits) or "no trend data"
      text = f"Profile {profile_id} summary: documents by type [{type_part}]; trends [{trend_part}]."
      _post_json("/api/jobs/complete", {
        "id": job_id,
        "status": "completed",
        "historySummary": text,
        "confidence": 0.6,
      })
    else:
      _post_json("/api/jobs/complete", {"id": job_id, "status": "failed", "error": f"unknown type {job_type}"})
  except Exception as e:
    _post_json("/api/jobs/complete", {"id": job_id, "status": "failed", "error": str(e)})

  return True


def run_worker_forever(sleep_seconds: float = 2.0) -> None:
  while True:
    did = False
    try:
      did = process_one_job()
    except Exception:
      did = False
    time.sleep(0 if did else sleep_seconds)


if __name__ == "__main__":
  print("🚀 Starting MediLocker background worker...")
  print(f"   Web service: {WEB_BASE_URL}")
  print(f"   Auth configured: {'✓' if INTERNAL_TOKEN else '✗'}")
  print()
  run_worker_forever()
