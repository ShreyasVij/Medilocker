import { NextRequest, NextResponse } from 'next/server';
import { getIdentity } from '@/lib/auth';
import { issueAccessToken, issueRefreshToken } from '@/../../packages/auth/jwt';
import { getCollection } from '@/lib/db';
import type { SessionDocument } from '@/../../packages/db/sessions';
import type { UserDocument } from '@/../../packages/db/users';
import { randomUUID, createHash } from 'crypto';
import { logAudit } from '@/lib/audit';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function POST(request: NextRequest) {
  const { actorId, role, session } = await getIdentity();
  if (!session || !actorId || actorId === 'anon') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const usersCol = await getCollection<UserDocument>('users');
  const user = await usersCol.findOne({ id: actorId } as any);
  const roles = (user?.roles && user.roles.length) ? user.roles : [role];

  const accessToken = issueAccessToken({ sub: actorId, roles });
  const refreshToken = issueRefreshToken({ sub: actorId, roles });

  const sessionsCol = await getCollection<SessionDocument>('sessions');
  const now = new Date();
  const doc: SessionDocument = {
    id: randomUUID(),
    userId: actorId,
    refreshTokenHash: sha256(refreshToken),
    accessTokenFamily: randomUUID(),
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    lastActivityAt: now,
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  };
  await sessionsCol.insertOne(doc as any);

  await logAudit(request, {
    actorId,
    action: 'access.grant',
    target: actorId,
    targetType: 'user',
    resourceId: doc.id,
    result: 'success',
  });

  return NextResponse.json({ accessToken, refreshToken }, { status: 200 });
}
