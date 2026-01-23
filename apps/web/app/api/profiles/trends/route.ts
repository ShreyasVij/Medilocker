import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getIdentity } from '@/lib/auth';
import type { TrendDocument } from '@/../../packages/db/trends';
import { canAccessProfile } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get('profileId');
  if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 });

  const { role, actorId } = await getIdentity();
  const ok = await canAccessProfile({ role, profileId, actorId });
  if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const col = await getCollection<TrendDocument>('trends');
  const docs = await col.find({ profileId } as any).project({ series: { $slice: -50 } } as any).toArray();
  return NextResponse.json({ data: docs }, { status: 200 });
}
