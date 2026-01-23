from __future__ import annotations

from typing import Dict, Any, List


async def generate_guidance(signals: Dict[str, Any]) -> Dict[str, Any]:
  recs: List[Dict[str, Any]] = []
  bp = signals.get('blood_pressure')
  hr = signals.get('heart_rate')
  glucose = signals.get('glucose')

  if isinstance(bp, (int, float)) and bp > 140:
    recs.append({ 'message': 'Blood pressure is elevated. Consider consulting a physician.', 'label': 'bp_high', 'confidence': 0.8 })
  if isinstance(hr, (int, float)) and hr > 100:
    recs.append({ 'message': 'Heart rate is high. Rest and hydration may help.', 'label': 'hr_high', 'confidence': 0.7 })
  if isinstance(glucose, (int, float)) and glucose > 180:
    recs.append({ 'message': 'Glucose level is elevated. Review diet and medication adherence.', 'label': 'glucose_high', 'confidence': 0.75 })

  if not recs:
    recs.append({ 'message': 'No specific recommendations. Maintain regular checkups.', 'label': 'general', 'confidence': 0.5 })

  return { 'recommendations': recs }
