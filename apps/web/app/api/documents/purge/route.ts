import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import type { DocumentDocument } from '@/../../packages/db/documents';
import type { DocumentVersionDocument } from '@/../../packages/db/documentVersions';
import type { ClassificationDocument } from '@/../../packages/db/classification';
import type { SummaryDocument } from '@/../../packages/db/summaries';
import type { OcrOutputDocument } from '@/../../packages/db/ocrOutputs';
import { getIdentity } from '@/lib/auth';
import { regenerateHealthSummary } from '@/lib/vitalsProcessor';
import { canDeleteDocument } from '@/lib/permissions';
import { deleteStorageObjects } from '@/services/storageClient';

export async function DELETE(request: NextRequest) {
  try {
    const { role, actorId } = await getIdentity();
    const docId = request.nextUrl.searchParams.get('id');
    if (!docId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    if (!(await canDeleteDocument({ role, docId, actorId }))) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const documentsCol = await getCollection<DocumentDocument>('documents');
    const versionsCol = await getCollection<DocumentVersionDocument>('documentVersions');
    const classCol = await getCollection<ClassificationDocument>('classification');
    const summariesCol = await getCollection<SummaryDocument>('summaries');
    const ocrCol = await getCollection<OcrOutputDocument>('ocrOutputs');
    const userVitalsCol = await getCollection<any>('userVitals');

    // Gather storage keys to delete from Supabase
    const versions = await versionsCol.find({ documentId: docId } as any).toArray();
    const storageKeys: string[] = [];
    versions.forEach(v => { if (v?.storageKey) storageKeys.push(v.storageKey as any); });
    const doc = await documentsCol.findOne({ id: docId } as any);
    if (doc?.storageKey) storageKeys.push(doc.storageKey as any);

    // Remove raw files from storage (best-effort)
    try { await deleteStorageObjects({ keys: storageKeys }); } catch {}

    // Remove derived records first
    await versionsCol.deleteMany({ documentId: docId } as any);
    await classCol.deleteOne({ documentId: docId } as any);
    await summariesCol.deleteMany({ $or: [ { documentId: docId }, { id: docId } ] } as any);
    await ocrCol.deleteMany({ documentId: docId } as any);
    // Delete only userVitals tied to this document
    await userVitalsCol.deleteMany({ documentId: docId } as any);

    // Finally remove the document itself
    await documentsCol.deleteOne({ id: docId } as any);
    try {
      const owner = doc?.ownerUserId;
      if (owner) void regenerateHealthSummary(owner).catch(() => {});
    } catch {}

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message : 'Purge failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
