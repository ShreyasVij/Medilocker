/**
 * POST /api/emergency/nfc/request-full-access
 * Initiates OTP flow for full access to emergency profile
 * No authentication required - public endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import {
  findNfcTokenByHash,
  createOtpSession,
  incrementOtpRequest,
  getActiveOtpForToken,
  createAccessLog,
} from '@/../../packages/db';
import { getDbClient } from '@/lib/db';
import { nfcOtpRequestLimiter } from '@/lib/rateLimiter';
import { generateOtpCode, createOtpSession as createOtpData, parseUserAgent, hashToken } from '@/lib/nfcGenerator';
import { getGeolocationFromIp } from '@/lib/geolocation';
import { sendNfcOtpEmail } from '@/lib/emailHooks';
import type { ProfileDocument } from '@/../../packages/db/profiles';

interface RequestBody {
  token: string;
  requestMessage?: string;
  responderName?: string;
  responderOrganization?: string;
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
    if (!nfcOtpRequestLimiter.isAllowed(ip)) {
      const retryAfter = nfcOtpRequestLimiter.getRetryAfter(ip);
      return NextResponse.json(
        {
          error: 'Too many OTP requests. Please wait before requesting another.',
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
    const { token, requestMessage, responderName, responderOrganization } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'token is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Validate token format
    if (token.length !== 64 || !/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json(
        { error: 'Invalid token format', code: 'INVALID_TOKEN' },
        { status: 404 }
      );
    }

    // Hash and lookup token
    const tokenHash = hashToken(token);
    const db = await getDbClient();
    const nfcToken = await findNfcTokenByHash(tokenHash);

    if (!nfcToken) {
      return NextResponse.json(
        { error: 'Token not found', code: 'TOKEN_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if token is active
    if (!nfcToken.isActive || nfcToken.revokedAt) {
      await createAccessLog(
        nfcToken.id,
        nfcToken.profileId,
        nfcToken.userId,
        'token_revoked_access',
        ip,
        userAgent,
        410,
        'none'
      );

      return NextResponse.json(
        { error: 'Token has been revoked', code: 'TOKEN_REVOKED' },
        { status: 410 }
      );
    }

    // Check if OTP is required
    if (!nfcToken.otpRequiredForFullAccess) {
      // Pre-auth access without OTP
      return NextResponse.json(
        {
          error: 'OTP not required for this token. Use pre-authorized access.',
          code: 'OTP_NOT_REQUIRED',
        },
        { status: 400 }
      );
    }

    // Check if there's already an active OTP session
    const existingOtp = await getActiveOtpForToken(nfcToken.id);
    if (existingOtp) {
      return NextResponse.json(
        {
          error: 'OTP already sent. Please use existing code or wait for it to expire.',
          code: 'OTP_ALREADY_SENT',
          sessionId: existingOtp.id,
          expiresAt: existingOtp.expiresAt,
        },
        { status: 400 }
      );
    }

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
    const deviceInfo = parseUserAgent(userAgent);

    // Get patient profile to fetch email
    const profilesCollection = db.collection<ProfileDocument>('profiles');
    const patientProfile = await profilesCollection.findOne({
      id: nfcToken.profileId,
    });

    if (!patientProfile) {
      return NextResponse.json(
        { error: 'Patient profile not found', code: 'PROFILE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get the NFC token's user (patient) to get their email
    const usersCollection = db.collection('users');
    const patientUser = await usersCollection.findOne({ _id: new ObjectId(nfcToken.userId) });

    // Use override email, then patient user email, or fallback
    const patientEmailAddress = nfcToken.otpSendTo ||
      patientUser?.email ||
      null;

    if (!patientEmailAddress) {
      return NextResponse.json(
        {
          error: 'Patient email address not found',
          code: 'NO_EMAIL_ADDRESS',
        },
        { status: 400 }
      );
    }

    // Generate OTP
    const otpCode = generateOtpCode();
    const otpData = createOtpData(nfcToken.otpExpiryMinutes);

    // Create OTP session
    const otpSession = await createOtpSession(
      nfcToken.id,
      nfcToken.userId,
      nfcToken.profileId,
      'email',
      patientEmailAddress,
      patientEmailAddress.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Masked version
      otpData.codeHash,
      {
        otpExpiryMinutes: nfcToken.otpExpiryMinutes,
        requestContext: {
          responderName,
          responderOrganization,
          requestReason: requestMessage,
          requestIp: ip,
          requestUserAgent: userAgent,
          requestGeoLocation: {
            city: geoLocation?.city,
            country: geoLocation?.country,
          },
        },
        source: 'nfc_tap',
      }
    );

    // Increment OTP request count
    await incrementOtpRequest(tokenHash);

    // Create access log
    await createAccessLog(
      nfcToken.id,
      nfcToken.profileId,
      nfcToken.userId,
      'otp_sent',
      ip,
      userAgent,
      200,
      'none',
      {
        deviceOs: deviceInfo.os,
        deviceBrowser: deviceInfo.browser,
        geoLocation,
        responderContext: {
          name: responderName,
          organization: responderOrganization,
        },
        otpFlow: {
          otpSessionId: otpSession.id,
          deliveryMethod: 'email',
          sentToMasked: otpSession.deliveredToMasked,
        },
      }
    );

    // Send OTP email to patient
    const emailSent = await sendNfcOtpEmail({
      to: patientEmailAddress,
      patientName: patientProfile.displayName,
      otpCode: otpCode,
      responderInfo: {
        name: responderName,
        organization: responderOrganization,
      },
      expiresInMinutes: nfcToken.otpExpiryMinutes,
    });

    if (!emailSent) {
      console.error(`Failed to send OTP email to ${patientEmailAddress}`);
      // Still allow OTP session creation (doctor can enter code if patient sees email eventually)
      // But log this for monitoring
    }

    return NextResponse.json(
      {
        success: true,
        sessionId: otpSession.id,
        otpSent: true,
        sentTo: otpSession.deliveredToMasked,
        otpExpiresIn: otpData.expiresInSeconds,
        otpExpiresAt: otpData.expiresAt,
        message: `OTP sent to ${otpSession.deliveredToMasked}. Valid for ${nfcToken.otpExpiryMinutes} minutes.`,
        instructions: {
          step1: 'Ask patient for the 6-digit OTP code',
          step2: 'Enter the code below',
          step3: 'Complete verification to unlock full records',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error requesting OTP:', error);

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
