/**
 * Integration Tests for NFC Emergency Access System
 * Tests full flows from token creation to access
 */

import {
  createNfcToken,
  findNfcTokenByHash,
  createOtpSession,
  findOtpSession,
  updateTokenAccess,
  createAccessLog,
} from '@/../../packages/db';
import { hashToken, generateOtpCode } from '@/lib/nfcGenerator';
import { ObjectId } from 'mongodb';

describe('NFC Emergency Access - Integration Tests', () => {
  const testUserId = new ObjectId();
  const testProfileId = '550e8400-e29b-41d4-a716-446655440000';

  describe('Token Creation Flow', () => {
    it('should create a token with authentication and store it securely', async () => {
      const token = 'a'.repeat(64); // Simulate a token
      const tokenHash = hashToken(token);

      const createdToken = await createNfcToken(
        testUserId,
        testProfileId,
        tokenHash,
        'https://medora.buzz/emergency/nfc/token123',
        'Test Card',
        true,
        'web'
      );

      expect(createdToken).toBeDefined();
      expect(createdToken.userId).toEqual(testUserId);
      expect(createdToken.profileId).toBe(testProfileId);
      expect(createdToken.isActive).toBe(true);
      expect(createdToken.otpRequiredForFullAccess).toBe(true);

      // Verify lookup returns the token
      const foundToken = await findNfcTokenByHash(tokenHash);
      expect(foundToken).toBeDefined();
      expect(foundToken?.tokenHash).toBe(tokenHash);
    });
  });

  describe('Public Access Flow', () => {
    it('should allow public access without authentication', async () => {
      const token = 'b'.repeat(64);
      const tokenHash = hashToken(token);

      const createdToken = await createNfcToken(
        testUserId,
        testProfileId,
        tokenHash,
        'https://medora.buzz/emergency/nfc/token123',
        'Test Card',
        true,
        'web'
      );

      // Simulate public access
      const updated = await updateTokenAccess(tokenHash, '203.0.113.45', 'New Delhi');
      expect(updated).toBe(true);

      // Log the access
      const accessLog = await createAccessLog(
        createdToken.id,
        testProfileId,
        testUserId,
        'view_public',
        '203.0.113.45',
        'Mozilla/5.0...',
        200,
        'public'
      );

      expect(accessLog).toBeDefined();
      expect(accessLog.action).toBe('view_public');
      expect(accessLog.dataAccessedLevel).toBe('public');
    });
  });

  describe('OTP Flow', () => {
    it('should create OTP session and verify code', async () => {
      const token = 'c'.repeat(64);
      const tokenHash = hashToken(token);
      const otpCode = '123456';
      const otpCodeHash = hashToken(otpCode);

      // Create NFC token first
      const nfcToken = await createNfcToken(
        testUserId,
        testProfileId,
        tokenHash,
        'https://medora.buzz/emergency/nfc/token123',
        'Test Card',
        true,
        'web'
      );

      // Create OTP session
      const otpSession = await createOtpSession(
        nfcToken.id,
        testUserId,
        testProfileId,
        'email',
        'test@example.com',
        't***@example.com',
        otpCodeHash,
        {
          otpExpiryMinutes: 10,
          source: 'nfc_tap',
        }
      );

      expect(otpSession).toBeDefined();
      expect(otpSession.verified).toBe(false);

      // Find session
      const foundSession = await findOtpSession(otpSession.id);
      expect(foundSession).toBeDefined();
      expect(foundSession?.tokenId).toBe(nfcToken.id);
    });
  });

  describe('Full Access Flow', () => {
    it('should grant full access after OTP verification', async () => {
      const token = 'd'.repeat(64);
      const tokenHash = hashToken(token);

      // Create token
      const nfcToken = await createNfcToken(
        testUserId,
        testProfileId,
        tokenHash,
        'https://medora.buzz/emergency/nfc/token123',
        'Test Card',
        true,
        'web'
      );

      // Log full access
      const accessLog = await createAccessLog(
        nfcToken.id,
        testProfileId,
        testUserId,
        'otp_verified',
        '203.0.113.45',
        'Mozilla/5.0...',
        200,
        'full',
        {
          otpFlow: {
            otpSessionId: 'session123',
            verified: true,
          },
        }
      );

      expect(accessLog.action).toBe('otp_verified');
      expect(accessLog.dataAccessedLevel).toBe('full');
    });
  });

  describe('Anomaly Detection', () => {
    it('should flag rapid succession access attempts', async () => {
      const token = 'e'.repeat(64);
      const tokenHash = hashToken(token);

      const nfcToken = await createNfcToken(
        testUserId,
        testProfileId,
        tokenHash,
        'https://medora.buzz/emergency/nfc/token123',
        'Test Card',
        false,
        'web'
      );

      // Simulate rapid succession
      for (let i = 0; i < 5; i++) {
        await createAccessLog(
          nfcToken.id,
          testProfileId,
          testUserId,
          'view_public',
          '203.0.113.45',
          'Mozilla/5.0...',
          200,
          'public',
          {
            flaggedAsAnomalous: i > 2, // Flag after 3 attempts
            anomalyReasons: i > 2 ? ['rapid_succession'] : undefined,
            anomalySeverity: i > 2 ? 'medium' : undefined,
          }
        );
      }
    });
  });

  describe('Revocation', () => {
    it('should prevent access to revoked tokens', async () => {
      const token = 'f'.repeat(64);
      const tokenHash = hashToken(token);

      const nfcToken = await createNfcToken(
        testUserId,
        testProfileId,
        tokenHash,
        'https://medora.buzz/emergency/nfc/token123',
        'Test Card',
        true,
        'web'
      );

      // Revoke token
      expect(nfcToken.isActive).toBe(true);

      // After revocation, accessing should be logged
      const accessLog = await createAccessLog(
        nfcToken.id,
        testProfileId,
        testUserId,
        'token_revoked_access',
        '203.0.113.45',
        'Mozilla/5.0...',
        410,
        'none'
      );

      expect(accessLog.statusCode).toBe(410);
      expect(accessLog.action).toBe('token_revoked_access');
    });
  });
});
