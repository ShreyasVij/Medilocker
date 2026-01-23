import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

function getKey(): Buffer {
  const env = process.env.EMERGENCY_ENC_KEY || '';
  if (env) {
    // Accept base64 or hex; fallback to utf8 if 32 chars
    try {
      if (/^[A-Fa-f0-9]{64}$/.test(env)) return Buffer.from(env, 'hex');
      const b = Buffer.from(env, 'base64');
      if (b.length === 32) return b;
    } catch {}
    const buf = Buffer.from(env);
    if (buf.length === 32) return buf;
  }
  // Derive from NEXTAUTH_SECRET when explicit key missing (dev convenience)
  const secret = process.env.NEXTAUTH_SECRET || 'dev-secret-key';
  return createHash('sha256').update(secret).digest(); // 32 bytes
}

export function encryptJson(value: unknown): string {
  const key = getKey();
  const iv = randomBytes(12); // GCM recommended 12-byte nonce
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, enc]);
  return 'v1.' + packed.toString('base64');
}

export function decryptJson(payload: string): unknown | null {
  if (!payload || typeof payload !== 'string') return null;
  if (!payload.startsWith('v1.')) return null;
  const data = Buffer.from(payload.slice(3), 'base64');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const enc = data.subarray(28);
  const key = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  try {
    return JSON.parse(dec.toString('utf8'));
  } catch {
    return null;
  }
}
