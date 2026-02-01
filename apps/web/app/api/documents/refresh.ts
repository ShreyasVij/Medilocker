import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { callOpenRouterSummary } from '@/services/aiClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { profileId } = await request.json();
  const documentsCol = await getCollection('documents');
  const ocrCol = await getCollection('ocrOutputs');
  const docs = await documentsCol.find({ profileId, status: 'active' }).toArray();
  const results = [];
  for (const doc of docs) {
    const ocr = await ocrCol.findOne({ id: `${doc.id}:${doc.versionId}` });
    // Only run OCR if ocrOutputs.text is empty
    if (!ocr || !ocr.text || ocr.text.trim() === '') {
      // ...trigger OCR pipeline here if needed...
      results.push({ docId: doc.id, action: 'ocr_needed' });
      continue;
    }
    // Always send prompt to OpenRouter for summary/advice
    const summary = await callOpenRouterSummary(ocr.text);
    results.push({ docId: doc.id, summary });
  }
  return NextResponse.json({ results });
}
