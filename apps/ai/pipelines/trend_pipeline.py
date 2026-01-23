from __future__ import annotations

from typing import List, Dict


async def analyze_series(series: List[Dict]) -> Dict[str, object]:
  if not series or len(series) < 2:
    return { 'pattern': None, 'confidence': 0.0 }
  try:
    values = [float(p.get('value', 0)) for p in series]
    delta = values[-1] - values[0]
    # Simple thresholds
    if abs(delta) < 0.01:
      return { 'pattern': 'stable', 'confidence': 0.6 }
    if delta > 0:
      conf = min(0.95, 0.5 + abs(delta) / (abs(values[0]) + 1))
      return { 'pattern': 'rising', 'confidence': round(conf, 2) }
    else:
      conf = min(0.95, 0.5 + abs(delta) / (abs(values[0]) + 1))
      return { 'pattern': 'falling', 'confidence': round(conf, 2) }
  except Exception:
    return { 'pattern': None, 'confidence': 0.0 }
