import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getCollection } from '@/lib/db';
import type { AlertDocument } from '@/../../packages/db/alerts';
import { logAudit } from '@/lib/audit';
import { canAccessProfile } from '@/lib/permissions';
import { hasPermission } from '@/../../packages/auth/rbac';
import { getIdentity } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get('profileId');
  const alertsCol = await getCollection<AlertDocument>('alerts');
  const q: any = {};
  if (profileId) q.profileId = profileId;
  if (profileId) {
    const { role, actorId } = await getIdentity();
    if (!(await canAccessProfile({ role, profileId, actorId }))) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }
  const docs = await alertsCol.find(q).sort({ eventTime: 1 }).limit(100).toArray();
  return NextResponse.json({ data: docs }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const alertsCol = await getCollection<AlertDocument>('alerts');
  const body = await request.json();
  const { role, actorId } = await getIdentity();
  if (!hasPermission(role, 'alerts:manage') || !(await canAccessProfile({ role, profileId: body.profileId, actorId }))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const now = new Date();
  const doc: AlertDocument = {
    id: randomUUID(),
    profileId: body.profileId,
    type: body.type,
    eventTime: new Date(body.eventTime),
    relatedDocumentId: body.relatedDocumentId,
    payload: body.payload,
    status: 'pending',
    createdAt: now,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
  };
  await alertsCol.insertOne(doc as any);
  await logAudit(request, {
    actorId,
    action: 'admin.action',
    target: doc.profileId,
    targetType: 'profile',
    resourceId: doc.id,
    result: 'success',
    metadata: { type: doc.type },
  });
  return NextResponse.json({ id: doc.id }, { status: 200 });
}

export async function PATCH(request: NextRequest) {
  const alertsCol = await getCollection<AlertDocument>('alerts');
  const body = await request.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { role, actorId } = await getIdentity();
  if (!hasPermission(role, 'alerts:manage')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const set: Partial<AlertDocument> = { status: body.status };
  if (body.status === 'acknowledged') set.triggeredAt = new Date();
  if (body.status === 'dismissed') set.dismissedAt = new Date();
  await alertsCol.updateOne({ id }, { $set: set });
  await logAudit(request, {
    actorId,
    action: 'admin.action',
    target: id,
    targetType: 'system',
    resourceId: id,
    result: 'success',
    metadata: { status: body.status },
  });
  return NextResponse.json({ ok: true }, { status: 200 });
}

