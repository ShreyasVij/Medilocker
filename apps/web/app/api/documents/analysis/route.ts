import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import type { ClassificationDocument, OcrOutputDocument, DocumentDocument, SummaryDocument } from '@/../../packages/db/index';
import { canDownloadDocument } from '@/lib/permissions';
import { getIdentity } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const documentId = request.nextUrl.searchParams.get('documentId');
  if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 });

  const { role, actorId } = await getIdentity();
  const docsCol = await getCollection<DocumentDocument>('documents');
  const doc = await docsCol.findOne({ id: documentId } as any);
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const allowed = await canDownloadDocument({ role, docId: documentId, actorId });
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const classCol = await getCollection<ClassificationDocument>('classification');
  const ocrCol = await getCollection<OcrOutputDocument>('ocrOutputs');
  const summariesCol = await getCollection<SummaryDocument>('summaries');

  const classification = await classCol.findOne({ documentId } as any);
  const ocr = await ocrCol.findOne({ id: `${documentId}:${doc.versionId}` } as any);
  let summaryDoc = await summariesCol.findOne({ documentId, type: 'doc' } as any);
  if (!summaryDoc) summaryDoc = await summariesCol.findOne({ id: documentId, type: 'doc' } as any);
  let summary: any = summaryDoc?.content || null;
  // Backward compatibility: some records may store a JSON string or markdown
  if (typeof summary === 'string') {
    try { summary = JSON.parse(summary); } catch {
      // Wrap markdown string into structured shape
      summary = { in_depth_summary: summary, key_findings: [], recommendations: [], possible_follow_ups: [], lifestyle_advice: [], disclaimer: "This content is informational only. For proper follow-ups, contact a licensed medical practitioner." };
    }
  }

  return NextResponse.json({
    document: {
      id: doc.id,
      docType: doc.docType,
      tags: doc.tags || [],
      processingStatus: doc.processingStatus || 'completed',
      ocrAvailable: !!doc.ocrAvailable,
    },
    classification,
    ocr: ocr ? { engine: ocr.engine, confidence: ocr.confidence } : null,
    summary,
  }, { status: 200 });
}
