import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import type { ProfileDocument } from '@/../../packages/db/profiles';
import { canPerformEmergencyAccess } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { getIdentity } from '@/lib/auth';
import { decryptJson } from '@/lib/crypto';

// Issue a static emergency token (demo)
export async function POST(request: NextRequest) {
  const token = 'emergency-demo-token';
  const { actorId } = await getIdentity();
  await logAudit(request, {
    actorId,
    action: 'emergency.access',
    target: actorId,
    targetType: 'user',
    resourceId: actorId,
    result: 'success',
    metadata: { issued: true },
  });
  return NextResponse.json({ token }, { status: 200 });
}

// Minimal emergency retrieval: basic profile card by id
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  if (!canPerformEmergencyAccess({ token })) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const profileId = request.nextUrl.searchParams.get('profileId');
  if (!profileId) return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
  const profilesCol = await getCollection<ProfileDocument>('profiles');
  const doc = await profilesCol.findOne({ id: profileId });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { actorId } = await getIdentity();
  await logAudit(request, {
    actorId,
    action: 'emergency.access',
    target: profileId,
    targetType: 'profile',
    resourceId: profileId,
    result: 'success',
  });
  // Return only minimal fields
  return NextResponse.json({
    id: doc.id,
    displayName: doc.displayName,
    bloodGroup: doc.bloodGroup,
    allergies: doc.allergies || [],
    conditions: doc.conditions || [],
    emergencyContact: doc.emergencyContactEnc ? decryptJson(doc.emergencyContactEnc) : null,
  }, { status: 200 });
}
