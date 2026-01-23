import { NextRequest, NextResponse } from 'next/server';
import { rotateRefreshToken } from '@/../../packages/auth/refreshRotation';
import { verifyToken } from '@/../../packages/auth/jwt';
import { logAudit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const refreshToken = body.refreshToken as string;
  if (!refreshToken) return NextResponse.json({ error: 'refreshToken required' }, { status: 400 });

  const claims = verifyToken(refreshToken);
  if (!claims || claims.tokenType !== 'refresh') {
    return NextResponse.json({ error: 'invalid_refresh_token' }, { status: 401 });
  }

  try {
    const result = await rotateRefreshToken({ userId: claims.sub, refreshToken });
    await logAudit(request, {
      actorId: claims.sub,
      action: 'access.grant',
      target: claims.sub,
      targetType: 'user',
      resourceId: result.revokedSessionIds[0] || 'unknown',
      result: 'success',
    });
    return NextResponse.json({ accessToken: result.accessToken, refreshToken: result.refreshToken }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'rotation_failed' }, { status: 401 });
  }
}
