import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import type { DocumentDocument } from '@/../../packages/db/documents';
import { getIdentity } from '@/lib/auth';
import { canDeleteDocument } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const { role, actorId } = await getIdentity();
    const body = await request.json().catch(() => ({}));
    const docId = (body?.id as string) || request.nextUrl.searchParams.get('id');
    if (!docId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    if (!(await canDeleteDocument({ role, docId, actorId }))) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const documentsCol = await getCollection<DocumentDocument>('documents');
    const now = new Date();
    const res = await documentsCol.updateOne({ id: docId }, { $set: { status: 'archived', updatedAt: now } });
    if (res.matchedCount === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    // If this archive resulted in zero active documents for the owner, trigger regeneration
    try {
      const updated = await documentsCol.findOne({ id: docId } as any);
      const owner = updated?.ownerUserId || updated?.ownerId || undefined;
      if (owner) {
        const activeCount = await documentsCol.countDocuments({ ownerUserId: owner, status: 'active' } as any);
        if (activeCount === 0) {
          void (await import('@/lib/vitalsProcessor')).regenerateHealthSummary(owner).catch(() => {});
        }
      }
    } catch {}
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message : 'Bin failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
