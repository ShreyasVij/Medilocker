from __future__ import annotations
import asyncio
async def generate_vital_explanations_batch(
    vitals: list[dict],
    user_id: str | None = None
) -> list[dict]:
    """Generate AI explanations for a batch of vitals in a single OpenRouter call."""
    import uuid
    session_id = str(uuid.uuid4())
    
    openrouter_key = _get_openrouter_key()
    if not openrouter_key:
        _log_vitals_event(
            "NO_API_KEY_BATCH",
            f"Session: {session_id}\nUser: {user_id}\nVitals: {json.dumps(vitals)[:1000]}"
        )
        # Return fallback explanations
        return [
            {
                "label": v.get("label"),
                "value": v.get("value"),
                "unit": v.get("unit"),
                "explanation": f"{v.get('label')}: {v.get('value')}{' ' + v.get('unit') if v.get('unit') else ''}. Consult your healthcare provider for interpretation.",
                "advice": "No advice available."
            }
            for v in vitals
        ]
    # Build batch prompt (same as frontend)
    prompt = (
        "You are a medical AI assistant. For each vital sign or lab value below, club together any synonymous or duplicate values (e.g., 'Red Blood Cell', 'RBC', 'Erythrocyte' should be one entry). "
        "Generate two concise lines:\n1. What this value means for the user's health (contextualized to the value).\n2. One actionable tip or advice to improve or maintain this value, it should not be seek doctors advice\n\n"
        "Return the output as a JSON array, with each item containing:\n- 'label': the vital name,\n- 'value': the measured value,\n- 'unit': the unit,\n- 'explanation': one line about what it means,\n- 'advice': one line about how to improve or maintain it.\n\nInput:\n"
        + json.dumps(vitals)
    )
    _log_vitals_event(
        "BATCH_PROMPT_FULL",
        f"Session: {session_id}\nUser: {user_id}\nFull Prompt:\n{prompt}"
    )
    url = f"{_openrouter_base}/chat/completions"
    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": _MODEL,
        "messages": [
            {"role": "system", "content": "You are a concise medical advisor providing brief, actionable health insights."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 1200,
    }
    try:
        _log_vitals_event(
            "BATCH_REQUEST_PAYLOAD",
            f"Session: {session_id}\nUser: {user_id}\nPayload: {json.dumps(payload)[:1000]}{'... [truncated]' if len(json.dumps(payload)) > 1000 else ''}"
        )
        # Use httpx for async
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json=payload, timeout=60)
            status = resp.status_code
            _log_vitals_event(
                "BATCH_OPENROUTER_RESPONSE",
                f"Session: {session_id}\nUser: {user_id}\nStatus: {status}\nResponse: {resp.text[:1000]}{'... [truncated]' if len(resp.text) > 1000 else ''}"
            )
            resp.raise_for_status()
            data = resp.json()
            _log_vitals_event(
                "BATCH_RESPONSE_FULL",
                f"Session: {session_id}\nUser: {user_id}\nFull Raw Response: {json.dumps(data)}"
            )
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            # Robustly extract JSON array from content
            import re
            json_array = None
            # Try to find the first JSON array in the string
            match = re.search(r'(\[.*?\])', content, re.DOTALL)
            if match:
                try:
                    json_array = json.loads(match.group(1))
                except Exception as e:
                    _log_vitals_event(
                        "BATCH_PARSE_EXCEPTION",
                        f"Session: {session_id}\nUser: {user_id}\nRegex JSON parse error: {str(e)}\nContent: {content[:500]}"
                    )
            if not json_array:
                # Fallback: try to parse the whole content
                try:
                    json_array = json.loads(content)
                except Exception as e:
                    _log_vitals_event(
                        "BATCH_PARSE_EXCEPTION",
                        f"Session: {session_id}\nUser: {user_id}\nFallback parse error: {str(e)}\nContent: {content[:500]}"
                    )
            if isinstance(json_array, list):
                # Ensure each item has both explanation and advice fields
                for i, item in enumerate(json_array):
                    if isinstance(item, dict):
                        # If advice is missing, try to extract from explanation (second line)
                        explanation_raw = item.get('explanation', '')
                        advice = item.get('advice', '')
                        if not advice:
                            lines = [l.strip() for l in explanation_raw.split('\n') if l.strip()]
                            if len(lines) > 1:
                                item['explanation'] = lines[0]
                                item['advice'] = lines[1]
                            else:
                                item['advice'] = ''
                _log_vitals_event(
                    "BATCH_PARSED_OUTPUT",
                    f"Session: {session_id}\nUser: {user_id}\nParsed {len(json_array)} explanations."
                )
                return json_array
            else:
                _log_vitals_event(
                    "BATCH_PARSE_ERROR",
                    f"Session: {session_id}\nUser: {user_id}\nCould not extract JSON array. Content: {content[:500]}"
                )
                return []
    except Exception as e:
        _log_vitals_event(
            "BATCH_ERROR",
            f"Session: {session_id}\nUser: {user_id}\nError: {str(e)}"
        )
        return []


import os
import json
import requests
from typing import Dict, Any
from datetime import datetime
from pathlib import Path

# OpenRouter configuration - loaded lazily to allow .env to load first
def _get_openrouter_key() -> str | None:
    """Get OpenRouter API key from environment."""
    return os.getenv("OPENROUTER_API_KEY")

_openrouter_base = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

# Use approved default model for quick explanations
_MODEL = "arcee-ai/trinity-mini:free"

# Logging setup
_LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)
_VITALS_LOG = _LOG_DIR / "vitals_explanations.log"


def _log_vitals_event(event_type: str, data: str) -> None:
    """Log vitals-related events to dedicated log file."""
    try:
        timestamp = datetime.now().isoformat()
        with open(_VITALS_LOG, 'a', encoding='utf-8') as f:
            f.write(f"\n{'='*80}\n")
            f.write(f"[{timestamp}] {event_type}\n")
            f.write(f"{'-'*80}\n")
            f.write(f"{data}\n")
    except Exception as e:
        print(f"Failed to log vitals event: {e}")


def _determine_status(vital_type: str, value: str | float, unit: str | None) -> str:
    """Determine health status based on vital type and value."""
    # Basic heuristics for common vitals
    try:
        num_value = float(value) if isinstance(value, str) else value
    except (ValueError, TypeError):
        return "normal"
    
    vt = vital_type.lower()
    # Blood Sugar (mg/dL)
    if "blood_sugar" in vt or "glucose" in vt:
        if num_value < 70 or num_value > 180:
            return "alert"
        elif num_value > 140:
            return "warning"
    # Blood Pressure Systolic (mmHg)
    elif "systolic" in vt:
        if num_value >= 180:
            return "alert"
        elif num_value >= 140:
            return "warning"
    # Blood Pressure Diastolic (mmHg)
    elif "diastolic" in vt:
        if num_value >= 120:
            return "alert"
        elif num_value >= 90:
            return "warning"
    # Cholesterol Total (mg/dL)
    elif "cholesterol" in vt and "total" in vt:
        if num_value >= 240:
            return "alert"
        elif num_value >= 200:
            return "warning"
    # Hemoglobin (g/dL)
    elif "hemoglobin" in vt:
        if num_value < 10 or num_value > 18:
            return "alert"
        elif num_value < 12 or num_value > 17:
            return "warning"
    # White Blood Cells (WBC)
    elif any(x in vt for x in ["white blood cell", "wbc"]):
        # Normal WBC: 4,000-11,000 cells/mcL
        if num_value < 4000 or num_value > 11000:
            return "alert"
    # Red Blood Cells (RBC)
    elif any(x in vt for x in ["red blood cell", "rbc", "erythrocyte"]):
        # Normal RBC: 4.5-5.9 million cells/mcL (male), 4.1-5.1 (female) -- use 4.0-6.0 as general
        if num_value < 4.0 or num_value > 6.0:
            return "alert"
    # Platelets
    elif "platelet" in vt:
        # Normal: 150,000-450,000 /mcL
        if num_value < 150000 or num_value > 450000:
            return "alert"
    # General blood test grouping
    elif any(x in vt for x in ["cbc", "complete blood count", "blood test", "blood panel"]):
        # If a value is way out of range, flag
        if num_value < 0.5 or num_value > 100:
            return "alert"
    return "normal"


def _build_prompt(vital_type: str, label: str, value: str | float, unit: str | None) -> str:
    """Build prompt for vital explanation."""
    unit_str = f" {unit}" if unit else ""
    return f"""You are a medical advisor. A patient has the following vital reading:

**{label}**: {value}{unit_str}

Provide a concise 1-2 sentence explanation that:
1. States whether this value is normal, borderline, or concerning
2. Provides one practical health tip or recommendation

Be direct, clear, and actionable. Do not use markdown formatting or bullet points."""


async def generate_vital_explanation(
    vital_type: str,
    label: str,
    value: str | float,
    unit: str | None
) -> Dict[str, Any]:
    """Generate AI explanation for a vital reading."""
    
    import uuid
    session_id = str(uuid.uuid4())
    user_id = None
    # Try to extract user_id if passed in context (optional, for advanced logging)
    if 'user_id' in locals():
        user_id = locals()['user_id']

    openrouter_key = _get_openrouter_key()
    if not openrouter_key:
        _log_vitals_event(
            "NO_API_KEY",
            f"Session: {session_id}\nUser: {user_id}\nVital: {label}\nValue: {value}\nUnit: {unit}"
        )
        return {
            "explanation": f"{label} recorded at {value}{' ' + unit if unit else ''}. Consult your healthcare provider for interpretation.",
            "status": "normal"
        }

    status = _determine_status(vital_type, value, unit)
    try:
        prompt = _build_prompt(vital_type, label, value, unit)
        _log_vitals_event(
            "PROMPT_SENT",
            f"Session: {session_id}\nUser: {user_id}\nVital Type: {vital_type}\nLabel: {label}\nValue: {value}\nUnit: {unit}\nStatus: {status}\nPrompt:\n{prompt}"
        )
        url = f"{_openrouter_base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {openrouter_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": _MODEL,
            "messages": [
                {"role": "system", "content": "You are a concise medical advisor providing brief, actionable health insights."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 150,
        }
        _log_vitals_event(
            "REQUEST_PAYLOAD",
            f"Session: {session_id}\nUser: {user_id}\nPayload: {json.dumps(payload)[:1000]}{'... [truncated]' if len(json.dumps(payload)) > 1000 else ''}"
        )
        resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
        resp.raise_for_status()
        data = resp.json()
        _log_vitals_event(
            "RESPONSE_RAW",
            f"Session: {session_id}\nUser: {user_id}\nRaw Response: {json.dumps(data)[:1000]}{'... [truncated]' if len(json.dumps(data)) > 1000 else ''}"
        )
        explanation_raw = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
        # Split into explanation and advice (assume first line is explanation, second is advice)
        lines = [l.strip() for l in explanation_raw.split('\n') if l.strip()]
        explanation = lines[0] if len(lines) > 0 else explanation_raw
        advice = lines[1] if len(lines) > 1 else ''
        # Log the parsed output
        _log_vitals_event(
            "PARSED_OUTPUT",
            f"Session: {session_id}\nUser: {user_id}\nVital: {label}\nExplanation: {explanation}\nAdvice: {advice}\nStatus: {status}"
        )
        if not explanation:
            _log_vitals_event(
                "MISSING_EXPLANATION",
                f"Session: {session_id}\nUser: {user_id}\nVital: {label}\nValue: {value}\nUnit: {unit}"
            )
            explanation = f"{label} recorded at {value}{' ' + unit if unit else ''}. Consult your healthcare provider for detailed interpretation."
        return {
            "explanation": explanation,
            "advice": advice,
            "status": status,
            "session_id": session_id
        }
    except Exception as e:
        _log_vitals_event(
            "ERROR",
            f"Session: {session_id}\nUser: {user_id}\nVital: {label}\nError: {str(e)}\nStatus: {status}"
        )
        return {
            "explanation": f"{label} recorded at {value}{' ' + unit if unit else ''}. Unable to generate detailed explanation at this time.",
            "status": status,
            "session_id": session_id
        }
