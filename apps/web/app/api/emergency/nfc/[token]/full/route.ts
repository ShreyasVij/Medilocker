/**
 * GET /api/emergency/nfc/[token]/full
 * Returns full emergency profile after OTP verification or pre-auth
 * No authentication required - uses access token from OTP verification
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import {
  findNfcTokenByHash,
  findOtpSession,
  findPreAuthDoctorForToken,
  createAccessLog,
} from '@/../../packages/db';
import { getDbClient } from '@/lib/db';
import { filterToFullProfile } from '@/lib/emergencyNfcFilters';
import { parseUserAgent, hashToken } from '@/lib/nfcGenerator';
import { getGeolocationFromIp } from '@/lib/geolocation';
import type { ProfileDocument } from '@/../../packages/db/profiles';

function getClientInfo(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return { ip, userAgent };
}

interface AccessTokenPayload {
  sessionId: string;
  tokenId: string;
  userId: string;
  profileId: string;
  scope: string;
  iat: number;
  exp: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { ip, userAgent } = getClientInfo(req);
    const { token } = await params;

    // Get access token from query or bearer header
    const { searchParams } = new URL(req.url);
    let accessToken = searchParams.get('accessToken');

    if (!accessToken) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token required', code: 'NO_ACCESS_TOKEN' },
        { status: 401 }
      );
    }

    // Validate token format
    if (!token || token.length !== 64 || !/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json(
        { error: 'Invalid token format', code: 'INVALID_TOKEN' },
        { status: 404 }
      );
    }

    // Hash the token for lookup
    const tokenHash = hashToken(token);
    const db = await getDbClient();

    // Find NFC token
    const nfcToken = await findNfcTokenByHash(tokenHash);

    if (!nfcToken) {
      return NextResponse.json(
        { error: 'Token not found', code: 'TOKEN_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if token is active
    if (!nfcToken.isActive || nfcToken.revokedAt) {
      return NextResponse.json(
        { error: 'Token has been revoked', code: 'TOKEN_REVOKED' },
        { status: 410 }
      );
    }

    // Verify access token
    let accessTokenPayload: AccessTokenPayload | null = null;
    let accessGrantedReason = 'otp_verified';

    try {
      accessTokenPayload = jwt.verify(accessToken, process.env.NFC_ACCESS_TOKEN_SECRET || (() => {
        throw new Error('NFC_ACCESS_TOKEN_SECRET environment variable is not set');
      })()) as AccessTokenPayload;

      // Verify token matches
      if (accessTokenPayload.tokenId !== nfcToken.id) {
        return NextResponse.json(
          { error: 'Access token does not match token', code: 'INVALID_ACCESS_TOKEN' },
          { status: 403 }
        );
      }

      // Verify scope
      if (accessTokenPayload.scope !== 'full') {
        return NextResponse.json(
          { error: 'Access token does not have full access scope', code: 'INSUFFICIENT_SCOPE' },
          { status: 403 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired access token', code: 'INVALID_ACCESS_TOKEN' },
        { status: 403 }
      );
    }

    // Get profile
    const profilesCollection = db.collection<ProfileDocument>('profiles');
    const profile = await profilesCollection.findOne({ id: nfcToken.profileId });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found', code: 'PROFILE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get enrichment data
    const userVitals = await db.collection('userVitals').findOne({
      userId: profile.userId,
    });

    const healthSummary = await db.collection('userHealthSummary').findOne({
      userId: profile.userId,
      profileId: nfcToken.profileId,
    });

    const labResults = await db
      .collection('labStructured')
      .find({ userId: profile.userId })
      .sort({ testDate: -1 })
      .limit(20)
      .toArray();

    const documents = await db
      .collection('documents')
      .find({ ownerUserId: profile.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    // Filter to full profile
    const fullProfile = filterToFullProfile(
      profile,
      userVitals?.data,
      healthSummary,
      labResults,
      documents
    );

    // Get device info
    const deviceInfo = parseUserAgent(userAgent);

    // Get geolocation
    const geoLocation = await getGeolocationFromIp(ip);

    // Create access log
    await createAccessLog(
      nfcToken.id,
      nfcToken.profileId,
      nfcToken.userId,
      'full_access_granted',
      ip,
      userAgent,
      200,
      'full',
      {
        deviceOs: deviceInfo.os,
        deviceBrowser: deviceInfo.browser,
        geoLocation,
        otpFlow: {
          otpSessionId: accessTokenPayload?.sessionId,
          verified: true,
        },
      }
    );

    return NextResponse.json(
      {
        fullProfile,
        accessInfo: {
          grantedAt: new Date(),
          grantedUntil: new Date(accessTokenPayload?.exp * 1000 || Date.now() + 30 * 60 * 1000),
          accessReason: accessGrantedReason,
          timeRemainingMinutes: Math.floor(
            (accessTokenPayload?.exp * 1000 - Date.now()) / 60000
          ),
          accessExpiredMessage:
            'Access will expire in X minutes. Screenshot now if needed for records.',
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('Error retrieving full emergency profile:', error);

    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
