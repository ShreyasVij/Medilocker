/**
 * POST /api/emergency/nfc/verify-otp
 * Verifies OTP code and grants full access
 * No authentication required - public endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import {
  findOtpSession,
  verifyOtp as markOtpVerified,
  recordOtpAttempt,
  flagOtpAsAnomalous,
  markOtpFailed,
  findNfcTokenByHash,
  incrementOtpVerified,
  createAccessLog,
  countRecentFailedAttempts,
} from '@/../../packages/db';
import { getDbClient } from '@/lib/db';
import { nfcOtpVerificationLimiter } from '@/lib/rateLimiter';
import { verifyOtp, parseUserAgent, hashToken } from '@/lib/nfcGenerator';
import { getGeolocationFromIp } from '@/lib/geolocation';
import { sendNfcAccessNotificationEmail } from '@/lib/emailHooks';
import type { ProfileDocument } from '@/../../packages/db/profiles';
import type { UserDocument } from '@/../../packages/db/users';

interface RequestBody {
  sessionId: string;
  otp: string;
}

function getClientInfo(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return { ip, userAgent };
}

export async function POST(req: NextRequest) {
  try {
    const { ip, userAgent } = getClientInfo(req);

    // Rate limiting per IP
    if (!nfcOtpVerificationLimiter.isAllowed(ip)) {
      const retryAfter = nfcOtpVerificationLimiter.getRetryAfter(ip);
      return NextResponse.json(
        {
          error: 'Too many OTP verification attempts. Please wait before trying again.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    // Get request body
    const body: RequestBody = await req.json();
    const { sessionId, otp } = body;

    if (!sessionId || !otp) {
      return NextResponse.json(
        { error: 'sessionId and otp are required', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'Invalid OTP format', code: 'INVALID_OTP_FORMAT' },
        { status: 400 }
      );
    }

    // Get database
    const db = await getDbClient();

    // Find OTP session
    const otpSession = await findOtpSession(sessionId);

    if (!otpSession) {
      return NextResponse.json(
        { error: 'OTP session not found', code: 'SESSION_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if already verified
    if (otpSession.verified) {
      return NextResponse.json(
        {
          error: 'OTP already verified',
          code: 'OTP_ALREADY_VERIFIED',
          accessGrantedUntil: otpSession.grantedUntil,
        },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date() > otpSession.expiresAt) {
      await markOtpFailed(sessionId, 'expired');
      return NextResponse.json(
        { error: 'OTP has expired', code: 'OTP_EXPIRED' },
        { status: 400 }
      );
    }

    // Fetch the NFC token early for use throughout the function
    const nfcTokenFromDb = await db.collection('emergencyNfcTokens').findOne({ id: otpSession.tokenId });

    if (!nfcTokenFromDb) {
      console.error(`NFC token not found for tokenId: ${otpSession.tokenId}`);
      return NextResponse.json(
        {
          error: 'NFC token not found',
          code: 'TOKEN_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Record attempt
    await recordOtpAttempt(sessionId, ip);

    // Check if max attempts exceeded
    if (otpSession.attemptCount >= otpSession.maxAttempts) {
      await markOtpFailed(sessionId, 'max_attempts_exceeded');
      await flagOtpAsAnomalous(sessionId);

      // Log anomaly
      const nfcTokenFromDb = await db
        .collection('emergencyNfcTokens')
        .findOne({ id: otpSession.tokenId });

      if (nfcTokenFromDb) {
        await createAccessLog(
          nfcTokenFromDb.id,
          otpSession.profileId,
          otpSession.userId,
          'anomaly_detected',
          ip,
          userAgent,
          429,
          'none',
          {
            anomalyReasons: ['otp_brute_force'],
            anomalySeverity: 'high',
            flaggedAsAnomalous: true,
          }
        );
      }

      return NextResponse.json(
        {
          error: 'Maximum OTP attempts exceeded. Session locked.',
          code: 'MAX_ATTEMPTS_EXCEEDED',
        },
        { status: 429 }
      );
    }

    // Verify OTP
    const isValid = verifyOtp(otp, otpSession.otpCode);

    if (!isValid) {
      const attemptsRemaining = otpSession.maxAttempts - otpSession.attemptCount;

      // Log failed attempt
      await createAccessLog(
        nfcTokenFromDb.id,
        otpSession.profileId,
        otpSession.userId,
        'otp_attempted',
        ip,
        userAgent,
        400,
        'none',
        {
          otpFlow: {
            otpSessionId: sessionId,
            attempts: otpSession.attemptCount + 1,
          },
        }
      );

      return NextResponse.json(
        {
          error: `Invalid OTP. Attempts remaining: ${attemptsRemaining}`,
          code: 'INVALID_OTP',
          attemptsRemaining,
        },
        { status: 400 }
      );
    }

    // OTP is valid - grant access
    const grantedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Create JWT access token
    const accessToken = jwt.sign(
      {
        sessionId,
        tokenId: otpSession.tokenId,
        userId: otpSession.userId.toString(),
        profileId: otpSession.profileId,
        scope: 'full',
      },
      process.env.NFC_ACCESS_TOKEN_SECRET || 'dev-secret-key',
      { expiresIn: '30m' }
    );

    // Mark OTP as verified
    await markOtpVerified(sessionId, accessToken);

    // Increment token verification count
    await incrementOtpVerified(nfcTokenFromDb.tokenHash);

    // Parse device info
    const deviceInfo = parseUserAgent(userAgent);

    // Get geolocation with timeout (non-blocking if fails)
    let geoLocation = null;
    try {
      const geoPromise = getGeolocationFromIp(ip);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Geolocation timeout')), 5000)
      );
      geoLocation = await Promise.race([geoPromise, timeoutPromise]);
    } catch (err) {
      console.warn('Geolocation lookup failed, continuing without it:', err);
      geoLocation = null;
    }

    // Create access log
    await createAccessLog(
      nfcTokenFromDb.id,
      otpSession.profileId,
      otpSession.userId,
      'otp_verified',
      ip,
      userAgent,
      200,
      'full',
      {
        deviceOs: deviceInfo.os,
        deviceBrowser: deviceInfo.browser,
        geoLocation,
        otpFlow: {
          otpSessionId: sessionId,
          verified: true,
          attempts: otpSession.attemptCount + 1,
        },
        responderContext: otpSession.requestContext
          ? {
              name: otpSession.requestContext.responderName,
              organization: otpSession.requestContext.responderOrganization,
            }
          : undefined,
      }
    );

    // Send patient notification about full access grant
    try {
      // Get patient user email from OTP session
      const db = await getDbClient();
      const patientUser = await db
        .collection<UserDocument>('users')
        .findOne({ _id: new ObjectId(otpSession.userId) });

      if (patientUser?.email) {
        const patientProfile = await db
          .collection<ProfileDocument>('profiles')
          .findOne({ id: otpSession.profileId });

        await sendNfcAccessNotificationEmail({
          to: patientUser.email,
          patientName: patientProfile?.displayName || 'Patient',
          responderInfo: otpSession.requestContext
            ? {
                name: otpSession.requestContext.responderName,
                organization: otpSession.requestContext.responderOrganization,
              }
            : undefined,
          dataAccessLevel: 'full',
          accessTime: new Date(),
        });
      }
    } catch (err) {
      console.error('Failed to send access notification:', err);
      // Don't fail the OTP verification if notification fails
    }

    return NextResponse.json(
      {
        success: true,
        accessGrantedUntil: grantedUntil,
        accessToken,
        tokenExpirySeconds: 30 * 60,
        message: 'Access granted for 30 minutes. You can now view complete medical records.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error verifying OTP:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
