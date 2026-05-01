/**
 * NFC Token Generator Library
 * Handles generation, hashing, and OTP creation for NFC emergency tokens
 */

import crypto from 'crypto';
import QRCode from 'qrcode';

/**
 * Generate a secure random NFC token (256-bit)
 * @returns Raw token string (hex format)
 */
export function generateNfcToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256
 * @param token Raw token
 * @returns Hashed token
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate NFC URL from token
 * @param token Raw token
 * @param baseUrl Base URL (e.g., https://medora.buzz)
 * @returns Full NFC URL
 */
export function generateNfcUrl(token: string, baseUrl: string = 'https://medora.buzz'): string {
  return `${baseUrl}/emergency/nfc/${token}`;
}

/**
 * Generate a QR code data URL
 * @param url URL to encode in QR
 * @returns QR code as base64 data URL
 */
export async function generateQrCode(url: string): Promise<string> {
  try {
    if (!url) {
      throw new Error('URL is required to generate QR code');
    }

    // Generate QR code as data URL
    // Options:
    // - width: 300px (good for mobile scanning)
    // - margin: 2 (quiet zone around QR)
    // - color.dark: black (QR code bars)
    // - color.light: white (background)
    // - errorCorrectionLevel: H (High error correction - can scan with ~30% damage)
    const qrCodeDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 2,
      width: 300, // 300x300 pixels
      color: {
        dark: '#000000', // Black
        light: '#FFFFFF', // White
      },
    });

    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error(`Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a 6-digit OTP code
 * @returns 6-digit code as string
 */
export function generateOtpCode(): string {
  const code = Math.floor(Math.random() * 1000000);
  return String(code).padStart(6, '0');
}

/**
 * Hash OTP code
 * @param otp OTP code
 * @returns Hashed OTP
 */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Verify OTP by comparing hashes
 * @param providedOtp OTP provided by user
 * @param storedHash Stored hash from database
 * @returns True if OTP matches
 */
export function verifyOtp(providedOtp: string, storedHash: string): boolean {
  const providedHash = hashOtp(providedOtp);
  return crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(storedHash));
}

/**
 * Generate NFC writing instructions for users
 * @returns Instructions object
 */
export function getNfcWritingInstructions(nfcUrl: string): {
  title: string;
  steps: string[];
  url: string;
  automationLink: string;
} {
  return {
    title: 'Write to NFC Card',
    steps: [
      '1. Open NFC Writer app (TagWriter by NXP or Shortcuts)',
      '2. Tap "Create New Record"',
      '3. Select type: URL',
      '4. Paste the URL below',
      '5. Hold phone to NFC card/sticker',
      '6. Confirm write',
      '7. Test by tapping the card again',
    ],
    url: nfcUrl,
    automationLink: 'Create with Shortcuts (iOS): [link to automation setup]',
  };
}

/**
 * Validate token format
 * @param token Token to validate
 * @returns True if valid NFC token format
 */
export function isValidTokenFormat(token: string): boolean {
  // Should be 64 hex characters (256 bits in hex)
  return /^[a-f0-9]{64}$/i.test(token);
}

/**
 * Generate NFC token bundle
 * @param baseUrl Base URL for NFC links
 * @returns Complete token bundle with URL, hash, and QR
 */
export async function generateNfcTokenBundle(
  baseUrl: string = 'https://medora.buzz'
): Promise<{
  rawToken: string;
  tokenHash: string;
  nfcUrl: string;
  qrCodeUrl: string;
  instructions: ReturnType<typeof getNfcWritingInstructions>;
}> {
  const rawToken = generateNfcToken();
  const tokenHash = hashToken(rawToken);
  const nfcUrl = generateNfcUrl(rawToken, baseUrl);
  const qrCodeUrl = await generateQrCode(nfcUrl);
  const instructions = getNfcWritingInstructions(nfcUrl);

  return {
    rawToken,
    tokenHash,
    nfcUrl,
    qrCodeUrl,
    instructions,
  };
}

/**
 * Create an OTP session object
 * @param expiryMinutes How long OTP is valid
 * @returns OTP details
 */
export function createOtpSession(expiryMinutes: number = 10): {
  code: string;
  codeHash: string;
  expiresAt: Date;
  expiresInSeconds: number;
} {
  const code = generateOtpCode();
  const codeHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  const expiresInSeconds = expiryMinutes * 60;

  return {
    code,
    codeHash,
    expiresAt,
    expiresInSeconds,
  };
}

/**
 * Extract device info from User-Agent
 * @param userAgent User-Agent string
 * @returns Parsed device info
 */
export function parseUserAgent(userAgent: string): {
  os?: 'iOS' | 'Android' | 'Web' | 'Unknown';
  browser?: string;
  deviceName?: string;
} {
  const ua = userAgent.toLowerCase();

  let os: 'iOS' | 'Android' | 'Web' | 'Unknown' = 'Unknown';
  let browser = 'Unknown';

  // Detect OS
  if (ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('windows') || ua.includes('mac') || ua.includes('linux')) {
    os = 'Web';
  }

  // Detect Browser
  if (ua.includes('chrome') && !ua.includes('chromium')) {
    browser = 'Chrome';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
  }

  // Extract device name (device model for mobile)
  let deviceName = undefined;
  const phoneMatch = userAgent.match(/(iPhone|iPad|Android|Samsung)/i);
  if (phoneMatch) {
    deviceName = phoneMatch[1];
  }

  return {
    os,
    browser,
    deviceName,
  };
}
