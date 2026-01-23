import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import type { DocumentDocument } from '@/../../packages/db/documents';
import { createDownloadUrl, createDownloadUrlsForPrefix, listFiles } from '@/services/storageClient';
import { logAudit } from '@/lib/audit';
import { canDownloadDocument } from '@/lib/permissions';
import { getIdentity } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const expires = parseInt(request.nextUrl.searchParams.get('expires') || '900', 10);
  const { role, actorId } = await getIdentity();

  let storageKey: string | null = null;
  if (id) {
    const documentsCol = await getCollection<DocumentDocument>('documents');
    const doc = await documentsCol.findOne({ id });
    if (!doc || doc.status === 'deleted') {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    const allowed = await canDownloadDocument({ role, docId: id, actorId });
    if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    storageKey = doc.storageKey;
  } else {
    storageKey = request.nextUrl.searchParams.get('storageKey');
  }

  if (!storageKey) {
    return NextResponse.json({ error: 'Missing id or storageKey' }, { status: 400 });
  }

  try {
    // If the exact file exists, sign it; otherwise, attempt to list children under the prefix
    let url: string | null = null;
    let urls: string[] | null = null;
    try {
      url = await createDownloadUrl({ storageKey, expiresIn: expires });
    } catch {
      // Fall back to listing page files within this storageKey prefix
      const children = await listFiles({ prefix: storageKey });
      if (children && children.length > 0) {
        urls = await createDownloadUrlsForPrefix({ prefix: storageKey, expiresIn: expires });
      }
    }
    await logAudit(request, {
      actorId,
      action: 'document.download',
      target: storageKey,
      targetType: 'document',
      resourceId: id || storageKey,
      result: 'success',
    });
    if (urls && urls.length > 0) {
      return NextResponse.json({ urls }, { status: 200 });
    }
    return NextResponse.json({ url }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create download URL' }, { status: 500 });
  }
}
