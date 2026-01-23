import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCollection } from '@/lib/db';
import type { JobDocument, OcrOutputDocument, DocumentDocument, ClassificationDocument, TrendDocument, SummaryDocument } from '@/../../packages/db/index';
import { logAudit } from '@/lib/audit';
import { randomUUID } from 'crypto';
import { processAndStoreVitals, regenerateHealthSummary } from '@/lib/vitalsProcessor';

function isAuthorized(req: NextRequest): boolean {
  const token = req.headers.get('x-internal-token');
  return !!token && token === process.env.INTERNAL_AUTH_TOKEN;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const id = body.id as string;
  const status = (body.status as string) || 'failed';
  const ocrText = (body.ocrText as string) || '';
  const engine = (body.engine as string) || undefined;
  const confidence = (body.confidence as number) || undefined;
  const detectedType = (body.detectedType as string) || undefined;
  const inferredTags = (body.inferredTags as string[]) || undefined;
  const observations = (body.observations as any[] | undefined) || undefined;
  const panel = (body.panel as string | undefined) || undefined;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const jobsCol = await getCollection<JobDocument>('jobs');
  const docsCol = await getCollection<DocumentDocument>('documents');
  const ocrCol = await getCollection<OcrOutputDocument>('ocrOutputs');
  const classCol = await getCollection<ClassificationDocument>('classification');
  const trendsCol = await getCollection<TrendDocument>('trends');
  const summariesCol = await getCollection<SummaryDocument>('summaries');
  // Log to file under apps/ai/logs/jobs_complete.log
  const logFilePath = path.resolve(process.cwd(), 'apps/ai/logs/jobs_complete.log');
  const log = (...args: any[]) => {
    try {
      const msg = `[JOBS/COMPLETE] ${new Date().toISOString()} ` + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      fs.appendFileSync(logFilePath, msg + '\n');
    } catch (e) {
      // fallback to console if file write fails
      // eslint-disable-next-line no-console
      console.log('[JOBS/COMPLETE]', ...args);
    }
  };

  const job = await jobsCol.findOne({ id } as any);
  if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const now = new Date();
  const updates: any = { status, updatedAt: now, finishedAt: now };
  if (status === 'failed' && body.error) updates.error = String(body.error);
  await jobsCol.updateOne({ id } as any, { $set: updates });

  const payload: any = job.payload || {};
  const documentId: string | undefined = payload.documentId;
  const versionId: string | undefined = payload.versionId;
  const storageKey: string | undefined = payload.storageKey;

  if (job.type === 'ingest') {
    if (status === 'completed' && documentId && versionId && storageKey) {
      // Get ownerUserId from payload (set during job creation), fallback to document lookup
      let docOwnerUserId = payload.ownerUserId;
      if (!docOwnerUserId) {
        try {
          const doc = await docsCol.findOne({ id: documentId } as any);
          docOwnerUserId = doc?.ownerUserId;
          // If the document record doesn't carry ownerUserId, try a fallback lookup by storageKey
          if (!docOwnerUserId && storageKey) {
            try {
              const docByStorage = await docsCol.findOne({ storageKey } as any);
              if (docByStorage) {
                docOwnerUserId = docByStorage?.ownerUserId;
                log('Found document by storageKey', { storageKey, documentId: docByStorage.id, ownerUserId: docOwnerUserId });
              }
            } catch (innerErr) {
              // ignore fallback failure
            }
          }
        } catch {}
      }
      const ocrDoc: OcrOutputDocument = {
        id: `${documentId}:${versionId}`,
        documentId,
        versionId,
        storageKey,
        text: ocrText || '',
        engine,
        confidence,
        // store user linkage; `userId` is the owner's user _id as string
        userId: docOwnerUserId,
        ownerId: docOwnerUserId,
        createdAt: now,
      };
      try {
        log('Upserting OCR output', { id: ocrDoc.id, textLength: (ocrText || '').length, userId: docOwnerUserId });
        const upsertResult = await ocrCol.updateOne({ id: ocrDoc.id } as any, { $set: ocrDoc }, { upsert: true });
        log('Upsert result', upsertResult);
      } catch (err: any) {
        log('ERROR upserting OCR output', { error: err?.message, stack: err?.stack });
      }
      try {
        await docsCol.updateOne({ id: documentId } as any, { $set: { processingStatus: 'completed', ocrAvailable: true, updatedAt: now } });
      } catch (err: any) {
        log('ERROR updating document status', { error: err?.message, stack: err?.stack });
      }
      // Enqueue follow-up jobs for classification, structured extraction, doc summary, and title generation (in parallel)
      const follow: JobDocument[] = [
        {
          id: randomUUID(),
          type: 'classify',
          status: 'pending',
          priority: 5,
          attempts: 0,
          payload: { documentId, versionId, ocrText, profileId: payload.profileId },
          createdAt: now,
          updatedAt: now,
        } as any,
        {
          id: randomUUID(),
          type: 'extract-structured',
          status: 'pending',
          priority: 4,
          attempts: 0,
          payload: { documentId, versionId, ocrText, profileId: payload.profileId },
          createdAt: now,
          updatedAt: now,
        } as any,
        {
          id: randomUUID(),
          type: 'summarize-doc',
          status: 'pending',
          priority: 3,
          attempts: 0,
          payload: { documentId, profileId: payload.profileId, ocrText },
          createdAt: now,
          updatedAt: now,
        } as any,
        {
          id: randomUUID(),
          type: 'generate-title',
          status: 'pending',
          priority: 6,
          attempts: 0,
          payload: { documentId, versionId, ocrText, profileId: payload.profileId },
          createdAt: now,
          updatedAt: now,
        } as any,
      ];
      await (jobsCol as any).insertMany(follow);
    } else if (documentId) {
      try {
        await docsCol.updateOne({ id: documentId } as any, { $set: { processingStatus: status === 'failed' ? 'failed' : 'processing', updatedAt: now } });
      } catch (err: any) {
        log('ERROR updating document status (non-completed)', { error: err?.message, stack: err?.stack });
      }
    }
  } else if (job.type === 'classify' && documentId) {
    // Persist classification results and update document tags/type if confident
    if (status === 'completed' && (detectedType || inferredTags || typeof confidence === 'number')) {
      const base: Partial<ClassificationDocument> = {
        detectedType,
        inferredTags,
        confidence: typeof confidence === 'number' ? confidence : 0.0,
        updatedAt: now,
      } as any;
      await classCol.updateOne(
        { documentId } as any,
        { $setOnInsert: { id: documentId, type: 'classification', createdAt: now }, $set: base },
        { upsert: true },
      );
      const updates: any = { updatedAt: now };
      if (typeof confidence === 'number' && confidence >= 0.7 && detectedType) updates.docType = detectedType as any;
      if (inferredTags && inferredTags.length) updates.tags = inferredTags;
      await docsCol.updateOne({ id: documentId } as any, { $set: updates });
    }
  } else if (job.type === 'extract-structured' && documentId) {
    // Save structured observations
    if (status === 'completed' && (observations || panel)) {
      await classCol.updateOne(
        { documentId } as any,
        {
          $setOnInsert: { id: documentId, type: 'lab', createdAt: now },
          $set: { panel: panel || 'general', observations, updatedAt: now },
        },
        { upsert: true },
      );
      // Persist document-level metadata if provided
      const docMeta = (body.docMeta ?? undefined) as any;
      if (docMeta && typeof docMeta === 'object') {
        await docsCol.updateOne(
          { id: documentId } as any,
          {
            $set: {
              updatedAt: now,
              'metadata.patient_name': docMeta.patient_name ?? null,
              'metadata.dob': docMeta.dob ?? null,
              'metadata.doctor_name': docMeta.doctor_name ?? null,
              'metadata.diagnosis': docMeta.diagnosis ?? null,
              'metadata.report_date': docMeta.report_date ?? null,
              'metadata.medications': Array.isArray(docMeta.medications) ? docMeta.medications : [],
              'metadata.vitals': Array.isArray(docMeta.vitals) ? docMeta.vitals : [],
              'metadata.summary': docMeta.summary ?? null,
              'metadata.classification': docMeta.classification ?? null,
            },
          } as any,
        );
        
        // Process vitals and update user's vital records
        if (Array.isArray(docMeta.vitals) && docMeta.vitals.length > 0) {
          try {
            let ownerUserId = (payload as any)?.ownerUserId;
            
            // If ownerUserId not in payload, fetch from document
            if (!ownerUserId && documentId) {
              const docRecord = await docsCol.findOne({ id: documentId } as any);
              ownerUserId = (docRecord as any)?.ownerUserId;
            }
            
            if (ownerUserId) {
              // Parse report date or fall back to current date
              let documentDate: Date | null = null;
              if (docMeta.report_date) {
                try {
                  documentDate = new Date(docMeta.report_date);
                  if (isNaN(documentDate.getTime())) {
                    documentDate = now;
                  }
                } catch {
                  documentDate = now;
                }
              } else {
                documentDate = now;
              }
              
              await processAndStoreVitals({
                userId: ownerUserId,
                documentId,
                vitals: docMeta.vitals,
                documentDate,
                documentSource: docMeta.classification || 'Medical Document'
              });
              
              // Regenerate health summary after processing vitals
              await regenerateHealthSummary(ownerUserId);
            }
          } catch (vitalErr) {
            console.error('Error processing vitals:', vitalErr);
            // Don't fail the job if vitals processing fails
          }
        }
      } else {
        await docsCol.updateOne({ id: documentId } as any, { $set: { updatedAt: now } });
      }
      // Update trends per numeric observation
      const profileId: string | undefined = (payload as any)?.profileId;
      if (profileId && Array.isArray(observations)) {
        for (const obs of observations) {
          const val = typeof obs?.value === 'number' ? obs.value : parseFloat(String(obs?.value));
          if (!Number.isFinite(val)) continue;
          const key = String(obs?.name || 'value').toLowerCase();
          const unit = obs?.unit;
          const update = await trendsCol.findOne({ profileId, metricKey: key } as any);
          const series = (update?.series || []).concat([{ timestamp: now, value: val, unit }]);
          // Simple analysis: compare first-last
          let analysis: TrendDocument['analysis'] = 'insufficient_data';
          let confidence = 0.3;
          if (series.length >= 2) {
            const first = series[0].value;
            const last = series[series.length - 1].value;
            const delta = last - first;
            const pct = Math.abs(delta) / (Math.abs(first) + 1e-6);
            if (pct < 0.02) {
              analysis = 'stable';
              confidence = Math.min(1, 0.5 + series.length * 0.05);
            } else if (delta > 0) {
              analysis = 'rising';
              confidence = Math.min(1, 0.5 + pct);
            } else {
              analysis = 'falling';
              confidence = Math.min(1, 0.5 + pct);
            }
          }
          await trendsCol.updateOne(
            { profileId, metricKey: key } as any,
            {
              $setOnInsert: { id: `${profileId}:${key}`, createdAt: now },
              $set: {
                profileId,
                metricKey: key,
                unit,
                series,
                analysis,
                confidence,
                lastValue: series[series.length - 1].value,
                lastTimestamp: series[series.length - 1].timestamp,
                dataPoints: series.length,
                updatedAt: now,
              },
            },
            { upsert: true },
          );
        }
      }
      // Enqueue doc summary and profile history summary
      const follow: JobDocument[] = [];
      if (profileId) {
        // Attach OCR text for summarization when available
        let ocrTextForSummary: string | undefined = undefined;
        if (versionId) {
          try {
            const ocrExisting = await ocrCol.findOne({ id: `${documentId}:${versionId}` } as any);
            ocrTextForSummary = ocrExisting?.text;
          } catch {}
        }
        follow.push({
          id: randomUUID(),
          type: 'summarize-doc',
          status: 'pending',
          priority: 3,
          attempts: 0,
          payload: { documentId, profileId, ocrText: ocrTextForSummary },
          createdAt: now,
          updatedAt: now,
        } as any);
        follow.push({
          id: randomUUID(),
          type: 'history-summary',
          status: 'pending',
          priority: 2,
          attempts: 0,
          payload: { profileId },
          createdAt: now,
          updatedAt: now,
        } as any);
      }
      if (follow.length) await (jobsCol as any).insertMany(follow);
    }
  }
  else if (job.type === 'summarize-doc' && documentId) {
    if (status === 'completed' && body.docSummary) {
      const profileId: string | undefined = (payload as any)?.profileId;
      let docContent: any = body.docSummary;
      if (typeof docContent === 'string') {
        try { docContent = JSON.parse(docContent); } catch {}
      }
      const sum: SummaryDocument = ({
        id: documentId,
        documentId,
        profileId: profileId || 'unknown',
        type: 'doc',
        content: docContent,
        explanations: Array.isArray(body.explanations) ? body.explanations : undefined,
        confidence: typeof body.confidence === 'number' ? body.confidence : 0.6,
        createdAt: now,
        updatedAt: now,
      } as any);
      await summariesCol.updateOne({ id: documentId } as any, { $set: sum as any }, { upsert: true });
    }
  }
  else if (job.type === 'history-summary') {
    if (status === 'completed' && body.historySummary) {
      const profileId: string | undefined = (payload as any)?.profileId;
      if (profileId) {
        const sum: SummaryDocument = {
          id: `history:${profileId}`,
          profileId,
          type: 'history',
          content: String(body.historySummary),
          confidence: typeof body.confidence === 'number' ? body.confidence : 0.6,
          createdAt: now,
          updatedAt: now,
        } as any;
        await summariesCol.updateOne({ id: sum.id } as any, { $set: sum }, { upsert: true });
      }
    }
  }
  else if (job.type === 'generate-title' && documentId) {
    if (status === 'completed' && body.generatedTitle) {
      // Save AI-generated title to document metadata
      const docsCol = await getCollection<DocumentDocument>('documents');
      await docsCol.updateOne(
        { id: documentId } as any,
        {
          $set: {
            'metadata.title': String(body.generatedTitle),
            'metadata.titleConfidence': typeof body.titleConfidence === 'number' ? body.titleConfidence : 0.8,
            updatedAt: now,
          },
        } as any,
      );
      log('Saved AI-generated title', { documentId, title: body.generatedTitle, confidence: body.titleConfidence });
    }
  }

  await logAudit(request, {
    actorId: 'system-worker',
    action: 'admin.action',
    target: id,
    targetType: 'system',
    resourceId: documentId || id,
    result: status === 'completed' ? 'success' : 'failure',
    metadata: { event: 'job.completed', type: job.type },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
