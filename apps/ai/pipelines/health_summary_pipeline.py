"""Pipeline for generating comprehensive health summaries from all user documents."""
from __future__ import annotations

import os
import json
import re
import requests
from typing import Dict, Any, List
from datetime import datetime
from pathlib import Path

# OpenRouter configuration - loaded lazily to allow .env to load first
def _get_openrouter_key() -> str | None:
    """Get OpenRouter API key from environment."""
    return os.getenv("OPENROUTER_API_KEY")

_openrouter_base = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

# Use a powerful model for comprehensive analysis
_MODEL = "meta-llama/llama-3.3-70b-instruct:free"

# Logging setup
_LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)
_SUMMARY_LOG = _LOG_DIR / "health_summary.log"


def _log_summary_event(event_type: str, data: str) -> None:
    """Log health summary events to dedicated log file."""
    try:
        timestamp = datetime.now().isoformat()
        with open(_SUMMARY_LOG, 'a', encoding='utf-8') as f:
            f.write(f"\n{'='*80}\n")
            f.write(f"[{timestamp}] {event_type}\n")
            f.write(f"{'-'*80}\n")
            f.write(f"{data}\n")
    except Exception as e:
        print(f"Failed to log summary event: {e}")


def _build_prompt(ocr_texts: List[str], document_count: int) -> str:
    """Build prompt for comprehensive health summary."""
    
    # Combine all OCR texts with separators
    combined_text = "\n\n=== DOCUMENT SEPARATOR ===\n\n".join(ocr_texts)
    
    # Truncate if too long (keep within token limits)
    max_length = 15000  # characters, roughly 3750 tokens
    if len(combined_text) > max_length:
        combined_text = combined_text[:max_length] + "\n\n[... additional documents truncated ...]"

    # Build the prompt using placeholders to avoid Python f-string brace interpolation
    prompt = """SYSTEM/INSTRUCTION:
You are a senior medical analyst. STRICTLY RETURN VALID JSON ONLY (no markdown, no commentary, no extra fields). Follow the JSON schema and rules below exactly.

SCHEMA (required top-level fields)
{
    "overall_summary": "<string>",              // 1–2 concise sentences summarizing overall health
    "overall_feedback": "<string|null>",        // 1 short paragraph (optional)
    "sections": [                               // REQUIRED: array of section objects for display
        { "heading": "<string>", "content": "<string>" }
    ],
    // Optional structured lab section keys allowed (e.g. "blood_tests") — but ALWAYS include a human-readable "sections" array.
}

OUTPUT RULES (must follow)
1. "sections" MUST be present and cover these headings in this order when data exists: "Current Health Status", "Identified Medical Conditions", "Recent Test Results Summary", "Areas of Concern", "Recommendations for Improvement". If a heading has no info, set its content to "No information available."
2. Each `sections[].content` must be 2–3 complete sentences (roughly 40–120 words), professional and evidence‑based, not a one-line fragment.
3. Use cautious language: use phrases like "may indicate", "appears to show", "suggests". Do NOT assert diagnoses.
4. For lab/test results, include structured details under an optional `blood_tests` object (you may include numbers/units/status). Also include a concise human-friendly line in the corresponding "Recent Test Results Summary" section.
5. Base ALL statements only on the provided documents and OCR text. Do not invent facts.
6. If you derive an interpretation from a specific document, optionally include the document id in parentheses at the end of that sentence (e.g. "(doc: abc123)").
7. If fields are missing, explicitly state "No information available" for that section.
8. Keep JSON keys exactly as shown. Return only the JSON object.

EXAMPLE (single-line JSON for clarity — the model must produce a similar structured object):
{"overall_summary":"Overall Health: Fair — mild anemia and mild kidney impairment with elevated glucose.","overall_feedback":"Your labs show mild anemia and borderline kidney function; follow-up testing and clinician review recommended.","sections":[{"heading":"Current Health Status","content":"The patient demonstrates mild anemia (low hemoglobin) and mildly impaired kidney markers. Vital signs are otherwise stable based on provided documents."},{"heading":"Identified Medical Conditions","content":"Mild iron-deficiency anemia is indicated by hemoglobin 10.7 g/dL. Creatinine 1.7 mg/dL suggests reduced kidney filtration that merits monitoring."},{"heading":"Recent Test Results Summary","content":"Hemoglobin 10.7 g/dL (low); RBC 3.6 million/pL (low); Creatinine 1.7 mg/dL (elevated); Fasting glucose 112 mg/dL (borderline). These values should be correlated with clinical history and repeat testing."},{"heading":"Areas of Concern","content":"Anemia may require iron supplementation and follow-up labs; elevated creatinine warrants assessment of kidney function; borderline hyperglycemia may need lifestyle modification and recheck."},{"heading":"Recommendations for Improvement","content":"Discuss iron therapy adherence and repeat CBC in 6–8 weeks. Evaluate kidney function with repeat creatinine and consider nephrology referral if persistent. Improve diet and exercise and monitor fasting glucose."}],"blood_tests":{"hemoglobin":{"value":10.7,"unit":"g/dL","status":"low","feedback":"Consider iron supplementation and follow-up CBC."},"creatinine":{"value":1.7,"unit":"mg/dL","status":"elevated","feedback":"Repeat and assess kidney function."}}}

ANALYZE THESE <<DOC_COUNT>> DOCUMENT(S):
<<COMBINED_TEXT>>
"""

    # Inject the dynamic values after building the static prompt
    prompt = prompt.replace("<<DOC_COUNT>>", str(document_count)).replace("<<COMBINED_TEXT>>", combined_text)

    return prompt


def _parse_sections(summary_text: str) -> List[Dict[str, str]]:
    """Parse the summary text into structured sections."""
    sections = []
    
    # Split by ## headings
    parts = re.split(r'##\s+', summary_text)
    
    for part in parts[1:]:  # Skip first empty part
        lines = part.strip().split('\n', 1)
        if len(lines) >= 2:
            heading = lines[0].strip()
            content = lines[1].strip()
            sections.append({
                "heading": heading,
                "content": content
            })
        elif len(lines) == 1:
            # Heading with no content
            sections.append({
                "heading": lines[0].strip(),
                "content": "No information available."
            })
    
    return sections


async def generate_comprehensive_health_summary(
    ocr_texts: List[str],
    document_count: int
) -> Dict[str, Any]:
    """Generate comprehensive health summary from all OCR texts."""
    
    openrouter_key = _get_openrouter_key()
    if not openrouter_key:
        # Fallback summary
        return {
            "summary": f"Health summary based on {document_count} document(s). API key not configured for detailed analysis.",
            "sections": [
                {
                    "heading": "Summary",
                    "content": f"Analysis of {document_count} medical documents. Configure OpenRouter API for detailed insights."
                }
            ]
        }
    
    if not ocr_texts or document_count == 0:
        return {
            "summary": "No medical documents available for analysis. Upload documents to generate your health summary.",
            "sections": [
                {
                    "heading": "Getting Started",
                    "content": "Upload your medical documents to receive a comprehensive health analysis."
                }
            ]
        }
    
    import uuid
    session_id = str(uuid.uuid4())
    user_id = None
    if 'user_id' in locals():
        user_id = locals()['user_id']

    prompt = _build_prompt(ocr_texts, document_count)
    _log_summary_event(
        "PROMPT_FULL",
        f"Session: {session_id}\nUser: {user_id}\nDocument Count: {document_count}\nOCR Texts Count: {len(ocr_texts)}\n\nFull Prompt:\n{prompt}"
    )

    url = f"{_openrouter_base}/chat/completions"
    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
    }

    models_to_try = [
        "meta-llama/llama-3.3-70b-instruct:free",
        "mistralai/devstral-2512:free",
        "openai/gpt-3.5-turbo:free"
    ]
    errors = []
    for model in models_to_try:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a medical analyst creating comprehensive, structured health summaries."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.4,
            "max_tokens": 1200,
        }
        try:
            _log_summary_event(
                "OPENROUTER_ATTEMPT",
                f"Session: {session_id}\nUser: {user_id}\nTrying model: {model} for {document_count} document(s)"
            )
            _log_summary_event(
                "REQUEST_PAYLOAD",
                f"Session: {session_id}\nUser: {user_id}\nPayload: {json.dumps(payload)[:1000]}{'... [truncated]' if len(json.dumps(payload)) > 1000 else ''}"
            )
            resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=90)
            status = resp.status_code
            _log_summary_event(
                "OPENROUTER_RESPONSE",
                f"Session: {session_id}\nUser: {user_id}\nModel: {model}\nStatus: {status}\nResponse: {resp.text[:1000]}{'... [truncated]' if len(resp.text) > 1000 else ''}"
            )
            resp.raise_for_status()
            data = resp.json()
            _log_summary_event(
                "RESPONSE_FULL",
                f"Session: {session_id}\nUser: {user_id}\nFull Raw Response: {json.dumps(data)}"
            )
            summary_text = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            # Log the parsed output
            _log_summary_event(
                "PARSED_OUTPUT",
                f"Session: {session_id}\nUser: {user_id}\nSummary: {summary_text[:1000]}{'... [truncated]' if len(summary_text) > 1000 else ''}"
            )
            if not summary_text:
                _log_summary_event(
                    "MISSING_SUMMARY",
                    f"Session: {session_id}\nUser: {user_id}\nModel: {model} returned empty summary."
                )
            if summary_text:
                sections = _parse_sections(summary_text)
                if not sections:
                    sections = [
                        {
                            "heading": "Health Summary",
                            "content": summary_text
                        }
                    ]
                _log_summary_event(
                    "RESPONSE_RECEIVED",
                    f"Session: {session_id}\nUser: {user_id}\nModel: {model}\nDocument Count: {document_count}\nSections: {len(sections)}\n\nSummary:\n{summary_text[:1000]}{'... [truncated]' if len(summary_text) > 1000 else ''}"
                )
                return {
                    "summary": summary_text,
                    "sections": sections,
                    "session_id": session_id
                }
            else:
                errors.append(f"Model {model} returned empty summary.")
        except Exception as e:
            error_msg = f"Model: {model} | Error: {str(e)}"
            errors.append(error_msg)
            _log_summary_event(
                "OPENROUTER_ERROR",
                f"Session: {session_id}\nUser: {user_id}\n{error_msg}"
            )

    _log_summary_event(
        "ALL_MODELS_FAILED",
        f"Session: {session_id}\nUser: {user_id}\nDocument Count: {document_count}\nErrors: {errors}"
    )
    return {
        "summary": f"Analysis of {document_count} medical documents. Error generating detailed summary. Tried models: {models_to_try}. Errors: {errors}",
        "sections": [
            {
                "heading": "Summary",
                "content": f"Processed {document_count} document(s). Unable to generate detailed analysis at this time."
            }
        ]
    }
