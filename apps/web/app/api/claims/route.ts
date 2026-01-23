import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getCollection } from '@/lib/db';
import type { ClaimDocument } from '@/../../packages/db/claims';
import type { ProfileDocument } from '@/../../packages/db/profiles';
import { hasPermission } from '@/../../packages/auth/rbac';
import { logAudit } from '@/lib/audit';
import { getIdentity } from '@/lib/auth';

// List claims for a profile
export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get('profileId');
  const { role, actorId } = await getIdentity();
  if (!profileId) return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
  // Owner/admin only
  if (role !== 'admin') {
    const profilesCol = await getCollection<ProfileDocument>('profiles');
    const p = await profilesCol.findOne({ id: profileId } as any);
    if (!p || p.userId !== actorId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }
  const claimsCol = await getCollection<ClaimDocument>('claims');
  const docs = await claimsCol.find({ profileId }).sort({ claimDate: -1 }).limit(50).toArray();
  return NextResponse.json({ data: docs }, { status: 200 });
}

// Create a claim bundle record (bundle generation handled elsewhere)
export async function POST(request: NextRequest) {
  const { role, actorId } = await getIdentity();
  if (!hasPermission(role, 'profile:write')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = await request.json();
  const profileId = body.profileId as string;
  const documentIds = (body.documentIds as string[]) || [];
  const insurerId = body.insurerId || undefined;
  const policyNumber = body.policyNumber || undefined;
  if (!profileId || documentIds.length === 0) {
    return NextResponse.json({ error: 'profileId and documentIds required' }, { status: 400 });
  }
  const claimsCol = await getCollection<ClaimDocument>('claims');
  const id = randomUUID();
  const now = new Date();
  const bundleKey = `claims/${profileId}/${id}.json`; // Placeholder bundle path (no metadata stored in storage)
  const claim: ClaimDocument = {
    id,
    profileId,
    documentIds,
    status: 'draft',
    bundleKey,
    insurerId,
    policyNumber,
    claimDate: now,
    createdAt: now,
    updatedAt: now,
  };
  await claimsCol.insertOne(claim as any);
  await logAudit(request, {
    actorId,
    action: 'admin.action',
    target: profileId,
    targetType: 'profile',
    resourceId: id,
    result: 'success',
    metadata: { documentIds },
  });
  return NextResponse.json({ id, status: 'draft', bundleKey }, { status: 200 });
}
