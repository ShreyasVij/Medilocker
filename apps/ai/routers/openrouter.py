from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx
import os
import re
from ..security.dependencies import verify_service_token
from ..services.logger import log_openrouter_event

router = APIRouter()

class OpenRouterRequest(BaseModel):
    prompt: str

@router.post("/")
async def openrouter_proxy(payload: OpenRouterRequest, _auth=Depends(verify_service_token)):
    """Proxy to OpenRouter for AI prompts."""
    import json
    try:
        log_openrouter_event('openrouter_request', f"prompt_len={len(payload.prompt)}")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "arcee-ai/trinity-mini:free",
                    "messages": [{"role": "user", "content": payload.prompt}],
                    "max_tokens": 2000,
                },
            )
            if response.status_code != 200:
                log_openrouter_event('openrouter_error', f"status={response.status_code} response={response.text}")
                raise HTTPException(status_code=response.status_code, detail="OpenRouter API error")

            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            log_openrouter_event('openrouter_response', f"content_len={len(content)} content_preview={content[:200]}")

            # Try to parse as JSON (object or array) and normalize to a stable shape
            try:
                parsed = json.loads(content)
                normalized: dict[str, object] = parsed.copy() if isinstance(parsed, dict) else {}
                summary = None
                sections: list[dict] = []
                explanations: list[dict] | None = None

                if isinstance(parsed, dict):
                    log_openrouter_event('openrouter_parse', 'parsed JSON object')
                    explanations = parsed.get('explanations') or parsed.get('explain') or parsed.get('items')
                    sections = parsed.get('sections') or []
                    summary = (
                        parsed.get('summary')
                        or parsed.get('overall_summary')
                        or parsed.get('overallSummary')
                        or parsed.get('overall_feedback')
                        or parsed.get('overallFeedback')
                    )
                elif isinstance(parsed, list):
                    log_openrouter_event('openrouter_parse', f'parsed JSON array, len={len(parsed)}')
                    explanations = parsed
                else:
                    log_openrouter_event('openrouter_parse', f'unexpected JSON type: {type(parsed)}')

                # Convert explanations -> sections and synthesize a short summary if needed
                if explanations and isinstance(explanations, list) and len(explanations) > 0:
                    if not sections:
                        for e in explanations:
                            heading = e.get('label') or e.get('heading') or e.get('title') or 'Finding'
                            content_text = e.get('explanation') or e.get('advice') or ''
                            sections.append({'heading': heading, 'content': content_text})
                    if not summary:
                        summary_pieces = []
                        for e in explanations[:3]:
                            lbl = e.get('label') or e.get('heading') or ''
                            expl = e.get('explanation') or e.get('advice') or ''
                            piece = (f"{lbl}: {expl}" if lbl else expl).strip()
                            if piece:
                                summary_pieces.append(piece)
                        summary = ' '.join(summary_pieces) if summary_pieces else None

                # If still no sections, try to extract markdown headings from raw content
                if not sections:
                    try:
                        parts = re.split(r'##\s+', content)
                        if len(parts) > 1:
                            sections = []
                            for part in parts[1:]:
                                lines = part.strip().split('\n', 1)
                                heading = lines[0].strip()
                                body = lines[1].strip() if len(lines) > 1 else 'No information available.'
                                sections.append({'heading': heading, 'content': body})
                            if not summary:
                                summary = ' '.join([s['content'] for s in sections[:3]])
                    except Exception:
                        pass

                # Final fallback
                if not summary:
                    summary = content.strip()[:1000] if content and isinstance(content, str) else None

                normalized['summary'] = summary
                normalized['sections'] = sections or []
                if explanations is not None:
                    normalized['explanations'] = explanations
                return normalized
            except Exception as e:
                log_openrouter_event('openrouter_parse_error', f'error={str(e)} content_preview={content[:200]}')
                return {'summary': content}
    except Exception as e:
        log_openrouter_event('openrouter_exception', str(e))
        raise HTTPException(status_code=500, detail=str(e))