import { NextRequest, NextResponse } from 'next/server';
import { revokeSession, revokeAllSessionsForUser } from '@/../../packages/auth/sessionRevocation';
import { getIdentity } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const { actorId, role, session } = await getIdentity();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const sessionId = body.sessionId as string | undefined;
  const all = !!body.all;
  const targetUserId = (body.userId as string | undefined) || actorId;

  // Only admins can revoke others' sessions
  if (targetUserId !== actorId && role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (all) {
    await revokeAllSessionsForUser(targetUserId);
  } else if (sessionId) {
    await revokeSession(sessionId);
  } else {
    return NextResponse.json({ error: 'sessionId or all required' }, { status: 400 });
  }

  await logAudit(request, {
    actorId,
    action: 'access.revoke',
    target: targetUserId,
    targetType: 'user',
    resourceId: sessionId || 'all',
    result: 'success',
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
