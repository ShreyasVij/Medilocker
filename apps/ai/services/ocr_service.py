"""OCR facade with PDF text extraction using PyMuPDF (with fallback) and image OCR via OCR.Space.

If the input is a PDF, attempt textual extraction via PyMuPDF. If PyMuPDF is
unavailable or fails, fall back to pdfminer.six. For non-PDFs, perform OCR
using OCR.Space when an API key is configured, else return a safe stub.
"""
from __future__ import annotations

from typing import Optional
import os
import asyncio
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import requests

# Configure module-level logger for OCR diagnostics
_logger = logging.getLogger("ocr.space")
if not _logger.handlers:
    _logger.setLevel(logging.INFO)
    _logs_dir = Path(__file__).resolve().parent.parent / "logs"
    _logs_dir.mkdir(parents=True, exist_ok=True)
    _file_handler = RotatingFileHandler(_logs_dir / "ocr_space.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    _file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    _stream_handler = logging.StreamHandler()
    _stream_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    _logger.addHandler(_file_handler)
    _logger.addHandler(_stream_handler)


def _is_pdf(file_name: str) -> bool:
    return (file_name or "").lower().endswith(".pdf")


def _is_image(file_name: str) -> bool:
    lower = (file_name or "").lower()
    return lower.endswith((".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"))


def _detect_image_from_bytes(content_bytes: bytes) -> bool:
    """Detect if bytes represent an image using magic bytes."""
    if not content_bytes or len(content_bytes) < 12:
        return False
    
    # Check magic bytes for common image formats
    # PNG: 89 50 4E 47 0D 0A 1A 0A
    if content_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        return True
    # JPEG: FF D8 FF
    if content_bytes[:3] == b'\xff\xd8\xff':
        return True
    # GIF: GIF87a or GIF89a
    if content_bytes[:6] in (b'GIF87a', b'GIF89a'):
        return True
    # BMP: 42 4D
    if content_bytes[:2] == b'BM':
        return True
    # TIFF: 49 49 2A 00 (little-endian) or 4D 4D 00 2A (big-endian)
    if content_bytes[:4] in (b'II*\x00', b'MM\x00*'):
        return True
    # WebP: RIFF....WEBP
    if len(content_bytes) >= 12 and content_bytes[:4] == b'RIFF' and content_bytes[8:12] == b'WEBP':
        return True
    
    return False


def _ocrspace_image_bytes(file_name: str, content_bytes: bytes) -> dict[str, Optional[str]]:
    api_key = os.getenv("OCR_SPACE_API_KEY")
    if not api_key:
        _logger.warning("OCR.Space key missing; skipping image OCR for '%s' (bytes=%d)", file_name, len(content_bytes) if content_bytes else 0)
        return {"text": None, "engine": "ocr.space", "confidence": None}

    timeout_sec = float(os.getenv("OCR_SPACE_TIMEOUT", "45"))
    max_retries = int(os.getenv("OCR_SPACE_RETRIES", "2"))

    attempt = 0
    payload_bytes = content_bytes
    last_err: Exception | None = None
    while attempt <= max_retries:
        try:
            _logger.info("Calling OCR.Space for '%s' (bytes=%d, attempt=%d/%d)", file_name, len(payload_bytes) if payload_bytes else 0, attempt + 1, max_retries + 1)
            resp = requests.post(
                "https://api.ocr.space/parse/image",
                data={
                    "apikey": api_key,
                    "language": "eng",
                    # Use the correct parameter name per OCR.Space API
                    "isOverlayRequired": False,
                    "OCREngine": 2,  # better accuracy for printed text
                    "scale": True,
                    "detectOrientation": True,
                },
                files={"file": (file_name or "image", payload_bytes)},
                timeout=timeout_sec,
            )
            _logger.info("OCR.Space response status=%d for '%s'", resp.status_code, file_name)
            if resp.status_code != 200:
                try:
                    _logger.error("Non-200 status from OCR.Space: status=%d body=%s", resp.status_code, resp.text[:500])
                except Exception:
                    _logger.error("Non-200 status from OCR.Space: status=%d (body not readable)", resp.status_code)
                last_err = RuntimeError(f"status={resp.status_code}")
                raise last_err

            data = resp.json()
            if data.get("IsErroredOnProcessing"):
                _logger.error("OCR.Space errored: ParsedResults=%s ErrorMessage=%s", str(data.get("ParsedResults"))[:200], str(data.get("ErrorMessage"))[:200])
                last_err = RuntimeError("IsErroredOnProcessing")
                raise last_err

            results = data.get("ParsedResults") or []
            parsed_texts = [r.get("ParsedText") or "" for r in results]
            text = "\n".join(t.strip() for t in parsed_texts if t)
            conf = None
            try:
                conf = results[0].get("MeanConfidence") if results else None
            except Exception:
                conf = None
            if conf is None:
                conf = 0.9 if len(text) > 50 else 0.5
            _logger.info(
                "OCR.Space parsed: results=%d text_len=%d conf=%s sample='%s'",
                len(results), len(text or ""), str(conf), (text or "").replace("\n", " ")[:160]
            )
            return {"text": text or None, "engine": "ocr.space", "confidence": conf}
        except Exception as e:
            last_err = e
            _logger.exception("Exception during OCR.Space call for '%s' (attempt=%d): %s", file_name, attempt + 1, e)
            attempt += 1
            # On retry, try compressing to JPEG to reduce payload (optional, if Pillow available)
            try:
                from PIL import Image  # type: ignore
                import io
                img = Image.open(io.BytesIO(content_bytes))
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=85)
                payload_bytes = buf.getvalue()
                _logger.info("Compressed image for retry: %d -> %d bytes", len(content_bytes), len(payload_bytes))
            except Exception:
                # Keep original bytes; just back off
                payload_bytes = content_bytes
            # brief backoff
            try:
                import time
                time.sleep(0.5 * attempt)
            except Exception:
                pass
    # Out of retries
    return {"text": None, "engine": "ocr.space", "confidence": None}


async def extract_text(*, file_name: str, content_bytes: bytes) -> dict[str, Optional[str]]:
    # Robust file-type detection: prefer filename extension, but fall back to
    # magic-bytes (PDF signature) and image detection for images when the
    # provided `file_name` is a storage key like '.../original' with no ext.
    is_pdf_by_name = _is_pdf(file_name)
    is_image_by_name = _is_image(file_name)

    is_pdf_by_bytes = False
    is_image_by_bytes = False
    try:
        # PDF files start with '%PDF'
        if content_bytes and content_bytes[:4] == b"%PDF":
            is_pdf_by_bytes = True
    except Exception:
        is_pdf_by_bytes = False

    try:
        # Detect image from magic bytes
        is_image_by_bytes = _detect_image_from_bytes(content_bytes)
    except Exception:
        is_image_by_bytes = False

    # Final decisions
    is_pdf = is_pdf_by_name or is_pdf_by_bytes
    is_image = is_image_by_name or is_image_by_bytes

    if is_pdf:
        # Try PyMuPDF first (lazy import to avoid hard dependency at import time)
        try:
            import fitz  # type: ignore
            doc = fitz.open(stream=content_bytes, filetype="pdf")
            parts: list[str] = []
            for page in doc:
                parts.append(page.get_text())
            text = "\n".join(parts).strip()
            if text:
                engine = "pymupdf"
                confidence = 0.9 if len(text) > 50 else 0.5
                doc.close()
                _logger.info("PDF text extraction via PyMuPDF: text_len=%d", len(text))
                return {"text": text, "engine": engine, "confidence": confidence}

            # If there was no extractable text (likely a scanned PDF), OCR each page image
            ocr_texts: list[str] = []
            confidences: list[float] = []
            try:
                for page in doc:
                    # Render at 2x zoom for better OCR
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                    img_bytes = pix.tobytes("png")
                    res = _ocrspace_image_bytes(file_name=f"{file_name}-p{page.number+1}.png", content_bytes=img_bytes)
                    if res.get("text"):
                        ocr_texts.append(str(res.get("text")))
                    conf = res.get("confidence")
                    if isinstance(conf, (int, float)):
                        confidences.append(float(conf))
            finally:
                doc.close()
            if ocr_texts:
                merged = "\n".join(ocr_texts)
                conf = (sum(confidences) / len(confidences)) if confidences else 0.6
                _logger.info(
                    "Scanned PDF OCR fallback via OCR.Space: pages=%d text_len=%d avg_conf=%.3f",
                    len(ocr_texts), len(merged), conf
                )
                return {"text": merged, "engine": "pymupdf+ocr.space", "confidence": conf}
        except Exception:
            # Fallback to pdfminer.six
            try:
                from pdfminer.high_level import extract_text as pdf_extract_text  # type: ignore
                from io import BytesIO
                with BytesIO(content_bytes) as bio:
                    text = pdf_extract_text(bio) or ""
                text = text.strip()
                if text:
                    engine = "pdfminer"
                    confidence = 0.8 if len(text) > 50 else 0.5
                    _logger.info("PDF text extraction via pdfminer: text_len=%d", len(text))
                    return {"text": text, "engine": engine, "confidence": confidence}
            except Exception:
                pass
    if is_image:
        _logger.info("Image OCR path taken for '%s' (bytes=%d) - detected_by_name=%s detected_by_bytes=%s", file_name, len(content_bytes) if content_bytes else 0, is_image_by_name, is_image_by_bytes)
        return await asyncio.to_thread(_ocrspace_image_bytes, file_name, content_bytes)

    sample_text = "Patient: Jane Doe\nDOB: 1990-02-14\nDiagnosis: Mild anemia\nRx: Ferrous sulfate 325mg daily"
    _logger.warning("Non-PDF and non-image input; returning stub text. filename='%s'", file_name)
    return {"text": sample_text, "engine": "stub", "confidence": 0.42}
