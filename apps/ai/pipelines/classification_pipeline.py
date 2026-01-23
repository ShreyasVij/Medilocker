from __future__ import annotations

from typing import Tuple, List, Dict


def _heuristics(text: str) -> Tuple[str | None, List[str], float]:
  t = (text or '').lower()
  tags: List[str] = []
  detected: str | None = None
  conf = 0.4

  if any(k in t for k in ['rx', 'prescription', 'take', 'dosage']):
    detected = 'prescription'
    tags.extend(['medications'])
    conf = 0.8
  elif any(k in t for k in ['lab', 'report', 'result', 'value', 'reference range']):
    detected = 'lab'
    tags.extend(['lab', 'observations'])
    conf = 0.75
  elif any(k in t for k in ['discharge', 'admit', 'hospital', 'ward']):
    detected = 'discharge'
    tags.append('hospital')
    conf = 0.7
  elif any(k in t for k in ['scan', 'mri', 'ct', 'x-ray', 'imaging']):
    detected = 'scan'
    tags.append('imaging')
    conf = 0.7
  else:
    detected = 'other'
    conf = 0.5

  tags = list(dict.fromkeys(tags))
  return detected, tags, conf


async def classify_text(text: str) -> Dict[str, object]:
  detected, tags, conf = _heuristics(text)
  return {
    'detected_type': detected,
    'inferred_tags': tags,
    'confidence': conf,
  }
