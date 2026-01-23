import { NextRequest, NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { initializeDatabase } from '@/../../packages/db/init';
import { getIdentity } from '@/lib/auth';

// Admin: init DB (schema validation + indexes)
export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action');
  if (action !== 'init-db') {
    return NextResponse.json({ message: 'unknown admin action' }, { status: 400 });
  }
  const { role } = await getIdentity();
  if (role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const db = await getDbClient();
    await initializeDatabase(db);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'init failed' }, { status: 500 });
  }
}

