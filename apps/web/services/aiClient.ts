// Client for FastAPI AI services (OCR, classify, summarize, trends, recommend, explain, extract).
const AI_BASE = process.env.AI_BASE_URL || process.env.NEXT_PUBLIC_AI_BASE_URL || "";

if (!AI_BASE) {
  console.warn('AI_BASE_URL not configured. AI features may not work properly.');
}

// Use the same internal token name as the AI service expects
const AI_TOKEN = process.env.INTERNAL_AUTH_TOKEN || process.env.AI_SERVICE_TOKEN || "dev-token";

export async function callExtract(params: { fileName: string; contentBase64: string }) {
  try {
    const res = await fetch(`${AI_BASE}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_TOKEN}` },
      body: JSON.stringify({ file_name: params.fileName, content_base64: params.contentBase64 }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Extract failed: ${res.status} ${detail}`);
    }
    return res.json();
  } catch (err: any) {
    const hint = `AI_BASE_URL=${AI_BASE}`;
    throw new Error(`Fetch to AI service failed. ${hint}. ${err?.message || err}`);
  }
}

export async function callExtractMulti(params: { files: { fileName: string; contentBase64: string }[] }) {
  try {
    const res = await fetch(`${AI_BASE}/extract/multi`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_TOKEN}` },
      // Map camelCase from web to snake_case expected by FastAPI/Pydantic
      body: JSON.stringify({
        files: params.files.map((f) => ({
          file_name: f.fileName,
          content_base64: f.contentBase64,
        })),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Extract multi failed: ${res.status} ${detail}`);
    }
    return res.json();
  } catch (err: any) {
    const hint = `AI_BASE_URL=${AI_BASE}`;
    throw new Error(`Fetch to AI service failed. ${hint}. ${err?.message || err}`);
  }
}

export async function callOcr(params: { storageKey: string }) {
  const res = await fetch(`${AI_BASE}/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_TOKEN}` },
    body: JSON.stringify({ storage_key: params.storageKey }),
  });
  if (!res.ok) throw new Error(`OCR failed: ${res.status}`);
  return res.json();
}

export async function callClassify(params: { text: string }) {
  const res = await fetch(`${AI_BASE}/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_TOKEN}` },
    body: JSON.stringify({ text: params.text }),
  });
  if (!res.ok) throw new Error(`Classify failed: ${res.status}`);
  return res.json();
}

export async function callSummarize(params: { structuredData: unknown }) {
  const res = await fetch(`${AI_BASE}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_TOKEN}` },
    body: JSON.stringify({ structured_data: params.structuredData }),
  });
  if (!res.ok) throw new Error(`Summarize failed: ${res.status}`);
  return res.json();
}

export async function callTrends(params: { series: unknown }) {
  const res = await fetch(`${AI_BASE}/trends`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_TOKEN}` },
    body: JSON.stringify({ series: params.series }),
  });
  if (!res.ok) throw new Error(`Trends failed: ${res.status}`);
  return res.json();
}

export async function callRecommend(params: { signals: unknown }) {
  const res = await fetch(`${AI_BASE}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_TOKEN}` },
    body: JSON.stringify({ signals: params.signals }),
  });
  if (!res.ok) throw new Error(`Recommend failed: ${res.status}`);
  return res.json();
}

export async function callExplain(params: { modelOutput: unknown }) {
  const res = await fetch(`${AI_BASE}/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_TOKEN}` },
    body: JSON.stringify({ model_output: params.modelOutput }),
  });
  if (!res.ok) throw new Error(`Explain failed: ${res.status}`);
  return res.json();
}

// Simple OpenRouter summary call: sends raw text prompt and returns model output.
export async function callOpenRouterSummary(text: string) {
  const res = await fetch(`${AI_BASE}/openrouter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_TOKEN}` },
    body: JSON.stringify({ prompt: text }),
  });
  if (!res.ok) throw new Error(`OpenRouter summary failed: ${res.status}`);
  return res.json();
}

function buildFallbackHealthSummary(params: { documentsData: any; ocrTexts?: string[] }) {
  const documents = Array.isArray(params.documentsData) ? params.documentsData : [];
  const ocrTexts = Array.isArray(params.ocrTexts) ? params.ocrTexts : [];

  const vitals: Array<{ label: string; value: string | number; unit?: string | null }> = [];
  const diagnoses: string[] = [];
  const medications: string[] = [];

  for (const document of documents) {
    if (typeof document?.diagnosis === 'string' && document.diagnosis.trim()) {
      diagnoses.push(document.diagnosis.trim());
    }
    if (Array.isArray(document?.medications)) {
      for (const medication of document.medications) {
        if (typeof medication === 'string' && medication.trim()) {
          medications.push(medication.trim());
        }
      }
    }
    if (Array.isArray(document?.vitals)) {
      for (const vital of document.vitals) {
        if (vital && vital.label !== undefined && vital.value !== undefined) {
          vitals.push({
            label: String(vital.label),
            value: vital.value,
            unit: vital.unit ?? null,
          });
        }
      }
    }
  }

  const uniqueDiagnoses = Array.from(new Set(diagnoses)).slice(0, 3);
  const uniqueMedications = Array.from(new Set(medications)).slice(0, 5);

  const recentResults = vitals.slice(0, 6);
  const recentResultsText = recentResults.length > 0
    ? recentResults.map((vital) => `${vital.label}: ${vital.value}${vital.unit ? ` ${vital.unit}` : ''}`).join('; ')
    : 'No structured vital results were available from the uploaded documents.';

  const ocrSignal = ocrTexts.length > 0
    ? 'The uploaded OCR text suggests laboratory and clinical report content was available for review.'
    : 'No OCR text was available for review.';

  return {
    summary: `Health summary based on ${documents.length} document(s). ${ocrSignal}`,
    sections: [
      {
        heading: 'Current Health Status',
        content: `The available documents suggest recent clinical review of medical data across ${documents.length} report(s). ${ocrSignal}`,
      },
      {
        heading: 'Identified Medical Conditions',
        content: uniqueDiagnoses.length > 0
          ? `Documented diagnoses include: ${uniqueDiagnoses.join('; ')}.`
          : 'No explicit diagnoses were available in the provided documents.',
      },
      {
        heading: 'Recent Test Results Summary',
        content: recentResultsText,
      },
      {
        heading: 'Areas of Concern',
        content: 'Some results in the provided report appear abnormal or incomplete and should be reviewed with a clinician, especially if you have symptoms or worsening changes.',
      },
      {
        heading: 'Recommendations for Improvement',
        content: uniqueMedications.length > 0
          ? `Review the listed medications and abnormal test results with your care team, and continue any prescribed treatment as directed: ${uniqueMedications.join('; ')}.`
          : 'Review the report with your clinician, repeat abnormal tests if advised, and seek urgent care if you develop severe symptoms or feel significantly worse.',
      },
    ],
  };
}


// Prompt for overall health summary (club synonyms, avoid duplicates)
export async function callHealthSummaryPrompt(params: { documentsData: any, ocrTexts?: string[] }) {
  const ocrTextsArray = Array.isArray(params.ocrTexts) ? params.ocrTexts : [];
  // SYSTEM/INSTRUCTION: strict JSON-only prompt for comprehensive health summary
  const prompt = `SYSTEM/INSTRUCTION:
You are a senior medical analyst. STRICTLY RETURN VALID JSON ONLY (no markdown, no commentary, no extra fields). Follow the JSON schema and rules below exactly.

SCHEMA (required top-level fields)

SCHEMA (required top-level fields)
{
  "overall_summary": "<string>",               1–2 concise sentences summarizing overall health
  "overall_feedback": "<string|null>",         1 short paragraph (optional)
   "sections": [                                REQUIRED: array of section objects for display
    { "heading": "<string>", "content": "<string>" }
  ],
    Optional structured lab section keys allowed (e.g. "blood_tests") — but ALWAYS include a human-readable "sections" array.
 }


 OUTPUT RULES (must follow)
 1. "sections" MUST be present and cover these headings in this order when data exists: "Current Health Status", "Identified Medical Conditions", "Recent Test Results Summary", "Areas of Concern", "Recommendations for Improvement". If a heading has no info, set its content to "No information available."
 2. Each "sections[].content" must be 2–3 complete sentences (roughly 40–120 words), professional and evidence‑based, not a one-line fragment.
 3. Use cautious language: use phrases like "may indicate", "appears to show", "suggests". Do NOT assert diagnoses.
 4. For lab/test results, include structured details under an optional blood_tests object (you may include numbers/units/status). Also include a concise human-friendly line in the corresponding "Recent Test Results Summary" section.
 5. In the "Recommendations for Improvement" section, provide concrete, actionable advice for the user (e.g., specific lifestyle changes, monitoring steps, or next actions). Do NOT just say "consult your doctor". Instead, start with a specific action, then add "but discuss with your doctor first" or similar. Example: "Increase daily exercise and reduce sugar intake, but discuss with your doctor first."
 6. Base ALL statements only on the provided documents and OCR text. Do not invent facts.
 7. If you derive an interpretation from a specific document, optionally include the document id in parentheses at the end of that sentence (e.g. "(doc: abc123)").
8. If fields are missing, explicitly state "No information available" for that section.
 9. Keep JSON keys exactly as shown. Return only the JSON object.


 EXAMPLE (single-line JSON for clarity — the model must produce a similar structured object):
 {"overall_summary":"Overall Health: Fair — mild anemia and mild kidney impairment with elevated glucose.","overall_feedback":"Your labs show mild anemia and borderline kidney function; follow-up testing and clinician review recommended.","sections":[{"heading":"Current Health Status","content":"The patient demonstrates mild anemia (low hemoglobin) and mildly impaired kidney markers. Vital signs are otherwise stable based on provided documents."},{"heading":"Identified Medical Conditions","content":"Mild iron-deficiency anemia is indicated by hemoglobin 10.7 g/dL. Creatinine 1.7 mg/dL suggests reduced kidney filtration that merits monitoring."},{"heading":"Recent Test Results Summary","content":"Hemoglobin 10.7 g/dL (low); RBC 3.6 million/pL (low); Creatinine 1.7 mg/dL (elevated); Fasting glucose 112 mg/dL (borderline). These values should be correlated with clinical history and repeat testing."},{"heading":"Areas of Concern","content":"Anemia may require iron supplementation and follow-up labs; elevated creatinine warrants assessment of kidney function; borderline hyperglycemia may need lifestyle modification and recheck."},{"heading":"Recommendations for Improvement","content":"Discuss iron therapy adherence and repeat CBC in 6–8 weeks. Evaluate kidney function with repeat creatinine and consider nephrology referral if persistent. Improve diet and exercise and monitor fasting glucose."}],"blood_tests":{"hemoglobin":{"value":10.7,"unit":"g/dL","status":"low","feedback":"Consider iron supplementation and follow-up CBC."},"creatinine":{"value":1.7,"unit":"mg/dL","status":"elevated","feedback":"Repeat and assess kidney function."}}}


 Documents Metadata:
 ${JSON.stringify(params.documentsData)}

 OCR Text:
 ${ocrTextsArray.join('\n\n')}`;

  const res = await fetch(`${AI_BASE}/openrouter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_TOKEN}` },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    console.warn(`Health summary prompt failed: ${res.status}. Falling back to a local summary.`);
    return buildFallbackHealthSummary(params);
  }

  let data: any = await res.json();

  // Normalize the AI response into a stable shape: { summary, sections, explanations }
  const normalize = (raw: any) => {
    const out: any = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...raw }
      : { summary: null as string | null, sections: [] as any[], explanations: undefined as any };

    if (!raw) return out;

    // If proxy already returned normalized shape, prefer it
    if (typeof raw.summary === 'string' || Array.isArray(raw.sections)) {
      out.summary = typeof raw.summary === 'string' ? raw.summary : null;
      out.sections = Array.isArray(raw.sections) ? raw.sections : [];
      out.explanations = raw.explanations ?? raw.explain ?? raw.items;
      return out;
    }

    // If raw is an array, treat as explanations
    if (Array.isArray(raw)) {
      out.explanations = raw;
      out.sections = raw.map((e: any) => ({ heading: e.label || e.heading || 'Finding', content: e.explanation || e.advice || '' }));
      out.summary = null;
      return out;
    }

    // Map common overall keys
    out.summary = raw.overall_summary || raw.overallSummary || raw.summary || raw.overall_feedback || raw.overallFeedback || null;
    out.explanations = raw.explanations ?? raw.explain ?? raw.items ?? undefined;

    // Build sections from remaining top-level keys
    const skipKeys = new Set(['overall_summary', 'overallSummary', 'overall_feedback', 'overallFeedback', 'overall_feedback', 'summary', 'explanations', 'explain', 'items']);
    for (const [k, v] of Object.entries(raw)) {
      if (skipKeys.has(k)) continue;
      const heading = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      if (!v) {
        out.sections.push({ heading, content: '' });
        continue;
      }
      if (typeof v === 'string') {
        out.sections.push({ heading, content: v });
        continue;
      }
      if (typeof v === 'object') {
        if (typeof (v as any).summary === 'string' || typeof (v as any).feedback === 'string') {
          const content = ((v as any).summary || '') + ((v as any).feedback ? '\n\n' + (v as any).feedback : '');
          out.sections.push({ heading, content });
          continue;
        }
        // Likely a map of tests; convert to readable lines
        const lines: string[] = [];
        for (const [subk, subv] of Object.entries(v)) {
          if (subv && typeof subv === 'object' && ('value' in (subv as any) || 'status' in (subv as any))) {
            const val = (subv as any).value;
            const unit = (subv as any).unit ? ` ${(subv as any).unit}` : '';
            const status = (subv as any).status ? ` (${(subv as any).status})` : '';
            const fb = (subv as any).feedback ? ` - ${(subv as any).feedback}` : '';
            lines.push(`${subk}: ${val ?? ''}${unit}${status}${fb}`);
          } else if (typeof subv === 'string' || typeof subv === 'number') {
            lines.push(`${subk}: ${String(subv)}`);
          }
        }
        if (lines.length > 0) {
          out.sections.push({ heading, content: lines.join('\n') });
          continue;
        }
        out.sections.push({ heading, content: JSON.stringify(v).slice(0, 200) });
        continue;
      }
      out.sections.push({ heading, content: String(v) });
    }

    // Synthesize summary if missing
    if (!out.summary) {
      if (typeof raw.overall_feedback === 'string') out.summary = raw.overall_feedback.slice(0, 1000);
      else if (out.sections.length > 0) out.summary = out.sections.slice(0, 3).map((s: any) => s.content).join(' ');
    }

    out.sections = Array.isArray(out.sections) ? out.sections : [];
    if (!out.summary) out.summary = null;
    return out;
  };

  // Perform a light validator + retry loop: if normalization produced no usable `summary` or `sections`,
  // ask the model one more time (up to 2 attempts) to return strictly valid JSON matching the schema.
  const MAX_ATTEMPTS = 2;
  let attempt = 0;
  let normalized = normalize(data);
  while (attempt < MAX_ATTEMPTS && (!normalized.summary || !(Array.isArray(normalized.sections) && normalized.sections.length > 0))) {
    attempt++;
    try {
      const correctionPrompt = prompt + `\n\nPREVIOUS_RESPONSE:\n${JSON.stringify(data).slice(0, 2000)}\n\nThe previous response appears invalid or missing required fields. RETURN ONLY VALID JSON matching the SCHEMA ABOVE. Do NOT include any explanation or markdown.`;
      const r = await fetch(`${AI_BASE}/openrouter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_TOKEN}` },
        body: JSON.stringify({ prompt: correctionPrompt }),
      });
      if (!r.ok) break;
      data = await r.json();
      normalized = normalize(data);
      if (normalized.summary && Array.isArray(normalized.sections) && normalized.sections.length > 0) break;
    } catch (e) {
      break;
    }
  }

  if (!normalized.summary || !(Array.isArray(normalized.sections) && normalized.sections.length > 0)) {
    return buildFallbackHealthSummary(params);
  }

  return normalized;
}

// Prompt for per-vital explanations (send only deduplicated vitals)
export async function callVitalExplainBatchPrompt(vitals: Array<{ label: string; value: string | number; unit: string | null }>) {
  const prompt = `You are a clinical data assistant for a medical application. STRICT REQUIREMENTS:

- OUTPUT MUST BE valid JSON ONLY (no markdown, no commentary, no surrounding text).
- Return a JSON ARRAY with the SAME NUMBER OF ITEMS and in the SAME ORDER as the input vitals array.
- Each array item MUST be an object with exactly these keys (strings must match exactly):
  1) "label": string — the vital name (copy from input if unchanged).
  2) "value": string|number — the measured value (copy from input if unchanged).
  3) "unit": string|null — the unit (copy from input if unchanged).
  4) "explanation": string — one concise sentence (max ~140 characters) describing what this value likely indicates clinically. Use cautious language (e.g., "may indicate", "suggests"). Do NOT assert diagnoses.
  5) "advice": string — one concise, actionable recommendation (max ~140 characters). Keep it practical and non-technical (e.g., "Reduce daily salt; recheck BP in 2 weeks"). If no specific advice, use exactly: "No specific advice".
  6) "status": string — one of the literal values: "normal", "warning", or "alert". Use "warning" for borderline or needs follow-up, "alert" for potentially urgent abnormalities.

Rules:
- Do NOT include any additional keys. Extra keys may be ignored by the caller.
- Preserve input order: the Nth output object must correspond to the Nth input vital.
- If you cannot determine an explanation/advice from the data, set:
    "explanation": "No explanation available (insufficient data)",
    "advice": "No specific advice",
    "status": "normal"
- If status is "alert", include language that the finding is potentially urgent in the explanation and set advice to a short next step (e.g., "Seek urgent clinical evaluation").
- Keep all text safe and non-alarming unless status=="alert".

EXAMPLE (for clarity; model should follow this structure exactly):
Input: [{"label":"Hemoglobin","value":10.7,"unit":"g/dL"},{"label":"Systolic BP","value":150,"unit":"mmHg"}]
Output: [
  {"label":"Hemoglobin","value":10.7,"unit":"g/dL","explanation":"Low hemoglobin may indicate mild anemia.","advice":"Consider iron-rich diet and repeat CBC in 6–8 weeks.","status":"warning"},
  {"label":"Systolic BP","value":150,"unit":"mmHg","explanation":"Elevated systolic blood pressure suggests hypertension.","advice":"Monitor BP at home and reduce salt intake; recheck in 1–2 weeks.","status":"alert"}
]

INPUT_DATA:
${JSON.stringify(vitals)}`;
  const res = await fetch(`${AI_BASE}/openrouter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_TOKEN}` },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error(`Vital explain batch prompt failed: ${res.status}`);
  return await res.json();
}

export async function callGenerateTitle(params: { ocrText: string; docType: string; metadata?: any }) {
  try {
    const res = await fetch(`${AI_BASE}/generate-title`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_TOKEN}` },
      body: JSON.stringify({ 
        ocr_text: params.ocrText, 
        doc_type: params.docType,
        metadata: params.metadata || null
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Generate title failed: ${res.status} ${detail}`);
    }
    return res.json();
  } catch (err: any) {
    const hint = `AI_BASE_URL=${AI_BASE}`;
    throw new Error(`Fetch to AI service failed. ${hint}. ${err?.message || err}`);
  }
}
