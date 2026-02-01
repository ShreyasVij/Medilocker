"""
Pipeline for generating smart document titles from OCR text using AI.
"""
import json
import os
import requests
from typing import Dict, Any


def _get_openrouter_key() -> str | None:
    """Get OpenRouter API key from environment."""
    return os.getenv("OPENROUTER_API_KEY")


_openrouter_base = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")


async def generate_document_title(
    ocr_text: str,
    doc_type: str,
    metadata: Dict[str, Any] | None = None
) -> Dict[str, Any]:
    """
    Generate a concise, descriptive title for a medical document.
    
    Args:
        ocr_text: Extracted text from the document
        doc_type: Type of document (lab, prescription, scan, discharge, other)
        metadata: Additional metadata that might help with title generation
    
    Returns:
        Dict with 'title' and 'confidence' keys
    """
    
    # Truncate OCR text to first 1000 characters for efficiency
    text_sample = ocr_text[:1000] if ocr_text else ""
    
    if not text_sample or len(text_sample.strip()) < 10:
        # Fallback for no/minimal text
        return {
            "title": f"{doc_type.capitalize()} Document",
            "confidence": 0.3
        }
    
    # Build prompt for AI
    prompt = f"""You are a medical document title generator. Generate a specific, descriptive title for this medical document.

Document Type: {doc_type}
Document Text (first 1000 chars):
{text_sample}

Requirements:
1. Title should be 2-5 words maximum
2. Be SPECIFIC - identify the exact test/report type (e.g., "Blood Report", "Liver Report", "Prescription", "X-Ray Report", not generic "Lab Report")
3. Include specific test names if identifiable (e.g., "Complete Blood Count", "Liver Function Test", "Chest X-Ray")
4. Include medication name for prescriptions (e.g., "Metformin Prescription", "Aspirin Prescription")
5. Avoid generic terms like "Medical Report", "Test Results", "Document"
6. Be medically accurate and specific

Examples of GOOD titles (be specific like these):
- "Blood Report"
- "Liver Report"
- "Kidney Report"
- "Diabetes Report"
- "Prescription"
- "Metformin Prescription"
- "Chest X-Ray"
- "ECG Report"
- "Thyroid Report"
- "Lipid Panel"

Examples of BAD titles (avoid these):
- "Lab Report" (too generic)
- "Medical Document" (too vague)
- "Test Results" (too generic)

Return ONLY a JSON object with this structure:
{{
    "title": "your generated title here",
    "confidence": 0.95
}}

Do not include any other text, explanation, or markdown formatting."""

    try:
        openrouter_key = _get_openrouter_key()
        
        if not openrouter_key:
            # Fallback if no API key
            return {
                "title": f"{doc_type.capitalize()} Document",
                "confidence": 0.5
            }
        
        url = f"{_openrouter_base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {openrouter_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": "arcee-ai/trinity-mini:free",
            "messages": [
                {"role": "system", "content": "You are a medical document title generator. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 100,
        }
        
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        
        response_content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
        
        # Parse response
        content = response_content
        
        # Try to extract JSON from the response
        if content.startswith("{") and content.endswith("}"):
            result = json.loads(content)
            title = result.get("title", "").strip()
            confidence = float(result.get("confidence", 0.8))
            
            if title and len(title) > 0:
                # Ensure title isn't too long
                if len(title) > 60:
                    title = title[:57] + "..."
                
                return {
                    "title": title,
                    "confidence": min(confidence, 1.0)
                }
        
        # If JSON parsing fails, try to extract just the title
        lines = content.split("\n")
        for line in lines:
            if "title" in line.lower() and ":" in line:
                title = line.split(":", 1)[1].strip().strip('"').strip("'")
                if title:
                    return {
                        "title": title[:60],
                        "confidence": 0.7
                    }
        
        # Fallback: use first line if it looks reasonable
        first_line = lines[0].strip().strip('"').strip("'")
        if first_line and 3 <= len(first_line.split()) <= 10:
            return {
                "title": first_line[:60],
                "confidence": 0.6
            }
    
    except Exception as e:
        print(f"Error generating title: {e}")
    
    # Ultimate fallback
    return {
        "title": f"{doc_type.capitalize()} - Medical Document",
        "confidence": 0.5
    }
