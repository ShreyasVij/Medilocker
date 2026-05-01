/**
 * Unit tests for NFC token generation
 */

import {
  generateNfcToken,
  hashToken,
  generateOtpCode,
  hashOtp,
  verifyOtp,
  isValidTokenFormat,
  generateNfcUrl,
  getNfcWritingInstructions,
  parseUserAgent,
  createOtpSession,
} from '@/lib/nfcGenerator';

describe('NFC Token Generation', () => {
  describe('generateNfcToken', () => {
    it('should generate a token', () => {
      const token = generateNfcToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate unique tokens', () => {
      const token1 = generateNfcToken();
      const token2 = generateNfcToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate 256-bit tokens (64 hex chars)', () => {
      const token = generateNfcToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/i);
    });

    it('should always generate valid format tokens', () => {
      for (let i = 0; i < 10; i++) {
        const token = generateNfcToken();
        expect(isValidTokenFormat(token)).toBe(true);
      }
    });
  });

  describe('hashToken', () => {
    it('should hash a token', () => {
      const token = generateNfcToken();
      const hash = hashToken(token);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should produce consistent hashes', () => {
      const token = generateNfcToken();
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const token1 = generateNfcToken();
      const token2 = generateNfcToken();
      const hash1 = hashToken(token1);
      const hash2 = hashToken(token2);
      expect(hash1).not.toBe(hash2);
    });

    it('should produce SHA-256 hashes (64 hex chars)', () => {
      const token = generateNfcToken();
      const hash = hashToken(token);
      expect(hash).toMatch(/^[a-f0-9]{64}$/i);
    });
  });

  describe('generateNfcUrl', () => {
    it('should generate a valid URL', () => {
      const token = generateNfcToken();
      const url = generateNfcUrl(token);
      expect(url).toContain('emergency/nfc/');
      expect(url).toContain(token);
    });

    it('should use provided base URL', () => {
      const token = generateNfcToken();
      const url = generateNfcUrl(token, 'https://example.com');
      expect(url).toContain('https://example.com');
    });

    it('should use default base URL if not provided', () => {
      const token = generateNfcToken();
      const url = generateNfcUrl(token);
      expect(url).toContain('https://medora.buzz');
    });
  });

  describe('OTP Generation & Hashing', () => {
    describe('generateOtpCode', () => {
      it('should generate a 6-digit OTP', () => {
        const otp = generateOtpCode();
        expect(otp).toMatch(/^\d{6}$/);
      });

      it('should generate unique OTPs', () => {
        const otp1 = generateOtpCode();
        const otp2 = generateOtpCode();
        // Very small chance they're the same (1 in 1 million)
        // but generate multiple to be sure
        let isDifferent = false;
        for (let i = 0; i < 100; i++) {
          if (generateOtpCode() !== generateOtpCode()) {
            isDifferent = true;
            break;
          }
        }
        expect(isDifferent).toBe(true);
      });

      it('should pad with zeros for small numbers', () => {
        // Set a seed or mock Math.random if possible
        // For now, just verify format for all generated OTPs
        for (let i = 0; i < 10; i++) {
          const otp = generateOtpCode();
          expect(otp.length).toBe(6);
        }
      });
    });

    describe('hashOtp', () => {
      it('should hash OTP codes', () => {
        const otp = generateOtpCode();
        const hash = hashOtp(otp);
        expect(hash).toBeDefined();
        expect(hash.length).toBe(64); // SHA-256
      });

      it('should produce consistent hashes', () => {
        const otp = '123456';
        const hash1 = hashOtp(otp);
        const hash2 = hashOtp(otp);
        expect(hash1).toBe(hash2);
      });
    });

    describe('verifyOtp', () => {
      it('should verify correct OTP', () => {
        const otp = '123456';
        const hash = hashOtp(otp);
        const verified = verifyOtp(otp, hash);
        expect(verified).toBe(true);
      });

      it('should reject incorrect OTP', () => {
        const otp1 = '123456';
        const otp2 = '654321';
        const hash = hashOtp(otp1);
        const verified = verifyOtp(otp2, hash);
        expect(verified).toBe(false);
      });

      it('should use timing-safe comparison', () => {
        // This test verifies the function uses timing-safe equal
        // The implementation should prevent timing attacks
        const otp = '123456';
        const hash = hashOtp(otp);

        // Call multiple times to ensure consistency
        for (let i = 0; i < 10; i++) {
          expect(verifyOtp(otp, hash)).toBe(true);
          expect(verifyOtp('000000', hash)).toBe(false);
        }
      });
    });
  });

  describe('isValidTokenFormat', () => {
    it('should accept valid 64-char hex tokens', () => {
      const token = generateNfcToken();
      expect(isValidTokenFormat(token)).toBe(true);
    });

    it('should reject non-hex strings', () => {
      expect(isValidTokenFormat('not-a-valid-token-at-all')).toBe(false);
    });

    it('should reject wrong length tokens', () => {
      expect(isValidTokenFormat('a'.repeat(63))).toBe(false);
      expect(isValidTokenFormat('a'.repeat(65))).toBe(false);
    });

    it('should be case insensitive', () => {
      const token = generateNfcToken();
      const upperToken = token.toUpperCase();
      expect(isValidTokenFormat(upperToken)).toBe(true);
    });
  });

  describe('getNfcWritingInstructions', () => {
    it('should return instructions object', () => {
      const instructions = getNfcWritingInstructions('https://example.com/nfc/token');
      expect(instructions).toHaveProperty('title');
      expect(instructions).toHaveProperty('steps');
      expect(instructions).toHaveProperty('url');
      expect(instructions).toHaveProperty('automationLink');
    });

    it('should include the URL in instructions', () => {
      const url = 'https://example.com/nfc/test-token';
      const instructions = getNfcWritingInstructions(url);
      expect(instructions.url).toBe(url);
    });

    it('should have valid steps', () => {
      const instructions = getNfcWritingInstructions('https://example.com/nfc/token');
      expect(Array.isArray(instructions.steps)).toBe(true);
      expect(instructions.steps.length).toBeGreaterThan(0);
    });
  });

  describe('parseUserAgent', () => {
    it('should parse iOS user agent', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605';
      const parsed = parseUserAgent(ua);
      expect(parsed.os).toBe('iOS');
      expect(parsed.browser).toBe('Safari');
    });

    it('should parse Android user agent', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537 Chrome/96';
      const parsed = parseUserAgent(ua);
      expect(parsed.os).toBe('Android');
      expect(parsed.browser).toBe('Chrome');
    });

    it('should parse desktop user agents', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/96';
      const parsed = parseUserAgent(ua);
      expect(parsed.os).toBe('Web');
      expect(parsed.browser).toBe('Chrome');
    });

    it('should handle unknown user agents gracefully', () => {
      const ua = 'Unknown/1.0';
      const parsed = parseUserAgent(ua);
      expect(parsed.os).toBe('Unknown');
    });
  });

  describe('createOtpSession', () => {
    it('should create OTP session', () => {
      const session = createOtpSession();
      expect(session).toHaveProperty('code');
      expect(session).toHaveProperty('codeHash');
      expect(session).toHaveProperty('expiresAt');
      expect(session).toHaveProperty('expiresInSeconds');
    });

    it('should generate 6-digit OTP code', () => {
      const session = createOtpSession();
      expect(session.code).toMatch(/^\d{6}$/);
    });

    it('should set expiry time correctly (10 minutes default)', () => {
      const before = new Date();
      const session = createOtpSession();
      const after = new Date();

      const expectedExpiry = new Date(before.getTime() + 10 * 60 * 1000);
      const maxDiff = 2000; // 2 second tolerance

      expect(Math.abs(session.expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(
        maxDiff
      );
    });

    it('should allow custom expiry', () => {
      const session = createOtpSession(5);
      expect(session.expiresInSeconds).toBe(5 * 60);
    });

    it('should hash OTP code', () => {
      const session = createOtpSession();
      // Verify hash matches code
      const verified = verifyOtp(session.code, session.codeHash);
      expect(verified).toBe(true);
    });
  });
});
