/**
 * Helper functions for processing and storing user vitals from extracted medical documents
 */

import { getCollection } from './db';
import type { VitalReading } from '@/../../packages/db/userVitals';
import { callVitalExplainBatchPrompt, callHealthSummaryPrompt } from '@/services/aiClient';
import type { OcrOutputDocument } from '@/../../packages/db/ocrOutputs';
import { vitalsLogger, healthSummaryLogger } from './server/logger';

interface VitalFromDocument {
  label: string;
  value: string | number;
  unit: string | null;
}

interface ProcessVitalsParams {
  userId: string;
  documentId: string;
  vitals: VitalFromDocument[];
  documentDate: Date | null;
  documentSource: string;
}

/**
 * Map vital labels to standardized types and categories
 */
export function normalizeVital(label: string): { type: string; category: string; normalizedLabel: string } {
  const lower = label.toLowerCase();

  // --- Vital Signs ---
  if (lower.includes('blood pressure') || lower.includes('bp sys') || lower.includes('systolic')) {
    return { type: 'blood_pressure_systolic', category: 'Vital Signs', normalizedLabel: 'Blood Pressure (Systolic)' };
  }
  if (lower.includes('bp dia') || lower.includes('diastolic')) {
    return { type: 'blood_pressure_diastolic', category: 'Vital Signs', normalizedLabel: 'Blood Pressure (Diastolic)' };
  }
  if (lower.includes('heart rate') || lower.includes('pulse')) {
    return { type: 'heart_rate', category: 'Vital Signs', normalizedLabel: 'Heart Rate' };
  }
  if (lower.includes('temperature') || lower.includes('temp')) {
    return { type: 'temperature', category: 'Vital Signs', normalizedLabel: 'Body Temperature' };
  }
  if (lower.includes('respiratory rate')) {
    return { type: 'respiratory_rate', category: 'Vital Signs', normalizedLabel: 'Respiratory Rate' };
  }
  if (lower.includes('oxygen saturation') || lower.includes('spo2')) {
    return { type: 'oxygen_saturation', category: 'Vital Signs', normalizedLabel: 'Oxygen Saturation' };
  }

  // --- Anthropometrics ---
  if (lower.includes('weight')) {
    return { type: 'weight', category: 'Anthropometrics', normalizedLabel: 'Weight' };
  }
  if (lower.includes('height')) {
    return { type: 'height', category: 'Anthropometrics', normalizedLabel: 'Height' };
  }
  if (lower.includes('bmi') || lower.includes('body mass')) {
    return { type: 'bmi', category: 'Anthropometrics', normalizedLabel: 'BMI' };
  }
  if (lower.includes('waist')) {
    return { type: 'waist_circumference', category: 'Anthropometrics', normalizedLabel: 'Waist Circumference' };
  }

  // --- Blood Sugar ---
  if (lower.includes('glucose') || lower.includes('blood sugar') || lower.includes('fbs') || lower.includes('fasting blood')) {
    return { type: 'blood_sugar_fasting', category: 'Blood Sugar', normalizedLabel: 'Fasting Blood Sugar' };
  }
  if (lower.includes('ppbs') || lower.includes('postprandial')) {
    return { type: 'blood_sugar_postprandial', category: 'Blood Sugar', normalizedLabel: 'Postprandial Blood Sugar' };
  }
  if (lower.includes('random blood sugar')) {
    return { type: 'blood_sugar_random', category: 'Blood Sugar', normalizedLabel: 'Random Blood Sugar' };
  }
  if (lower.includes('hba1c')) {
    return { type: 'hba1c', category: 'Blood Sugar', normalizedLabel: 'HbA1c' };
  }

  // --- Lipid Profile ---
  if (lower.includes('cholesterol') && lower.includes('total')) {
    return { type: 'cholesterol_total', category: 'Lipid Profile', normalizedLabel: 'Total Cholesterol' };
  }
  if (lower.includes('hdl')) {
    return { type: 'cholesterol_hdl', category: 'Lipid Profile', normalizedLabel: 'HDL Cholesterol' };
  }
  if (lower.includes('ldl')) {
    return { type: 'cholesterol_ldl', category: 'Lipid Profile', normalizedLabel: 'LDL Cholesterol' };
  }
  if (lower.includes('triglyceride')) {
    return { type: 'triglycerides', category: 'Lipid Profile', normalizedLabel: 'Triglycerides' };
  }
  if (lower.includes('vldl')) {
    return { type: 'cholesterol_vldl', category: 'Lipid Profile', normalizedLabel: 'VLDL Cholesterol' };
  }

  // --- Blood Tests ---
  if (lower.includes('rbc')) {
    return { type: 'rbc', category: 'Blood Tests', normalizedLabel: 'Red Blood Cells (RBC)' };
  }
  if (lower.includes('wbc')) {
    return { type: 'wbc', category: 'Blood Tests', normalizedLabel: 'White Blood Cells (WBC)' };
  }
  if (lower.includes('hemoglobin') || lower.includes('hb') || lower.includes('hgb')) {
    return { type: 'hemoglobin', category: 'Blood Tests', normalizedLabel: 'Hemoglobin' };
  }
  if (lower.includes('hematocrit')) {
    return { type: 'hematocrit', category: 'Blood Tests', normalizedLabel: 'Hematocrit' };
  }
  if (lower.includes('platelet')) {
    return { type: 'platelets', category: 'Blood Tests', normalizedLabel: 'Platelets' };
  }
  if (lower.includes('esr')) {
    return { type: 'esr', category: 'Blood Tests', normalizedLabel: 'ESR' };
  }

  // --- Liver Function ---
  if (lower.includes('sgpt') || lower.includes('alt')) {
    return { type: 'sgpt_alt', category: 'Liver Function', normalizedLabel: 'SGPT/ALT' };
  }
  if (lower.includes('sgot') || lower.includes('ast')) {
    return { type: 'sgot_ast', category: 'Liver Function', normalizedLabel: 'SGOT/AST' };
  }
  if (lower.includes('alkaline phosphatase')) {
    return { type: 'alkaline_phosphatase', category: 'Liver Function', normalizedLabel: 'Alkaline Phosphatase' };
  }
  if (lower.includes('bilirubin')) {
    return { type: 'bilirubin', category: 'Liver Function', normalizedLabel: 'Bilirubin' };
  }
  if (lower.includes('albumin')) {
    return { type: 'albumin', category: 'Liver Function', normalizedLabel: 'Albumin' };
  }
  if (lower.includes('globulin')) {
    return { type: 'globulin', category: 'Liver Function', normalizedLabel: 'Globulin' };
  }

  // --- Kidney Function ---
  if (lower.includes('creatinine')) {
    return { type: 'creatinine', category: 'Kidney Function', normalizedLabel: 'Creatinine' };
  }
  if (lower.includes('urea')) {
    return { type: 'urea', category: 'Kidney Function', normalizedLabel: 'Urea' };
  }
  if (lower.includes('bun')) {
    return { type: 'bun', category: 'Kidney Function', normalizedLabel: 'BUN' };
  }
  if (lower.includes('uric acid')) {
    return { type: 'uric_acid', category: 'Kidney Function', normalizedLabel: 'Uric Acid' };
  }
  if (lower.includes('sodium')) {
    return { type: 'sodium', category: 'Kidney Function', normalizedLabel: 'Sodium' };
  }
  if (lower.includes('potassium')) {
    return { type: 'potassium', category: 'Kidney Function', normalizedLabel: 'Potassium' };
  }
  if (lower.includes('chloride')) {
    return { type: 'chloride', category: 'Kidney Function', normalizedLabel: 'Chloride' };
  }

  // --- Thyroid Function ---
  if (lower.includes('tsh')) {
    return { type: 'tsh', category: 'Thyroid Function', normalizedLabel: 'TSH' };
  }
  if (lower.includes('t3')) {
    return { type: 't3', category: 'Thyroid Function', normalizedLabel: 'T3' };
  }
  if (lower.includes('t4')) {
    return { type: 't4', category: 'Thyroid Function', normalizedLabel: 'T4' };
  }

  // --- Other ---
  if (lower.includes('calcium')) {
    return { type: 'calcium', category: 'Other', normalizedLabel: 'Calcium' };
  }
  if (lower.includes('vitamin d')) {
    return { type: 'vitamin_d', category: 'Other', normalizedLabel: 'Vitamin D' };
  }
  if (lower.includes('iron')) {
    return { type: 'iron', category: 'Other', normalizedLabel: 'Iron' };
  }
  if (lower.includes('ferritin')) {
    return { type: 'ferritin', category: 'Other', normalizedLabel: 'Ferritin' };
  }
  if (lower.includes('crp')) {
    return { type: 'crp', category: 'Other', normalizedLabel: 'CRP' };
  }
  if (lower.includes('procalcitonin')) {
    return { type: 'procalcitonin', category: 'Other', normalizedLabel: 'Procalcitonin' };
  }

  // Default/other
  return {
    type: `other_${label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
    category: 'Other',
    normalizedLabel: label
  };
}

/**
 * Process vitals from a document and update user's vital records
 */
export async function processAndStoreVitals(params: ProcessVitalsParams): Promise<void> {
  const { userId, documentId, vitals, documentDate, documentSource } = params;

  vitalsLogger.info('Processing vitals', { userId, documentId, vitalsCount: vitals?.length || 0 });

  // Validate inputs
  if (!userId || !documentId) {
    vitalsLogger.error('Missing required parameters', { userId: !!userId, documentId: !!documentId });
    return;
  }
  if (!vitals || vitals.length === 0) {
    vitalsLogger.warn('No vitals to process', { documentId });
    return;
  }

  const vitalsCol = await getCollection<VitalReading>('userVitals');
  const now = new Date();

  // Filter and normalize vitals
  const validVitals = vitals
    .filter(vital => vital.label && vital.value !== null && vital.value !== undefined && vital.value !== '')
    .map(vital => {
      const { type, category, normalizedLabel } = normalizeVital(vital.label);
      return { ...vital, type, category, normalizedLabel };
    });

  if (validVitals.length === 0) {
    vitalsLogger.warn('No valid vitals to process', { documentId });
    return;
  }

  // Do NOT call OpenRouter for explanations here. Only upsert vitals; explanations will be handled in regenerateHealthSummary.

  // Upsert each vital without AI explanations (regeneration will attach explanations later).
  for (let i = 0; i < validVitals.length; i++) {
    const vital = validVitals[i];
    const { type, category, normalizedLabel } = vital as any;
    const existing = await vitalsCol.findOne({ userId, vitalType: type } as any);
    const vitalDate = documentDate || now;

    // Skip if we have a newer reading (with date validation)
    if (existing && existing.documentDate) {
      try {
        const existingDate = new Date(existing.documentDate);
        const currentDate = new Date(vitalDate);
        if (!isNaN(existingDate.getTime()) && !isNaN(currentDate.getTime())) {
          if (existingDate > currentDate) {
            continue;
          }
        }
      } catch (dateErr) {
        vitalsLogger.warn('Date comparison failed', { vitalType: type, error: dateErr });
      }
    }

    // No AI explanation assigned here; keep placeholders so regenerateHealthSummary can populate them
    const explanation = 'No explanation available yet';
    const advice = '';
    // Do not assume 'normal' here; leave `status` undefined until AI assigns one during regeneration
    let status: 'normal' | 'warning' | 'alert' | undefined = undefined;

    vitalsLogger.debug('Storing vital (no AI explanation yet)', {
      vitalType: type,
      label: normalizedLabel,
      value: vital.value,
      unit: vital.unit
    });

    const vitalReading: VitalReading = {
      id: `${userId}_${type}`,
      userId,
      vitalType: type,
      vitalCategory: category,
      label: normalizedLabel,
      value: vital.value,
      unit: vital.unit,
      documentId,
      documentDate: vitalDate,
      source: documentSource,
      explanation,
      advice,
      status,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    await vitalsCol.updateOne(
      { userId, vitalType: type } as any,
      { $set: vitalReading },
      { upsert: true }
    );

    vitalsLogger.info('Vital stored', { vitalType: type });
  }

  vitalsLogger.info('All vitals processed', { documentId });
}

/**
 * Regenerate health summary for a user based on all their documents
 */
export async function regenerateHealthSummary(userId: string): Promise<void> {
  console.log('[HEALTH_SUMMARY] Starting regeneration', { userId });
  healthSummaryLogger.info('Starting regeneration', { userId });

  if (!userId) {
    console.error('[HEALTH_SUMMARY] Missing userId');
    healthSummaryLogger.error('Missing userId');
    return;
  }

  try {
    // Get all active and archived documents for this user
    const docsCol = await getCollection('documents');
    const documents = await docsCol
      .find({
        ownerUserId: userId,
        status: { $in: ['active', 'archived'] }
      } as any)
      .sort({ createdAt: -1 })
      .toArray();

    console.log('[HEALTH_SUMMARY] Documents found', { count: documents.length, userId });
    healthSummaryLogger.info('Documents found', { count: documents.length });

    if (documents.length === 0) {
      return; // No documents to analyze
    }

    // NOTE: do not delete existing `userVitals` here. Removing documents can cause loss of
    // previously computed AI explanations/advice when source documents are removed. Instead,
    // we'll preserve existing vitals and merge with newly aggregated vitals below.

    try {
      const summaryCol = await getCollection('userHealthSummary');
      const delSummary = await summaryCol.deleteMany({ userId } as any);
      healthSummaryLogger.info('Deleted old userHealthSummary', { userId, deletedCount: delSummary?.deletedCount ?? 0 });
    } catch (delErr) {
      healthSummaryLogger.warn('Failed to delete old userHealthSummary', { userId, error: delErr });
    }

    // Aggregate all vitals for the user across all documents
    let allVitals: any[] = [];
    for (const doc of documents) {
      const metaVitals = Array.isArray((doc as any).metadata?.vitals) ? (doc as any).metadata.vitals : [];
      if (metaVitals.length > 0) {
        allVitals.push(...metaVitals.map((v: any) => ({
          ...v,
          documentId: doc.id,
          documentDate: doc.createdAt ?? null,
          documentSource: doc.docType || 'Medical Document'
        })));
      }
    }
    healthSummaryLogger.info('Aggregated vitals for user', { userId, count: allVitals.length });
    // Normalize and deduplicate vitals by type
    const normalizedVitals = allVitals
      .filter(vital => vital.label && vital.value !== null && vital.value !== undefined && vital.value !== '')
      .map(vital => {
        const { type, category, normalizedLabel } = normalizeVital(vital.label);
        return { ...vital, type, category, normalizedLabel };
      });
    // Deduplicate by type (keep latest by documentDate)
    const dedupedVitalsMap = new Map<string, any>();
    for (const vital of normalizedVitals) {
      const key = vital.type;
      if (!dedupedVitalsMap.has(key) || (vital.documentDate && dedupedVitalsMap.get(key).documentDate < vital.documentDate)) {
        dedupedVitalsMap.set(key, vital);
      }
    }
    const dedupedVitals = Array.from(dedupedVitalsMap.values());
    healthSummaryLogger.info('Deduplicated vitals for user', { userId, count: dedupedVitals.length });
    // If no vitals were found in document metadata (e.g. after a document was removed),
    // fall back to existing `userVitals` entries so we can retain previously computed
    // explanations/advice. Merge existing vitals for the user if dedupedVitals is empty.
    if (dedupedVitals.length === 0) {
      try {
        const vitalsCol = await getCollection<VitalReading>('userVitals');
        const existing = await vitalsCol.find({ userId }).toArray();
        if (existing && existing.length > 0) {
          healthSummaryLogger.info('Falling back to existing userVitals for explanations', { userId, count: existing.length });
          // Map existing vitals into the same shape expected by the AI batch prompt
          const fallback = existing.map((e: any) => ({
            ...e,
            label: e.label || e.vitalType,
            value: e.value,
            unit: e.unit
          }));
          // Use fallback as dedupedVitals moving forward
          for (const f of fallback) {
            const { type, category, normalizedLabel } = normalizeVital(f.label || f.vitalType || 'other');
            f.type = f.type || type;
            f.category = f.category || category;
            f.normalizedLabel = f.normalizedLabel || normalizedLabel;
          }
          // Replace dedupedVitals
          // Note: existing records already contain explanation/advice/status which will be preserved
          // during the upsert below when AI does not return new values.
          dedupedVitals.push(...fallback);
        }
      } catch (fbErr) {
        healthSummaryLogger.warn('Failed to fall back to existing userVitals', { userId, error: String(fbErr) });
      }
    }
    // Send batch prompt for all deduped vitals and log prompt/response
    let explanations: any[] = [];
    const summaryPrompt = {
      vitals: dedupedVitals.map(v => ({ label: v.normalizedLabel, value: v.value, unit: v.unit }))
    };
    healthSummaryLogger.info('PROMPT_SENT', { prompt: summaryPrompt });
    // Call AI service and normalize response to an explanations array.
    let aiResp: any = null;
    try {
      aiResp = await callVitalExplainBatchPrompt(summaryPrompt.vitals);
      healthSummaryLogger.info('ANSWER_RECEIVED', { response: aiResp });

      // Helper: if a field contains a JSON string that encodes an array, try to parse it
      const tryParseArrayFromString = (candidate: any): any[] | null => {
        if (!candidate || typeof candidate !== 'string') return null;
        const trimmed = candidate.trim();
        // Heuristic: starts with [ -> parse
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
            // If parsed is an object with an explanations/response array, prefer that
            if (Array.isArray((parsed as any).explanations)) return (parsed as any).explanations;
            if (Array.isArray((parsed as any).response?.explanations)) return (parsed as any).response.explanations;
          } catch (e) {
            // ignore parse errors
          }
        }
        return null;
      };

      if (Array.isArray(aiResp)) {
        explanations = aiResp;
      } else if (Array.isArray(aiResp.explanations)) {
        explanations = aiResp.explanations;
      } else if (Array.isArray(aiResp.response?.explanations)) {
        explanations = aiResp.response.explanations;
      } else {
        // If the AI returned text containing JSON (common), attempt to parse it
        const candidates = [aiResp, aiResp.response, aiResp.response?.summary, aiResp.summary, aiResp.answer, aiResp.output];
        let foundArr: any[] | null = null;
        for (const c of candidates) {
          if (!c) continue;
          if (Array.isArray(c)) { foundArr = c; break; }
          if (Array.isArray(c.explanations)) { foundArr = c.explanations; break; }
          // Try parsing if it's a string containing JSON
          const parsed = tryParseArrayFromString(c);
          if (Array.isArray(parsed) && parsed.length > 0) { foundArr = parsed; break; }
        }
        if (foundArr) explanations = foundArr;
        else {
          // Attempt to pick the first array-valued property as a last-resort fallback
          const found = Object.values(aiResp).find((v: any) => Array.isArray(v));
          explanations = Array.isArray(found) ? found : [];
        }
      }
      // If still empty, create safe defaults
      if (!Array.isArray(explanations) || explanations.length === 0) {
        explanations = dedupedVitals.map(v => ({ explanation: 'No explanation available (AI returned unexpected format).', advice: '' }));
      }
    } catch (err) {
      healthSummaryLogger.error('AI batch explanation failed', { error: err });
      explanations = dedupedVitals.map(v => ({
        explanation: 'No explanation available (AI service error).',
        advice: 'Consult your doctor for more information.'
      }));
    }
    // Defensive: If explanations length doesn't match, try to align by label/type
    if (explanations.length !== dedupedVitals.length) {
      healthSummaryLogger.warn('AI explanations length mismatch', {
        userId,
        explanationsLength: explanations.length,
        vitalsLength: dedupedVitals.length
      });
      // Try to build a map by label/type for best-effort matching
      const aiMap = new Map();
      for (const ai of explanations) {
        if (ai && (ai.label || ai.type)) {
          aiMap.set((ai.label || ai.type || '').toLowerCase(), ai);
        }
      }
      explanations = dedupedVitals.map(v => {
        const key = (v.normalizedLabel || v.type || '').toLowerCase();
        return aiMap.get(key) || {};
      });
    }

    // Upsert each vital with its explanation/advice, with extra logging
    const vitalsCol = await getCollection<VitalReading>('userVitals');
    const now = new Date();

    // Fetch existing vitals to allow falling back to prior explanations when AI returns none
    const existingVitalsArray = await vitalsCol.find({ userId }).toArray();
    const existingMap = new Map<string, any>();
    for (const ev of existingVitalsArray) {
      existingMap.set(ev.vitalType, ev);
    }

    for (let i = 0; i < dedupedVitals.length; i++) {
      const vital = dedupedVitals[i];
      const { type, category, normalizedLabel } = vital as any;
      const aiResult = explanations[i] || {};
      // Prefer AI-provided fields; fall back to existing stored values if AI omitted them
      const existing = existingMap.get(type) || {};
      const explanation = aiResult.explanation || aiResult?.explain || existing.explanation || 'No explanation available';
      const advice = aiResult.advice || existing.advice || '';
      // Normalize and validate status returned by AI. Accept common synonyms and map to one of the
      // canonical values: 'normal', 'warning', 'alert'. If AI returns an unexpected value, fall back
      // to undefined so we don't incorrectly label all vitals as 'normal'.
      const _rawStatus = aiResult.status ?? aiResult.severity ?? aiResult.level ?? undefined;
      const parseStatus = (s: any): 'normal' | 'warning' | 'alert' | undefined => {
        if (s === null || s === undefined) return undefined;
        const st = String(s).toLowerCase().trim();
        if (['normal', 'ok', 'within range', 'stable'].includes(st)) return 'normal';
        if (['warning', 'borderline', 'elevated', 'high', 'low', 'abnormal', 'mild'].includes(st)) return 'warning';
        if (['alert', 'critical', 'urgent', 'severe'].includes(st)) return 'alert';
        return undefined;
      };
      const status = parseStatus(_rawStatus) ?? existing.status;
      // Log mapping for debug
      healthSummaryLogger.debug('Mapping vital to explanation', {
        vitalType: type,
        label: normalizedLabel,
        value: vital.value,
        unit: vital.unit,
        explanation,
        advice,
        aiResult
      });
      const vitalReading: VitalReading = {
        id: `${userId}_${type}`,
        userId,
        vitalType: type,
        vitalCategory: category,
        label: normalizedLabel,
        value: vital.value,
        unit: vital.unit,
        documentId: vital.documentId,
        documentDate: vital.documentDate,
        source: vital.documentSource,
        explanation,
        advice,
        status,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };
      await vitalsCol.updateOne(
        { userId, vitalType: type } as any,
        { $set: vitalReading },
        { upsert: true }
      );
      // Only log vitals storage in vitalsLogger, not healthSummaryLogger
      vitalsLogger.info('Vital stored', { vitalType: type, userId });
    }
    vitalsLogger.info('All user vitals processed', { userId });

    // Get OCR text for all documents
    const ocrCol = await getCollection<OcrOutputDocument>('ocrOutputs');
    const ocrTexts: string[] = [];
    let lastDocDate: Date | null = null;

    // Try to get all OCRs by userId first
    let ocrUserRecords = await ocrCol.find({ userId }).toArray();
    console.log('[HEALTH_SUMMARY] OCR query by userId', { userId, found: ocrUserRecords.length });
    healthSummaryLogger.info('OCR query by userId', { userId, found: ocrUserRecords.length });
    if (ocrUserRecords.length === 0) {
      // Fallback: try ownerId
      ocrUserRecords = await ocrCol.find({ ownerId: userId }).toArray();
      console.log('[HEALTH_SUMMARY] OCR fallback by ownerId', { userId, found: ocrUserRecords.length });
      healthSummaryLogger.info('OCR fallback by ownerId', { userId, found: ocrUserRecords.length });
    }
    if (ocrUserRecords.length > 0) {
      for (const ocr of ocrUserRecords) {
        if (ocr.text) ocrTexts.push(ocr.text);
      }
      if (ocrTexts.length > 0) {
        lastDocDate = documents.reduce((acc, doc) => {
          if (!acc || doc.createdAt > acc) return doc.createdAt;
          return acc;
        }, null as Date | null);
      }
    }

    // If still no OCRs, try per-document fallback
    if (ocrTexts.length === 0) {
      for (const doc of documents) {
        let ocr = await ocrCol.findOne({ documentId: doc.id, versionId: doc.versionId } as any);
        if (!ocr) ocr = await ocrCol.findOne({ id: `${doc.id}:${doc.versionId}` } as any);
        if (!ocr) ocr = await ocrCol.findOne({ documentId: doc.id } as any);
        // Additional fallback: many importers store the OCR under storageKey or use storageKey as id
        if (!ocr && (doc.storageKey || doc.storage_key)) {
          const storageKey = (doc.storageKey || (doc as any).storage_key) as string;
          try {
            if (storageKey) {
              if (!ocr) ocr = await ocrCol.findOne({ storageKey } as any);
              if (!ocr) ocr = await ocrCol.findOne({ id: storageKey } as any);
            }
          } catch (fkErr) {
            // ignore lookup errors
          }
        }

        if (ocr && ocr.text) {
          ocrTexts.push(ocr.text);
          // Log which doc matched which OCR record for easier debugging
          healthSummaryLogger.debug('OCR matched for document', { documentId: doc.id, matchedId: ocr.id, storageKey: ocr.storageKey });
          if (!lastDocDate || doc.createdAt > lastDocDate) {
            lastDocDate = doc.createdAt;
          }
        }
      }
      healthSummaryLogger.info('OCR per-document fallback', { found: ocrTexts.length });
    }

    console.log('[HEALTH_SUMMARY] Total OCR texts found', { count: ocrTexts.length });
    if (ocrTexts.length === 0) {
      console.error('[HEALTH_SUMMARY] No OCR text available - exiting early');
      healthSummaryLogger.warn('No OCR text available after all fallbacks');
      return; // No OCR text available
    }

    // Compose documentsData for AI summary prompt
    const documentsData = documents.map((doc: any) => {
      return {
        id: doc.id,
        docType: doc.docType,
        createdAt: doc.createdAt,
        vitals: Array.isArray(doc.metadata?.vitals) ? doc.metadata.vitals : [],
        labs: doc.metadata?.labs || [],
        diagnosis: doc.metadata?.diagnosis || '',
        medications: doc.metadata?.medications || [],
        summary: doc.metadata?.summary || ''
      };
    });

    console.log('[HEALTH_SUMMARY] Calling AI service', { documentCount: documents.length, ocrTextsCount: ocrTexts.length });
    healthSummaryLogger.info('Calling AI service', { documentCount: documents.length });
    const aiResult = await callHealthSummaryPrompt({ documentsData, ocrTexts });

    console.log('[HEALTH_SUMMARY] AI response received', {
      summaryLength: aiResult.summary?.length || 0,
      sectionsCount: aiResult.sections?.length || 0
    });
    healthSummaryLogger.debug('AI response received', {
      summaryLength: aiResult.summary?.length || 0,
      sectionsCount: aiResult.sections?.length || 0
    });

    // Store in database (with defensive normalization)
    console.log('[HEALTH_SUMMARY] Storing in database', { userId, documentCount: documents.length });
    healthSummaryLogger.info('Storing in database', { userId });
    const summaryCol = await getCollection('userHealthSummary');

    // Defensive normalization: ensure we never write null summary/sections to DB
    const aiAny = aiResult as any;
    let normalizedSummary: string | null = null;
    let normalizedSections: Array<{ heading: string; content: string }> = [];

    try {
      if (aiAny && typeof aiAny.summary === 'string' && aiAny.summary.trim().length > 0) {
        normalizedSummary = aiAny.summary;
      }

      if (Array.isArray(aiAny?.sections) && aiAny.sections.length > 0) {
        normalizedSections = aiAny.sections.map((s: any) => ({ heading: s.heading || s.label || 'Section', content: s.content || s.text || '' }));
      }

      // If summary missing, try to synthesize from explanations
      if (!normalizedSummary) {
        if (Array.isArray(aiAny?.explanations) && aiAny.explanations.length > 0) {
          const pieces = aiAny.explanations.slice(0, 3).map((e: any) => {
            const lbl = e.label || e.heading || '';
            const expl = e.explanation || e.advice || '';
            return (lbl ? `${lbl}: ${expl}` : expl).trim();
          }).filter((p: string) => p && p.length > 0);
          if (pieces.length > 0) normalizedSummary = pieces.join(' ');
        }
      }

      // If still no sections but explanations exist, convert them
      if (normalizedSections.length === 0 && Array.isArray(aiAny?.explanations) && aiAny.explanations.length > 0) {
        normalizedSections = aiAny.explanations.map((e: any) => ({ heading: e.label || e.heading || 'Finding', content: e.explanation || e.advice || '' }));
      }
    } catch (e) {
      healthSummaryLogger.warn('Failed to normalize AI result', { userId, error: String(e) });
    }

    // Final fallbacks
    if (!normalizedSummary) normalizedSummary = 'No summary generated';
    if (!Array.isArray(normalizedSections)) normalizedSections = [];

    await summaryCol.updateOne(
      { userId } as any,
      {
        $set: {
          id: userId,
          userId,
          summary: normalizedSummary,
          sections: normalizedSections,
          generatedAt: new Date(),
          documentCount: documents.length,
          lastDocumentDate: lastDocDate
        }
      },
      { upsert: true }
    );

    console.log('[HEALTH_SUMMARY] Health summary stored successfully', { userId, documentCount: documents.length });
    healthSummaryLogger.info('Health summary stored successfully');
  } catch (err) {
    console.error('[HEALTH_SUMMARY] Regeneration failed', { userId, error: err });
    healthSummaryLogger.error('Regeneration failed', { userId, error: err });
    throw err;
  }
}

