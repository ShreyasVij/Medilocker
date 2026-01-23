import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import type { JobDocument } from '@/../../packages/db/jobs';
import { createDownloadUrl } from '@/services/storageClient';
import { logAudit } from '@/lib/audit';

function isAuthorized(req: NextRequest): boolean {
  const token = req.headers.get('x-internal-token');
  return !!token && token === process.env.INTERNAL_AUTH_TOKEN;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const jobsCol = await getCollection<JobDocument>('jobs');
  const now = new Date();
  const job = await jobsCol.findOneAndUpdate(
    { status: 'pending', type: { $in: ['ingest', 'classify', 'extract-structured', 'summarize-doc', 'history-summary'] } } as any,
    { $set: { status: 'processing', startedAt: now, updatedAt: now } },
    { sort: { priority: -1, createdAt: 1 }, returnDocument: 'after' } as any,
  );

  const doc = (job as any)?.value as JobDocument | null;
  if (!doc) return NextResponse.json({ job: null }, { status: 200 });

  let signedUrl: string | null = null;
  try {
    // Only ingest jobs require a download URL
    if (doc.type === 'ingest') {
      const storageKey = (doc.payload as any)?.storageKey as string | undefined;
      if (storageKey) signedUrl = await createDownloadUrl({ storageKey, expiresIn: 900 });
    }
  } catch {}

  await logAudit(request, {
    actorId: 'system-worker',
    action: 'admin.action',
    target: doc.id,
    targetType: 'system',
    resourceId: doc.id,
    result: 'success',
    metadata: { event: 'job.claimed', type: doc.type },
  });

  return NextResponse.json({ job: { ...doc, signedUrl } }, { status: 200 });
}
