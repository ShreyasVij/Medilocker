from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..security.dependencies import verify_service_token
from ..services.logger import log_openrouter_event

router = APIRouter()

_MODEL_ROTATION: tuple[str, ...] = (
    "arcee-ai/trinity-mini:free",
    "liquid/lfm-2.5-1.2b-instruct:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
)


class OpenRouterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(..., min_length=1, max_length=20000)

    @field_validator("prompt")
    @classmethod
    def _normalize_prompt(cls, value: str) -> str:
        prompt = value.strip()
        if not prompt:
            raise ValueError("prompt must not be empty")
        return prompt


def _build_headers() -> dict[str, str]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENROUTER_API_KEY is not configured",
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Title": os.getenv("OPENROUTER_APP_TITLE", "MediLocker AI Services"),
    }

    referer = os.getenv("OPENROUTER_HTTP_REFERER") or os.getenv("OPENROUTER_REFERER")
    if referer:
        headers["HTTP-Referer"] = referer

    return headers


def _build_request_body(prompt: str) -> dict[str, Any]:
    return {
        "messages": [
            {"role": "system", "content": "You are a concise, reliable assistant."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 2000,
        "stream": False,
    }


def _candidate_models() -> list[str]:
    models: list[str] = []
    configured_model = os.getenv("OPENROUTER_MODEL")
    if configured_model:
        models.append(configured_model)

    for model in _MODEL_ROTATION:
        if model not in models:
            models.append(model)

    return models


def _extract_message_content(data: Any) -> str:
    if not isinstance(data, dict):
        raise ValueError(f"unexpected OpenRouter response type: {type(data).__name__}")

    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ValueError("OpenRouter response missing choices")

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise ValueError("OpenRouter response choice is not an object")

    message = first_choice.get("message")
    if not isinstance(message, dict):
        raise ValueError("OpenRouter response missing message object")

    content = message.get("content", "")
    return content if isinstance(content, str) else json.dumps(content)


def _normalize_completion(content: str) -> dict[str, object]:
    content = (content or "").strip()

    try:
        parsed = json.loads(content)
    except Exception:
        parsed = None

    normalized: dict[str, object] = parsed.copy() if isinstance(parsed, dict) else {}
    summary: str | None = None
    sections: list[dict[str, object]] = []
    explanations: list[dict[str, object]] | None = None

    if isinstance(parsed, dict):
        log_openrouter_event("openrouter_parse", "parsed JSON object")
        explanations = parsed.get("explanations") or parsed.get("explain") or parsed.get("items")
        sections = parsed.get("sections") or []
        summary = (
            parsed.get("summary")
            or parsed.get("overall_summary")
            or parsed.get("overallSummary")
            or parsed.get("overall_feedback")
            or parsed.get("overallFeedback")
        )
    elif isinstance(parsed, list):
        log_openrouter_event("openrouter_parse", f"parsed JSON array, len={len(parsed)}")
        explanations = parsed

    if explanations and isinstance(explanations, list) and len(explanations) > 0:
        if not sections:
            for explanation in explanations:
                if not isinstance(explanation, dict):
                    continue
                heading = explanation.get("label") or explanation.get("heading") or explanation.get("title") or "Finding"
                content_text = explanation.get("explanation") or explanation.get("advice") or ""
                sections.append({"heading": heading, "content": content_text})

        if not summary:
            summary_pieces: list[str] = []
            for explanation in explanations[:3]:
                if not isinstance(explanation, dict):
                    continue
                lbl = explanation.get("label") or explanation.get("heading") or ""
                expl = explanation.get("explanation") or explanation.get("advice") or ""
                piece = (f"{lbl}: {expl}" if lbl else expl).strip()
                if piece:
                    summary_pieces.append(piece)
            summary = " ".join(summary_pieces) if summary_pieces else None

    if not sections:
        try:
            parts = re.split(r"##\s+", content)
            if len(parts) > 1:
                for part in parts[1:]:
                    lines = part.strip().split("\n", 1)
                    heading = lines[0].strip()
                    body = lines[1].strip() if len(lines) > 1 else "No information available."
                    sections.append({"heading": heading, "content": body})
                if not summary:
                    summary = " ".join([str(section.get("content", "")) for section in sections[:3]]).strip() or None
        except Exception:
            pass

    if not summary:
        summary = content[:1000] if content else None

    normalized["summary"] = summary
    normalized["sections"] = sections or []
    if explanations is not None:
        normalized["explanations"] = explanations
    return normalized


@router.post("/openrouter", status_code=status.HTTP_200_OK)
@router.post("/openrouter/", include_in_schema=False, status_code=status.HTTP_200_OK)
async def openrouter_proxy(payload: OpenRouterRequest, _auth=Depends(verify_service_token)):
    """Proxy to OpenRouter for AI prompts."""
    timeout = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)
    models = _candidate_models()
    request_body = _build_request_body(payload.prompt)

    log_openrouter_event(
        "openrouter_request",
        f"prompt_len={len(payload.prompt)} models={','.join(models)}",
    )

    last_error: Exception | None = None
    response = None

    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            for model in models:
                request_body["model"] = model
                log_openrouter_event("openrouter_model_attempt", model)
                try:
                    response = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers=_build_headers(),
                        json=request_body,
                    )
                except httpx.TimeoutException as exc:
                    last_error = exc
                    log_openrouter_event("openrouter_timeout", f"model={model} type={type(exc).__name__} detail={exc}")
                    continue
                except httpx.RequestError as exc:
                    last_error = exc
                    log_openrouter_event("openrouter_request_error", f"model={model} type={type(exc).__name__} detail={exc}")
                    continue

                if response.status_code == 200:
                    break

                response_preview = response.text[:2000]
                log_openrouter_event(
                    "openrouter_error",
                    f"model={model} status={response.status_code} response_preview={response_preview}",
                )
                last_error = HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail={
                        "message": "OpenRouter API returned an error",
                        "model": model,
                        "upstream_status": response.status_code,
                        "upstream_preview": response_preview,
                    },
                )

        if response is None:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to contact OpenRouter",
            )

        if response.status_code >= 400:
            if isinstance(last_error, HTTPException):
                raise last_error
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenRouter API returned an error",
            )

        try:
            data = response.json()
            content = _extract_message_content(data)
        except Exception as exc:
            log_openrouter_event("openrouter_parse_error", f"type={type(exc).__name__} detail={exc} body_preview={response.text[:1000]}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenRouter returned an invalid response",
            ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        log_openrouter_event("openrouter_exception", f"type={type(exc).__name__} detail={exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error while proxying OpenRouter request",
        ) from exc

    log_openrouter_event(
        "openrouter_response",
        f"content_len={len(content)} content_preview={content[:200]}",
    )

    try:
        return _normalize_completion(content)
    except Exception as exc:
        log_openrouter_event("openrouter_normalize_error", f"type={type(exc).__name__} detail={exc}")
        return {"summary": content}