import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getIdentity } from '@/lib/auth';
import { canAccessProfile } from '@/lib/permissions';
import type { DocumentDocument } from '@/../../packages/db/documents';
import type { AlertDocument } from '@/../../packages/db/alerts';
import type { ClaimDocument } from '@/../../packages/db/claims';

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get('profileId');
  if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 });

  const { role, actorId } = await getIdentity();
  const ok = await canAccessProfile({ role, profileId, actorId });
  if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const docsCol = await getCollection<DocumentDocument>('documents');
  const alertsCol = await getCollection<AlertDocument>('alerts');
  const claimsCol = await getCollection<ClaimDocument>('claims');

  const [docs, alerts, claims] = await Promise.all([
    docsCol.find({ profileId } as any).project({ id: 1, docType: 1, createdAt: 1, tags: 1 } as any).toArray(),
    alertsCol.find({ profileId } as any).project({ id: 1, type: 1, eventTime: 1 } as any).toArray(),
    claimsCol.find({ profileId } as any).project({ id: 1, status: 1, claimDate: 1 } as any).toArray(),
  ]);

  const events: any[] = [];
  for (const d of docs) events.push({ kind: 'document', id: d.id, docType: d.docType, tags: d.tags || [], at: d.createdAt });
  for (const a of alerts) events.push({ kind: 'alert', id: a.id, type: a.type, at: a.eventTime });
  for (const c of claims) events.push({ kind: 'claim', id: c.id, status: c.status, at: c.claimDate });

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return NextResponse.json({ data: events }, { status: 200 });
}
