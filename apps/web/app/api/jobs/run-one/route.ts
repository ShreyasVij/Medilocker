export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { getCollection } from '@/lib/db';
import type { JobDocument } from '@/../../packages/db/jobs';
import type { DocumentDocument } from '@/../../packages/db/documents';
import { createDownloadUrl } from '@/services/storageClient';
import { logAudit } from '@/lib/audit';
import { callExtract, callExtractMulti, callSummarize } from '@/services/aiClient';
import type { OcrOutputDocument } from '@/../../packages/db/ocrOutputs';

function isAuthorized(req: NextRequest): boolean {
  const token = req.headers.get('x-internal-token');
  return !!token && token === process.env.INTERNAL_AUTH_TOKEN;
}

async function toBase64FromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString('base64');
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const jobsCol = await getCollection<JobDocument>('jobs');
  const docsCol = await getCollection<DocumentDocument>('documents');
  const now = new Date();

  // Process in order: ingest -> extract-structured -> summarize-doc
  const job = await jobsCol.findOneAndUpdate(
    { status: 'pending', type: { $in: ['ingest', 'extract-structured', 'summarize-doc'] } } as any,
    { $set: { status: 'processing', startedAt: now, updatedAt: now } },
    { sort: { priority: -1, createdAt: 1 }, returnDocument: 'after' } as any,
  );

  const doc = (job as any)?.value as JobDocument | null;
  if (!doc) return NextResponse.json({ processed: null }, { status: 200 });

  try {
    if (doc.type === 'ingest') {
        const payload: any = doc.payload || {};
        const documentId: string | undefined = payload.documentId;
        const versionId: string | undefined = payload.versionId;
        const storageKey: string | undefined = payload.storageKey;
        const storageKeys: string[] | undefined = Array.isArray(payload.storageKeys) ? payload.storageKeys : undefined;
        if (!documentId || !versionId) throw new Error('missing payload');

        let extract: any;
        if (storageKeys && storageKeys.length > 0) {
          // Multi-file: sign all, fetch base64, and call multi-extract
          const files = [] as { fileName: string; contentBase64: string }[];
          for (let i = 0; i < storageKeys.length; i++) {
            const sk = storageKeys[i];
            const signed = await createDownloadUrl({ storageKey: sk, expiresIn: 900 });
            const base64 = await toBase64FromUrl(signed);
            const name = `${documentId}-page-${i + 1}`;
            files.push({ fileName: name, contentBase64: base64 });
          }
          extract = await callExtractMulti({ files });
        } else if (storageKey) {
          // Single-file path (existing behavior)
          const signed = await createDownloadUrl({ storageKey, expiresIn: 900 });
          const base64 = await toBase64FromUrl(signed);
          const name = `${documentId}.bin`;
          extract = await callExtract({ fileName: name, contentBase64: base64 });
        } else {
          throw new Error('missing storageKey(s)');
        }
      const data = extract?.data || {};

      // Mark job completed via existing completion route
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
      if (!baseUrl) {
        throw new Error('Base URL not configured');
      }
      const completeRes = await fetch(`${baseUrl}/api/jobs/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_AUTH_TOKEN || '' },
        body: JSON.stringify({
          id: doc.id,
          status: 'completed',
          ocrText: data.raw_text || '',
          engine: 'ocr.space',
          confidence: 0.9,
          detectedType: data.classification || undefined,
        }),
      });
      if (!completeRes.ok) throw new Error(`complete failed: ${completeRes.status}`);
    } else if (doc.type === 'extract-structured') {
      const payload: any = doc.payload || {};
      const documentId: string | undefined = payload.documentId;
      const ocrText: string | undefined = payload.ocrText;
      if (!documentId || !ocrText) throw new Error('missing documentId or ocrText');

      // Call AI extract with OCR text as base64 file
      const textBase64 = Buffer.from(ocrText, 'utf-8').toString('base64');
      const extractRes = await callExtract({ 
        fileName: `${documentId}-ocr.txt`, 
        contentBase64: textBase64 
      });
      const docMeta = extractRes || {};

      // Complete the job with the extracted metadata
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
      if (!baseUrl) {
        throw new Error('Base URL not configured');
      }
      const completeRes = await fetch(`${baseUrl}/api/jobs/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_AUTH_TOKEN || '' },
        body: JSON.stringify({
          id: doc.id,
          status: 'completed',
          docMeta: docMeta,
        }),
      });
      if (!completeRes.ok) throw new Error(`complete failed: ${completeRes.status}`);
    } else if (doc.type === 'summarize-doc') {
      const payload: any = doc.payload || {};
      const documentId: string | undefined = payload.documentId;
      if (!documentId) throw new Error('missing documentId');
      const docMeta = await docsCol.findOne({ id: documentId } as any);
      if (!docMeta) throw new Error('document not found');

      // Prefer OCR text provided in the job payload; else fallback to stored OCR output
      let ocrText: string | undefined = typeof payload.ocrText === 'string' ? payload.ocrText : undefined;
      if (!ocrText && docMeta.versionId) {
        try {
          const ocrCol = await getCollection<OcrOutputDocument>('ocrOutputs');
          const existing = await ocrCol.findOne({ id: `${documentId}:${docMeta.versionId}` } as any);
          ocrText = existing?.text || undefined;
        } catch {}
      }

      // Build structured data for the summarization pipeline
      const meta: any = (docMeta as any).metadata || {};
      const structured = {
        patient_name: meta.patient_name ?? null,
        dob: meta.dob ?? null,
        report_date: meta.report_date ?? null,
        doctor_name: meta.doctor_name ?? null,
        diagnosis: meta.diagnosis ?? null,
        medications: Array.isArray(meta.medications) ? meta.medications : [],
        vitals: Array.isArray(meta.vitals) ? meta.vitals : [],
        raw_text: ocrText || '',
      };

      const sumRes = await callSummarize({ structuredData: structured });
      const docSummary = sumRes?.summary ?? undefined;
      const explanations = Array.isArray(sumRes?.explanations) ? sumRes.explanations : undefined;
      const confidence = typeof sumRes?.confidence === 'number' ? sumRes.confidence : 0.7;

      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
      if (!baseUrl) {
        throw new Error('Base URL not configured');
      }
      const completeRes = await fetch(`${baseUrl}/api/jobs/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_AUTH_TOKEN || '' },
        body: JSON.stringify({
          id: doc.id,
          status: 'completed',
          docSummary,
          explanations,
          confidence,
        }),
      });
      if (!completeRes.ok) throw new Error(`complete failed: ${completeRes.status}`);
    }

    await logAudit(request, {
      actorId: 'system-worker',
      action: 'admin.action',
      target: doc.id,
      targetType: 'system',
      resourceId: doc.id,
      result: 'success',
      metadata: { event: 'job.processed', type: doc.type },
    });
    return NextResponse.json({ processed: { id: doc.id, type: doc.type } }, { status: 200 });
  } catch (err: any) {
    await jobsCol.updateOne({ id: doc.id } as any, { $set: { status: 'failed', updatedAt: new Date(), error: String(err?.message || err) } });
    return NextResponse.json({ error: err?.message || 'failed' }, { status: 500 });
  }
}
