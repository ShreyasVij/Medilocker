// Auth helper utilities: OAuth initiation URLs, token parsing, session helpers.
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export function buildOAuthRedirectUrl(provider: 'google' | 'github' | 'institution'): string {
  return '';
}

export function parseAccessToken(token: string) {
  return null;
}

export function issueSessionCookies(params: { accessToken: string; refreshToken: string }) {
  return null;
}

// Returns actor identity and primary role from NextAuth session.
export async function getIdentity(): Promise<{ actorId: string; role: 'patient' | 'guardian' | 'doctor' | 'admin' | 'system-worker'; session: any | null }>{
  const session = await getServerSession(authOptions);
  const actorId = (session as any)?.user?.id || (session as any)?.user?.email || 'anon';
  const role = (((session as any)?.user?.roles || [])[0] || 'patient') as any;
  return { actorId, role, session };
}
