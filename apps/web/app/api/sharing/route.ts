import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getCollection } from '@/lib/db';
import type { ShareDocument } from '@/../../packages/db/shares';
import type { ProfileDocument } from '@/../../packages/db/profiles';
import { logAudit } from '@/lib/audit';
import { hasPermission } from '@/../../packages/auth/rbac';
import { getIdentity } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get('profileId');
  const sharesCol = await getCollection<ShareDocument>('shares');
  const q: any = {};
  if (profileId) q.profileId = profileId;
  q.status = { $in: ['active'] };
  // Only owner or admin can list shares for a profile
  const { role, actorId } = await getIdentity();
  if (role !== 'admin') {
    const profilesCol = await getCollection<ProfileDocument>('profiles');
    const profile = await profilesCol.findOne({ id: profileId } as any);
    if (!profile || profile.userId !== actorId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }
  const docs = await sharesCol.find(q).sort({ createdAt: -1 }).limit(100).toArray();
  return NextResponse.json({ data: docs }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const sharesCol = await getCollection<ShareDocument>('shares');
  const body = await request.json();
  const { role, actorId } = await getIdentity();
  if (!hasPermission(role, 'share:create')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const now = new Date();
  const doc: ShareDocument = {
    id: randomUUID(),
    ownerUserId: body.ownerUserId,
    profileId: body.profileId,
    grantedToEmail: body.grantedToEmail,
    grantedToUserId: body.grantedToUserId,
    grantedToName: body.grantedToName,
    granteeType: body.granteeType,
    permissions: body.permissions || ['view'],
    scope: body.scope || {},
    expiresAt: new Date(body.expiresAt),
    status: 'active',
    createdAt: now,
  };
  await sharesCol.insertOne(doc as any);
  await logAudit(request, {
    actorId,
    action: 'share.create',
    target: doc.profileId,
    targetType: 'profile',
    resourceId: doc.id,
    result: 'success',
  });
  return NextResponse.json({ id: doc.id }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { role, actorId } = await getIdentity();
  if (!hasPermission(role, 'share:revoke')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const sharesCol = await getCollection<ShareDocument>('shares');
  await sharesCol.updateOne({ id }, { $set: { status: 'revoked', revokedAt: new Date() } });
  await logAudit(request, {
    actorId,
    action: 'share.revoke',
    target: id,
    targetType: 'share',
    resourceId: id,
    result: 'success',
  });
  return NextResponse.json({ ok: true }, { status: 200 });
}

