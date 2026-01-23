import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import type { JobDocument, DocumentDocument, OcrOutputDocument } from '@/../../packages/db/index';
import { getIdentity } from '@/lib/auth';
import { canDownloadDocument } from '@/lib/permissions';
import { randomUUID } from 'crypto';
import { callOcr } from '@/services/aiClient';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(()=>({}));
  const documentId = String(body?.documentId || '');
  if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 });

  const { role, actorId } = await getIdentity();
  const docsCol = await getCollection<DocumentDocument>('documents');
  const doc = await docsCol.findOne({ id: documentId } as any);
  if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const allowed = await canDownloadDocument({ role, docId: documentId, actorId });
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Always re-run OCR for retry to ensure latest content
  const ocrCol = await getCollection<OcrOutputDocument>('ocrOutputs');
  let freshOcr: { text: string; engine?: string; confidence?: number } | null = null;
  try {
    const res = await callOcr({ storageKey: doc.storageKey });
    freshOcr = { text: res?.text || '', engine: res?.engine, confidence: res?.confidence };
  } catch (e: any) {
    // If OCR service fails, fall back to last stored text
    const existingOcr = await ocrCol.findOne({ id: `${documentId}:${doc.versionId}` } as any);
    freshOcr = { text: existingOcr?.text || '', engine: existingOcr?.engine, confidence: existingOcr?.confidence };
  }

  if (freshOcr && freshOcr.text) {
    const ocrDoc: OcrOutputDocument = {
      id: `${documentId}:${doc.versionId}`,
      documentId,
      versionId: doc.versionId,
      storageKey: doc.storageKey,
      text: freshOcr.text,
      engine: freshOcr.engine,
      confidence: freshOcr.confidence,
      createdAt: new Date(),
    } as any;
    await ocrCol.updateOne({ id: ocrDoc.id } as any, { $set: ocrDoc }, { upsert: true });
  }

  const jobsCol = await getCollection<JobDocument>('jobs');
  const job: JobDocument = {
    id: randomUUID(),
    type: 'summarize-doc',
    status: 'pending',
    priority: 3,
    attempts: 0,
    payload: { documentId, profileId: doc.profileId, ocrText: freshOcr?.text },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
  await jobsCol.insertOne(job as any);
  return NextResponse.json({ ok: true }, { status: 200 });
}
