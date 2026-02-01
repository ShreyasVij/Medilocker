import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getIdentity } from '@/lib/auth';
import { hasPermission } from '@/../../packages/auth/rbac';
import type { UserDocument } from '@/../../packages/db/users';
import { ensureUserSpace } from '@/services/storageClient';
import { logAudit } from '@/lib/audit';

// Admin-only route to initialize per-user Supabase storage space for given emails
// POST body: { emails: string[] }
export async function POST(request: NextRequest) {
  try {
    const { role, actorId } = await getIdentity();
    const headerToken = request.headers.get('x-admin-token');
    const envToken = process.env.ADMIN_INIT_TOKEN;
    const tokenAuthorized = !!envToken && headerToken === envToken;
    if (!tokenAuthorized && !hasPermission(role, 'admin:write')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const emails: string[] = Array.isArray(body?.emails) && body.emails.length
      ? body.emails
      : ['dhairyasood20042006@gmail.com', 'kagstrowoods@gmail.com'];

    const usersCol = await getCollection<UserDocument>('users');
    const results: { email: string; userId?: string; ok: boolean; error?: string }[] = [];

    for (const email of emails) {
      try {
        const user = await usersCol.findOne({ email } as any);
        if (!user) {
          results.push({ email, ok: false, error: 'user-not-found' });
          continue;
        }
        const userIdStr = user._id.toString();
        await ensureUserSpace({ actorId: userIdStr });
        results.push({ email, userId: userIdStr, ok: true });
      } catch (err: any) {
        results.push({ email, ok: false, error: err?.message || 'init-failed' });
      }
    }

    await logAudit(request, {
      actorId,
      action: 'admin.action',
      target: 'storage',
      targetType: 'system',
      resourceId: 'storage-init',
      result: 'success',
      metadata: { emails: emails.length, auth: tokenAuthorized ? 'token' : 'session' },
    });

    return NextResponse.json({ results }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'internal-error' }, { status: 500 });
  }
}
