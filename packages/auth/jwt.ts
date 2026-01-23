// JWT issuance and verification helpers for access and refresh tokens.
import { createHmac, timingSafeEqual } from 'crypto';

export interface JwtClaims {
  sub: string;
  roles: string[];
  profileId?: string;
  exp: number; // seconds since epoch
  iat?: number; // seconds since epoch
  tokenType?: 'access' | 'refresh';
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('JWT secret not configured');
  return secret;
}

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signHS256(data: string, secret: string): string {
  const h = createHmac('sha256', secret).update(data).digest();
  return base64url(h);
}

function encodeJWT(payload: Record<string, any>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const toSign = `${encodedHeader}.${encodedPayload}`;
  const signature = signHS256(toSign, secret);
  return `${toSign}.${signature}`;
}

export function issueAccessToken(claims: Omit<JwtClaims, 'exp'> & { expSeconds?: number }): string {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const expSeconds = claims.expSeconds ?? 15 * 60; // default 15 minutes
  const payload: JwtClaims = {
    sub: claims.sub,
    roles: claims.roles,
    profileId: claims.profileId,
    iat: now,
    exp: now + expSeconds,
    tokenType: 'access',
  };
  return encodeJWT(payload, secret);
}

export function issueRefreshToken(claims: Omit<JwtClaims, 'exp'> & { expSeconds?: number }): string {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const expSeconds = claims.expSeconds ?? 30 * 24 * 60 * 60; // default 30 days
  const payload: JwtClaims = {
    sub: claims.sub,
    roles: claims.roles,
    profileId: claims.profileId,
    iat: now,
    exp: now + expSeconds,
    tokenType: 'refresh',
  };
  return encodeJWT(payload, secret);
}

export function verifyToken(token: string): JwtClaims | null {
  try {
    const secret = getSecret();
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const expected = signHS256(`${h}.${p}`, secret);
    const a = Buffer.from(s);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64').toString('utf8')) as JwtClaims;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
