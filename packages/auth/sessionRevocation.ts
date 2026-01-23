// Session revocation interface for access/refresh tokens.
import { getCollection } from '../../apps/web/lib/db';
import type { SessionDocument } from '@db/index';

export async function revokeSession(sessionId: string): Promise<void> {
  const sessionsCol = await getCollection<SessionDocument>('sessions');
  await sessionsCol.updateOne({ id: sessionId } as any, { $set: { revokedAt: new Date() } });
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  const sessionsCol = await getCollection<SessionDocument>('sessions');
  await sessionsCol.updateMany({ userId, revokedAt: { $exists: false } } as any, { $set: { revokedAt: new Date() } });
}
