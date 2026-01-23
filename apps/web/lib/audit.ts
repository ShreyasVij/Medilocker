import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { getCollection } from '@/lib/db';
import type { AuditDocument } from '@/../../packages/db/audits';

export async function logAudit(req: NextRequest, entry: Omit<AuditDocument, 'id' | 'timestamp'> & { timestamp?: Date }) {
  const audits = await getCollection<AuditDocument>('audits');
  const now = entry.timestamp || new Date();
  const actorId = entry.actorId;
  const doc: AuditDocument = {
    id: randomUUID(),
    actorId,
    action: entry.action,
    target: entry.target,
    targetType: entry.targetType,
    resourceId: entry.resourceId,
    result: entry.result,
    timestamp: now,
    ipAddress: req.headers.get('x-forwarded-for') || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
    metadata: entry.metadata,
    archived: false,
  };
  await audits.insertOne(doc as any);
}
