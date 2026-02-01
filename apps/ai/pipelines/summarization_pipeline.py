from __future__ import annotations

import json
import os
from typing import Dict, Any, List
from apps.ai.services.logger import log_openrouter_key, log_openrouter_event
import itertools
import time

import requests

# OpenRouter configuration - loaded lazily to allow .env to load first
def _get_openrouter_key() -> str | None:
    """Get OpenRouter API key from environment."""
    return os.getenv("OPENROUTER_API_KEY")

_openrouter_base = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

# Rotate across multiple free models to avoid rate limiting
_MODEL_ROTATION: tuple[str, ...] = (
  "arcee-ai/trinity-mini:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
)
_model_cycle = itertools.cycle(_MODEL_ROTATION)
def _next_model() -> str:
  return next(_model_cycle)


def _build_prompt(sd: Dict[str, Any]) -> str:
  """Compose a clinician-grade summary prompt that returns STRICT JSON.

  Act as a careful real-life doctor reviewing this report. Apply
  evidence-based clinical reasoning: identify abnormal values, relate
  them to symptoms/notes, and suggest safe next steps. Use only the
  provided information; do not invent facts or diagnoses. Do not merely
  list numbers — explain what they mean for the patient in plain, non-
  alarming language while keeping clinical accuracy.

  The model must output a single valid JSON object with keys:
  - disclaimer: string
  - in_depth_summary: string
  - key_findings: array of strings
  - recommendations: array of strings
  - possible_follow_ups: array of strings
  - lifestyle_advice: array of strings (may be empty)

  Rules:
  - Output ONLY JSON (no prose/markdown/fences).
  - If patient/doctor/dates are missing, do not invent; omit from text.
  - Mention units and reference ranges only when present in text.
  - Highlight clearly abnormal values (only if the text/ranges explicitly mark them);
    avoid asserting a diagnosis; use cautious phrasing ("suggestive of", "may be").
  - The in_depth_summary must be 3–6 sentences that explain, in plain language,
    what the numbers imply for health risk or follow‑up, avoiding fear‑mongering.
  - Key findings should not be raw values alone — each item must include a brief
    interpretation (e.g., "LDL is elevated in the context provided").
  - Keep total output under ~500 words combined.
  """
  name = sd.get('patient_name') or 'Patient'
  diagnosis = sd.get('diagnosis') or None
  meds = sd.get('medications') or []
  vitals = sd.get('vitals') or []
  raw_text = sd.get('raw_text') or ''

  def _safe(s: Any) -> str:
    try:
      return json.dumps(s, ensure_ascii=False)
    except Exception:
      return str(s)

  schema_note = (
    "Output FORMAT: Return ONLY a valid JSON object, no prose, no markdown, "
    "no code fences. Keys must be exactly: disclaimer, in_depth_summary, "
    "key_findings, recommendations, possible_follow_ups, lifestyle_advice. "
    "All arrays should contain short, readable bullet strings."
  )

  constraints = (
    "Constraints: Do NOT assert diagnoses; if unknown, state that. "
    "Base statements solely on provided data. Use cautious language. "
    "Mention lab units and ranges only if present; otherwise say 'range not provided'. "
    "Relate symptoms/notes to objectively abnormal findings when possible. "
    "Do not output only numbers — always add what they mean in context."
  )

  return (
    f"You are a careful clinical assistant. {constraints}\n\n"
    f"{schema_note}\n\n"
    f"Structured data (verbatim JSON fragments): name={_safe(name)}, diagnosis={_safe(diagnosis)}, "
    f"medications={_safe(meds)}, vitals={_safe(vitals)}.\n\n"
    "Full OCR text (verbatim, paraphrase and extract details responsibly):\n"
    "<<<BEGIN_OCR>>>\n"
    f"{raw_text}\n"
    "<<<END_OCR>>>\n"
  )


def _invoke_openrouter(prompt: str) -> str:
  openrouter_key = _get_openrouter_key()
  
  # Log key presence on first use (without printing the key value)
  log_openrouter_key(openrouter_key, context='summarization_pipeline')
  
  if not openrouter_key:
    # Fallback minimal summary to keep pipeline running without a key
    return (
      "### Disclaimer\n"
      "This content is informational only. For proper follow-ups, contact a licensed medical practitioner.\n\n"
      "### In-Depth Summary\n"
      "Insufficient model configuration. A brief summary cannot be generated.\n"
    )

  url = f"{_openrouter_base}/chat/completions"
  headers = {
    "Authorization": f"Bearer {openrouter_key}",
    "Content-Type": "application/json",
  }
  try:
    log_openrouter_event('summarize_prompt', prompt[:4000])
  except Exception:
    pass

  last_error = None
  for attempt in range(min(len(_MODEL_ROTATION), 5)):
    model = _next_model()
    payload = {
      "model": model,
      "messages": [
        {"role": "system", "content": "You produce careful, structured medical summaries."},
        {"role": "user", "content": prompt},
      ],
      "temperature": 0.2,
      "max_tokens": 900,
    }
    try:
      resp = requests.post(url, headers=headers, json=payload, timeout=60)
      resp.raise_for_status()
      data = resp.json()
      content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
      ) or ""
      if not content.strip():
        log_openrouter_event('summarize_empty_content', f"model={model}")
        raise RuntimeError('empty_content')
      log_openrouter_event('summarize_call_ok', f"model={model} len={len(content)}")
      try:
        log_openrouter_event('summarize_response', content[:4000])
      except Exception:
        pass
      return content
    except Exception as exc:
      last_error = exc
      log_openrouter_event('summarize_call_error', f"model={model} err={exc}")
      time.sleep(0.5 + 0.25 * attempt)
  return ""


async def summarize_structured_data(structured_data: Dict[str, Any]) -> Dict[str, Any]:
  def _parse_json_safe(text: str) -> Dict[str, Any]:
    try:
      # Try direct parse first
      return json.loads(text)
    except Exception:
      # Attempt to locate the first JSON object in the text
      start = text.find('{')
      end = text.rfind('}')
      if start != -1 and end != -1 and end > start:
        try:
          return json.loads(text[start:end+1])
        except Exception:
          pass
    return {}

  prompt = _build_prompt(structured_data)
  content = _invoke_openrouter(prompt)
  if not content:
    log_openrouter_event('summarize_empty', 'no_content_from_model')

  data = _parse_json_safe(content)
  if not data or not isinstance(data, dict):
    # Fallback: wrap raw text into structured shape
    data = {
      "disclaimer": "This content is informational only. For proper follow-ups, contact a licensed medical practitioner.",
      "in_depth_summary": content or ("No model summary returned. Review findings and vitals listed in the report."),
      "key_findings": [],
      "recommendations": [],
      "possible_follow_ups": [],
      "lifestyle_advice": [],
    }

  # Minimal sanitization: ensure arrays/strings are in expected types
  def as_str(x: Any) -> str:
    return x if isinstance(x, str) else ("" if x is None else str(x))
  def as_list_str(x: Any) -> List[str]:
    if isinstance(x, list):
      return [as_str(i).strip() for i in x if as_str(i).strip()]
    if isinstance(x, str) and x.strip():
      return [x.strip()]
    return []

  normalized = {
    "disclaimer": as_str(data.get("disclaimer")) or "This content is informational only. For proper follow-ups, contact a licensed medical practitioner.",
    "in_depth_summary": as_str(data.get("in_depth_summary")) or "A summary was not provided by the model; please review the measurements and clinical notes.",
    "key_findings": as_list_str(data.get("key_findings")),
    "recommendations": as_list_str(data.get("recommendations")),
    "possible_follow_ups": as_list_str(data.get("possible_follow_ups")),
    "lifestyle_advice": as_list_str(data.get("lifestyle_advice")),
  }

  try:
    log_openrouter_event(
      'summarize_normalized_metrics',
      f"in_depth_len={len(normalized['in_depth_summary'])} key_findings={len(normalized['key_findings'])} recs={len(normalized['recommendations'])}"
    )
  except Exception:
    pass

  return {
    "summary": normalized,
    "explanations": [normalized["disclaimer"]],
    "confidence": 0.7,
  }
