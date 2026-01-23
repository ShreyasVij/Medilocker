import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import type { DocumentDocument } from '@/../../packages/db/documents';
import { getIdentity } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const documentId = body.documentId as string;
  const docType = body.docType as DocumentDocument['docType'];
  const tags = (body.tags as string[] | undefined) || undefined;
  if (!documentId || !docType) return NextResponse.json({ error: 'documentId and docType required' }, { status: 400 });

  const { role, actorId } = await getIdentity();
  const docsCol = await getCollection<DocumentDocument>('documents');
  const doc = await docsCol.findOne({ id: documentId } as any);
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Owner or admin can override
  if (!(role === 'admin' || doc.ownerUserId === actorId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const update: Partial<DocumentDocument> = { docType } as any;
  if (tags && tags.length) update.tags = tags;
  update.updatedAt = new Date();

  await docsCol.updateOne({ id: documentId } as any, { $set: update });
  return NextResponse.json({ ok: true }, { status: 200 });
}
