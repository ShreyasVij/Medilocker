"""Structured extraction using an LLM prompt over OCR text via OpenRouter.

This replaces the prior Groq integration with OpenRouter and adds model
rotation to mitigate rate limits across free models.
"""
from __future__ import annotations

import asyncio
import itertools
import json
import os
from typing import Any, Dict, Iterable
import time

import requests
import re
from datetime import datetime
from .logger import log_openrouter_key, log_openrouter_event

# OpenRouter API configuration
_openrouter_key = os.getenv("OPENROUTER_API_KEY")
_openrouter_base = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
log_openrouter_key(_openrouter_key, context='extraction_service')

# Model rotation list (free models per user request)
_MODEL_ROTATION: tuple[str, ...] = (
    "arcee-ai/trinity-mini:free",
    "liquid/lfm-2.5-1.2b-instruct:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
)

_model_cycle: Iterable[str] = itertools.cycle(_MODEL_ROTATION)


def _next_model() -> str:
    return next(_model_cycle)


def _build_prompt(ocr_text: str) -> str:
    """High-signal instruction set for converting noisy OCR medical text into strict JSON.

    Focuses the model on conservative, evidence-only extraction and gives
    clear guidance for tables, units, dates, and classification.
    """
    return (
        "You are a senior clinical documents parser. Convert the OCR text below into a STRICT JSON object.\n"
        "Requirements (follow ALL):\n"
        "1) Use ONLY information present in the text. Never invent values.\n"
        "2) Output ONLY valid JSON (no prose, no markdown, no code fences). CRITICAL: Escape all newlines in string values as \\n (not literal newlines). Use proper JSON string escaping.\n"
        "3) Always include ALL keys from the schema. If a field is not present, set it to null (not an empty string). Do NOT omit keys.\n"
        "4) Mandatory fields: 'diagnosis' and 'summary'.\n"
        "   - diagnosis: return the diagnosis exactly as written in the document; if not explicitly present, set to null. Do NOT infer or paraphrase.\n"
        "   - summary: produce a concise, plain-language explanation (2–4 sentences) of what the measurements and notes imply. Do NOT merely restate lines or copy-paste text, and do NOT output only a list of numbers. Use cautious phrasing (e.g., 'suggestive of', 'may be') and base statements strictly on the provided data. If an 'Interpretation' or 'Doctor\'s Notes' section exists, use it as the basis but rewrite concisely instead of copying.\n"
        "5) Dates: normalize to YYYY-MM-DD when possible; otherwise return the original string.\n"
        "6) Medications: extract name; if dose/frequency appear with it, include them; else set to null.\n"
        "7) Vitals/Measurements:\n"
        "   - Capture each measurement as an object: {label, value, unit|null}.\n"
        "   - For qualitative results (e.g., Negative/Positive/Normal/High/Low), put the word in 'value' and unit=null.\n"
        "   - Ignore lines labeled 'Flag' or reference tables for the value; they are not the measurement itself.\n"
        "   - Prefer the nearest numeric or qualitative token after the test label; use the unit shown on the same line when present.\n"
        "8) Classification (exact string):\n"
        "   - 'Lab Report' if it contains lab panels (CBC, BMP, Lipid, LFT, Urinalysis, Reference Range).\n"
        "   - 'Prescription' if it lists prescribed medicines with directions.\n"
        "   - 'Discharge Summary' if it reads like a discharge/summary letter.\n"
        "   - Otherwise 'Other'.\n"
        "9) Doctor mapping: any clinician title ('Physician', 'Referring Physician', 'Consultant', 'Provider') or names with 'Dr.' go into doctor_name.\n"
        "10) JSON schema with exact keys: {\n"
        "  \"patient_name\": string|null,\n"
        "  \"dob\": string|null,\n"
        "  \"doctor_name\": string|null,\n"
        "  \"diagnosis\": string|null,\n"
        "  \"report_date\": string|null,\n"
        "  \"medications\": [ { \"name\": string, \"dose\": string|null, \"frequency\": string|null } ],\n"
        "  \"vitals\": [ { \"label\": string, \"value\": string|number, \"unit\": string|null } ],\n"
        "  \"summary\": string|null,\n"
        "  \"classification\": string,\n"
        "  \"raw_text\": string\n"
        "}\n"
        "Important: Return ONE JSON object only. Do not include explanations or examples.\n\n"
        f"OCR TEXT:\n{ocr_text}"
    )


def _invoke_openrouter(ocr_text: str) -> str:
    if not _openrouter_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set; add it to apps/ai/.env")

    url = f"{_openrouter_base}/chat/completions"
    headers = {
        "Authorization": f"Bearer {_openrouter_key}",
        "Content-Type": "application/json",
    }
    # Try multiple models to avoid rate limits and transient failures
    prompt_text = _build_prompt(ocr_text)
    try:
        log_openrouter_event('extract_prompt', prompt_text[:4000])
    except Exception:
        pass

    last_error = None
    for attempt in range(min(len(_MODEL_ROTATION), 6)):
        model = _next_model()
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You convert OCR medical text into structured JSON."},
                {"role": "user", "content": prompt_text},
            ],
            "temperature": 0.1,
            "max_tokens": 800,
        }
        try:
            resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=60)
            resp.raise_for_status()
            data = resp.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "{}")
            )
            # If content is unexpectedly empty, log raw body and try next model
            if not content or not str(content).strip():
                try:
                    raw = resp.text
                    log_openrouter_event('extract_empty_content', raw[:1000])
                except Exception:
                    pass
                # Continue rotation to attempt a non-empty completion
                raise RuntimeError("empty_content")
            try:
                log_openrouter_event('extract_response', content[:4000])
                log_openrouter_event('extract_model_ok', model)
            except Exception:
                pass
            return content or "{}"
        except Exception as exc:  # pragma: no cover - defensive
            last_error = exc
            try:
                log_openrouter_event('extract_error', f"{model}: {exc}")
            except Exception:
                pass
            # brief backoff before next model
            time.sleep(0.5 + 0.25 * attempt)

    # If all models failed, return an error payload
    return json.dumps({"error": f"OpenRouter calls failed across rotation: {last_error}"})


def _safe_parse_json(text: str) -> Dict[str, Any]:
    """Parse model output into a dict, tolerating code fences and malformed JSON.

    Strategy:
    1) Try direct json.loads
    2) Try fixing common issues (code fences, escaped newlines)
    3) FALLBACK: Parse as text and extract fields with regex
    4) Return skeleton only as last resort
    """
    s = text or ""
    s = s.strip()
    
    # Remove surrounding ```json ... ``` fences if present
    if s.startswith("```"):
        try:
            s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
            s = re.sub(r"\s*```\s*$", "", s)
        except Exception:
            pass
    
    # Try 1: Direct parse
    try:
        result = json.loads(s)
        try:
            log_openrouter_event('parse_success', f"direct parse worked, has {len(result)} keys")
        except Exception:
            pass
        return result
    except Exception as e1:
        pass
    
    # Try 2: Extract JSON block
    try:
        start = s.find('{')
        end = s.rfind('}')
        if start != -1 and end != -1 and end > start:
            candidate = s[start:end+1]
            result = json.loads(candidate)
            try:
                log_openrouter_event('parse_extract', f"extracted JSON, has {len(result)} keys")
            except Exception:
                pass
            return result
    except Exception as e2:
        pass
    
    # Try 3: Manual text parsing - extract fields with regex
    try:
        log_openrouter_event('parse_text_mode', 'JSON parse failed, extracting fields as text')
        
        result = {}
        
        # Extract string fields - match "field": "value" or "field": null
        def extract_string_field(field_name):
            # Match quoted value
            pattern = rf'"{field_name}"\s*:\s*"([^"]*(?:\\"[^"]*)*)"'
            match = re.search(pattern, text, re.DOTALL)
            if match:
                # Unescape the value
                val = match.group(1).replace('\\"', '"').replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t')
                return val if val else None
            # Match null
            pattern_null = rf'"{field_name}"\s*:\s*null'
            if re.search(pattern_null, text):
                return None
            return None
        
        # Extract array fields
        def extract_array(field_name):
            pattern = rf'"{field_name}"\s*:\s*\[(.*?)\]'
            match = re.search(pattern, text, re.DOTALL)
            if match:
                array_content = match.group(1)
                # Try to parse as JSON
                try:
                    return json.loads('[' + array_content + ']')
                except:
                    # Return empty array if parsing fails
                    return []
            return []
        
        result['patient_name'] = extract_string_field('patient_name')
        result['dob'] = extract_string_field('dob')
        result['doctor_name'] = extract_string_field('doctor_name')
        result['diagnosis'] = extract_string_field('diagnosis')
        result['report_date'] = extract_string_field('report_date')
        result['summary'] = extract_string_field('summary')
        result['classification'] = extract_string_field('classification') or 'Other'
        result['raw_text'] = extract_string_field('raw_text') or text
        
        result['medications'] = extract_array('medications')
        result['vitals'] = extract_array('vitals')
        
        try:
            log_openrouter_event('parse_text_success', f"extracted {len(result)} fields, vitals={len(result.get('vitals', []))}, summary_len={len(result.get('summary') or '')}")
        except Exception:
            pass
        
        return result
    except Exception as e3:
        try:
            log_openrouter_event('parse_text_failed', f"text extraction failed: {e3}")
        except Exception:
            pass
    
    # Last resort: skeleton
    try:
        log_openrouter_event('parse_fallback', "returning skeleton")
    except Exception:
        pass
    return {
        "raw_text": text,
        "patient_name": None,
        "dob": None,
        "doctor_name": None,
        "diagnosis": None,
        "medications": [],
        "vitals": [],
        "summary": None,
        "classification": "Other"
    }


async def structure_text(*, ocr_text: str) -> Dict[str, Any]:
    # If OCR yielded nothing, avoid LLM hallucinations and return empty structure
    if not ocr_text or not ocr_text.strip():
        return {
            "patient_name": None,
            "dob": None,
            "doctor_name": None,
            "diagnosis": None,
            "medications": [],
            "vitals": [],
            "summary": None,
            "classification": "Other",
            "raw_text": ocr_text or "",
        }

    # Run the blocking HTTP call off the event loop
    llm_raw = await asyncio.to_thread(_invoke_openrouter, ocr_text)
    parsed = _safe_parse_json(llm_raw)
    # DEBUG: Log what _safe_parse_json actually returned
    try:
        has_vitals = "vitals" in parsed
        has_summary = "summary" in parsed
        vitals_type = type(parsed.get("vitals")).__name__ if has_vitals else "missing"
        summary_type = type(parsed.get("summary")).__name__ if has_summary else "missing"
        log_openrouter_event('parse_result', f"has_vitals={has_vitals} vitals_type={vitals_type} has_summary={has_summary} summary_type={summary_type}")
    except Exception:
        pass
    parsed.setdefault("raw_text", ocr_text)
    # Post-processing guard: avoid hallucinated names not present in OCR text
    lower_src = (ocr_text or "").lower()
    def _likely_present(value: str, src_lower: str) -> bool:
        v = value.lower().strip()
        if not v:
            return False
        # direct substring
        if v in src_lower:
            return True
        # token-based fuzzy match: require all significant tokens to appear
        tokens = [t for t in re.split(r"\s+", v) if len(t) > 2]
        return all(t in src_lower for t in tokens)

    # Only guard patient_name against hallucination; allow doctor_name and diagnosis to pass through
    for key in ("patient_name",):
        val = parsed.get(key)
        if isinstance(val, str) and val.strip():
            if not _likely_present(val, lower_src):
                parsed[key] = None
    # Ensure arrays have correct shapes
    meds = parsed.get("medications")
    if not isinstance(meds, list):
        parsed["medications"] = []
    vitals = parsed.get("vitals")
    if not isinstance(vitals, list):
        parsed["vitals"] = []
    # Ensure summary is at least None if not a string
    if not isinstance(parsed.get("summary"), str):
        parsed["summary"] = None

    # Lightweight regex-based fallback to fill common fields if LLM missed them
    def _extract_basic(text: str) -> Dict[str, Any]:
        lines = text.splitlines()
        joined = "\n".join(lines)

        def _match(pattern: str) -> str | None:
            m = re.search(pattern, joined, flags=re.IGNORECASE)
            if not m:
                return None
            # Prefer first capturing group if present else whole match
            if m.lastindex:
                return m.group(m.lastindex).strip()
            return m.group(0).strip()

        # Patient name (handles 'Patient: John Doe' and 'Patient Name:')
        patient = _match(r"(?:Patient(?:\s+Name)?|Name)\s*[:\-]\s*(.+)")

        # Doctor name (or 'Dr. XYZ') including 'Referring Physician' and synonyms
        doctor = _match(r"(?:Doctor\s+Name|Physician\s+Name|Referring\s+Physician|Consultant|Provider)\s*[:\-]\s*(.+)")
        if not doctor:
            dr_inline = _match(r"Dr\.?\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)")
            doctor = dr_inline

        # Diagnosis
        diagnosis = _match(r"Diagnosis\s*[:\-]\s*(.+)")

        # Date of Birth / DOB (attempt normalization to YYYY-MM-DD)
        dob_raw = _match(r"(?:Date\s+of\s+Birth|DOB)\s*[:\-]\s*(.+)")
        dob_norm: str | None = None
        if dob_raw:
            # Extract the first plausible date token from the raw line (strip trailing annotations)
            mdate = re.search(r"(\d{4}-\d{2}-\d{2}|\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})", dob_raw)
            raw = (mdate.group(1) if mdate else dob_raw).strip()
            for fmt in ("%d %b %Y", "%d %B %Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                try:
                    dt = datetime.strptime(raw, fmt)
                    dob_norm = dt.strftime("%Y-%m-%d")
                    break
                except Exception:
                    continue
            if not dob_norm:
                dob_norm = raw

        # Report date (common variants; fallback to plain 'Date:')
        report_raw = _match(r"(?:Report\s+Date|Date\s+of\s+Report|^Date)\s*[:\-]\s*(.+)")
        report_norm: str | None = None
        if report_raw:
            mdate2 = re.search(r"(\d{4}-\d{2}-\d{2}|\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})", report_raw)
            raw = (mdate2.group(1) if mdate2 else report_raw).strip()
            for fmt in ("%d %b %Y", "%d %B %Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                try:
                    dt = datetime.strptime(raw, fmt)
                    report_norm = dt.strftime("%Y-%m-%d")
                    break
                except Exception:
                    continue
            if not report_norm:
                report_norm = raw

        return {
            "patient_name": patient,
            "doctor_name": doctor,
            "diagnosis": diagnosis,
            "dob": dob_norm,
            "report_date": report_norm,
        }

    basic = _extract_basic(ocr_text)
    for k in ("patient_name", "doctor_name", "diagnosis", "dob", "report_date"):
        val = parsed.get(k)
        if val is None or (isinstance(val, str) and not val.strip()):
            if basic.get(k):
                parsed[k] = basic[k]

    # Fallback: parse common lab panels into vitals when model output is empty or missing
    def _parse_lab_vitals(text: str) -> list[dict[str, Any]]:
        """Find known test labels and capture the nearest following value and unit.

        This label-driven approach is resilient to OCR noise, misaligned columns,
        and extra 'Flag' lines.
        """
        import re
        # Map canonical labels to regexes that match possible OCR variants
        tests: dict[str, str] = {
            "Cholesterol": r"cholesterol(?!\s*hdl|\s*ldl)",
            "HDL Cholesterol": r"hdl\s+cholesterol",
            "LDL Cholesterol": r"ldl\s+cholesterol",
            "Triglycerides": r"triglycerides?",
            "ALT (SGPT)": r"alt\s*\(\s*sgpt\s*\)",
            "AST (SGOT)": r"ast\s*\(\s*sgot\s*\)",
            "Alkaline Phosphatase": r"alkaline\s+phosphatase",
            "Total Bilirubin": r"total\s+bilirubin",
            "Hemoglobin (Hb)": r"hemoglobin|\bhb\b",
            "Red Blood Cells (RBC)": r"red\s+blood\s+cells|\brbc\b",
            "White Blood Cells (WBC)": r"white\s+blood\s+cells|\bwbc\b",
            "Platelet Count": r"platelet\s+count",
            "Creatinine": r"creatinine",
            "Blood Urea Nitrogen (BUN)": r"blood\s+urea\s+nitrogen|\bBUN\b",
            "Sodium": r"sodium",
            "Potassium": r"potassium",
            "Glucose": r"glucose",
            "Protein": r"\bprotein\b",
            "Ketones": r"ketones?",
        }

        units = [
            "mg/dL", "g/dL", "U/L", "mmol/L", "thousand/μL", "million/μL", "lakh/μL",
            "thousand/ul", "million/pL", "lakh/uL", "μL", "uL", "/μL", "/uL"
        ]

        lines = text.splitlines()
        # Prebuild a lower-cased version for searching while preserving originals for slicing
        low = [ln.lower() for ln in lines]

        results: list[dict[str, Any]] = []
        for label, pat in tests.items():
            # locate first occurrence of the label
            re_label = re.compile(pat, re.I)
            idx = next((i for i, ln in enumerate(low) if re_label.search(ln)), -1)
            if idx == -1:
                continue
            # Scan forward a few lines to find a plausible value token
            value: Any = None
            unit: str | None = None
            for j in range(idx + 1, min(idx + 8, len(lines))):
                s = lines[j].strip()
                if not s or s.lower() in ("test", "result", "flag", "reference range"):
                    continue
                # Candidate value is the first numeric token or a qualitative like 'Negative'/'Positive'
                mnum = re.search(r"(?P<num>[0-9]+(?:[\.,][0-9]+)?)", s)
                if mnum:
                    token = mnum.group("num").replace(',', '.')
                    try:
                        value = float(token)
                    except Exception:
                        value = token
                    # find a unit token nearby in the same line
                    for u in units:
                        if u.lower() in s.lower():
                            unit = u
                            break
                    break
                # Qualitative
                if re.search(r"\b(negative|positive|normal|high|low)\b", s, flags=re.I):
                    value = s.split()[0].capitalize()
                    unit = None
                    break
            if value is not None:
                results.append({"label": label, "value": value, "unit": unit})
        return results

    # Only use fallback vitals parsing if AI returned NO vitals at all
    # Don't replace valid AI vitals with regex-parsed fallback
    # (Commented out to preserve AI units)
    # if not isinstance(parsed.get("vitals"), list) or len(parsed.get("vitals") or []) == 0:
    #     extracted_vitals = _parse_lab_vitals(ocr_text)
    #     if extracted_vitals:
    #         parsed["vitals"] = extracted_vitals

    # Preserve AI summary exactly as returned; don't zero it out
    # The AI is instructed to always return summary, so trust its output
    # (Removed check that was setting summary to None)

    # Classification heuristic fallback if missing or still Other
    cls = parsed.get("classification")
    if not isinstance(cls, str) or not cls.strip() or cls.strip().lower() == "other":
        low = ocr_text.lower()
        if any(w in low for w in (
            "lab report", "laboratory", "panel", "lipid panel", "liver function",
            "cholesterol", "triglycerides", "bilirubin", "urinalysis"
        )):
            parsed["classification"] = "Lab Report"
        elif any(w in low for w in ("prescription", "rx", "medications")):
            parsed["classification"] = "Prescription"
        elif "discharge" in low:
            parsed["classification"] = "Discharge Summary"
        else:
            parsed["classification"] = "Other"
    return parsed
