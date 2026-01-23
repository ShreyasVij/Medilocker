// Refresh token rotation contract.
import { randomUUID, createHash } from 'crypto';
import { getCollection } from '../../apps/web/lib/db';
import type { SessionDocument, UserDocument } from '@db/index';
import { issueAccessToken, issueRefreshToken, verifyToken } from './jwt';

export interface RefreshRotationResult {
  accessToken: string;
  refreshToken: string;
  revokedSessionIds: string[];
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function rotateRefreshToken(params: { userId: string; refreshToken: string }): Promise<RefreshRotationResult> {
  const now = new Date();
  const claims = verifyToken(params.refreshToken);
  if (!claims || claims.tokenType !== 'refresh' || claims.sub !== params.userId) {
    throw new Error('invalid_refresh_token');
  }

  const sessionsCol = await getCollection<SessionDocument>('sessions');
  const usersCol = await getCollection<UserDocument>('users');
  const hash = sha256(params.refreshToken);

  const active = await sessionsCol.findOne({ userId: params.userId, refreshTokenHash: hash, revokedAt: { $exists: false }, expiresAt: { $gt: now } } as any);
  if (!active) {
    throw new Error('session_not_found_or_revoked');
  }

  // Fetch roles for new tokens; default to patient if missing
  const user = await usersCol.findOne({ id: params.userId } as any);
  const roles = (user?.roles && user.roles.length > 0) ? user.roles : ['patient'];

  // Revoke the old session
  await sessionsCol.updateOne({ id: active.id } as any, { $set: { revokedAt: now } });

  // Create new tokens
  const accessToken = issueAccessToken({ sub: params.userId, roles });
  const refreshToken = issueRefreshToken({ sub: params.userId, roles });
  const newHash = sha256(refreshToken);

  const newSession: SessionDocument = {
    id: randomUUID(),
    userId: params.userId,
    refreshTokenHash: newHash,
    accessTokenFamily: active.accessTokenFamily || randomUUID(),
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    lastActivityAt: now,
  };
  await sessionsCol.insertOne(newSession as any);

  return { accessToken, refreshToken, revokedSessionIds: [active.id] };
}
