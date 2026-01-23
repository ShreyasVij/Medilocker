from __future__ import annotations

from typing import Dict, Any, List


async def explain_model_output(model_output: Dict[str, Any]) -> Dict[str, Any]:
  rationales: List[str] = []
  if 'prediction' in model_output:
    rationales.append(f"Model predicted: {model_output['prediction']}. Explanation based on input features.")
  if 'features' in model_output and isinstance(model_output['features'], dict):
    rationales.append('Key features influencing the decision: ' + ', '.join(model_output['features'].keys()))
  if not rationales:
    rationales.append('No specific model output provided; general explanation unavailable.')
  return { 'rationale': rationales, 'confidence': 0.6 }
