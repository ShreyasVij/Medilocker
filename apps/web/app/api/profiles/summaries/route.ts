import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getIdentity } from '@/lib/auth';
import type { SummaryDocument } from '@/../../packages/db/summaries';
import { canAccessProfile } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get('profileId');
  const type = (request.nextUrl.searchParams.get('type') as 'doc' | 'history' | null) || null;
  if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 });

  const { role, actorId } = await getIdentity();
  const ok = await canAccessProfile({ role, profileId, actorId });
  if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const col = await getCollection<SummaryDocument>('summaries');
  const q: any = { profileId };
  if (type) q.type = type;
  const docs = await col.find(q).sort({ updatedAt: -1 }).limit(50).toArray();
  return NextResponse.json({ data: docs }, { status: 200 });
}
