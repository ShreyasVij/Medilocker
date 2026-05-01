/**
 * GET /api/emergency/nfc/[token]
 * Retrieves public emergency profile
 * No authentication required - public endpoint
 * Rate limited: 20 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import {
  findNfcTokenByHash,
  updateTokenAccess,
  createAccessLog,
} from '@/../../packages/db';
import { getDbClient } from '@/lib/db';
import { nfcPublicAccessLimiter } from '@/lib/rateLimiter';
import { filterToPublicProfile, getAccessedFields } from '@/lib/emergencyNfcFilters';
import { parseUserAgent, hashToken } from '@/lib/nfcGenerator';
import { getGeolocationFromIp } from '@/lib/geolocation';
import { detectAnomalies } from '@/lib/anomalyDetector';
import { sendNfcAccessNotificationEmail } from '@/lib/emailHooks';
import type { ProfileDocument } from '@/../../packages/db/profiles';
import type { UserDocument } from '@/../../packages/db/users';

function getClientInfo(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return { ip, userAgent };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const startTime = Date.now();
  try {
    const { ip, userAgent } = getClientInfo(req);
    const { token } = await params;

    // Rate limiting per IP
    if (!nfcPublicAccessLimiter.isAllowed(ip)) {
      const retryAfter = nfcPublicAccessLimiter.getRetryAfter(ip);
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
          },
        }
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

    // Find token in database
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
      // Log the access attempt
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

    // Parse device info
    const deviceInfo = parseUserAgent(userAgent);

    // Get geolocation
    const geoLocation = await getGeolocationFromIp(ip);

    // Get profile from database
    const profilesCollection = db.collection<ProfileDocument>('profiles');
    const profile = await profilesCollection.findOne({ id: nfcToken.profileId });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found', code: 'PROFILE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get user email for notifications
    const usersCollection = db.collection<UserDocument>('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(nfcToken.userId) });

    // Get user vitals and health summary for enrichment
    const userVitals = await db.collection('userVitals').findOne({
      userId: profile.userId,
    });

    const healthSummary = await db.collection('userHealthSummary').findOne({
      userId: profile.userId,
      profileId: nfcToken.profileId,
    });

    // Filter to public profile
    const publicProfile = filterToPublicProfile(profile, userVitals?.data, healthSummary);

    // Update token access stats
    await updateTokenAccess(tokenHash, ip, geoLocation?.city || geoLocation?.country);

    // Detect anomalies
    const recentLogs = await db
      .collection('emergencyNfcAccessLogs')
      .find({ tokenId: nfcToken.id })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    const recentAccesses = recentLogs.map((log: any) => ({
      timestamp: log.timestamp,
      ip: log.ip,
      location: log.geoLocation,
      action: log.action,
    }));

    const anomaly = detectAnomalies({
      recentAccesses,
      timestamp: new Date(),
      geoLocation,
      recentDeviceAccesses: recentLogs.map((log: any) => ({
        timestamp: log.timestamp,
        deviceOs: log.deviceOs,
        deviceBrowser: log.deviceBrowser,
      })),
    });

    // Create access log
    const accessLog = await createAccessLog(
      nfcToken.id,
      nfcToken.profileId,
      nfcToken.userId,
      'view_public',
      ip,
      userAgent,
      200,
      'public',
      {
        deviceOs: deviceInfo.os,
        deviceBrowser: deviceInfo.browser,
        deviceName: deviceInfo.deviceName,
        geoLocation,
        flaggedAsAnomalous: anomaly.flagged,
        anomalyReasons: anomaly.reasons,
        anomalySeverity: anomaly.severity,
        responseTimeMs: Date.now() - startTime,
      }
    );

    // Send patient notification if anomaly or first access
    if (anomaly.flagged || recentLogs.length === 0) {
      try {
        if (user?.email) {
          await sendNfcAccessNotificationEmail({
            to: user.email,
            patientName: profile.displayName,
            dataAccessLevel: 'public',
            accessTime: new Date(),
          });
        }
      } catch (err) {
        console.error('Failed to send access notification:', err);
        // Don't fail the request if notification fails
      }
    }

    return NextResponse.json(
      {
        emergencyProfile: publicProfile,
        accessControl: {
          otpRequired: nfcToken.otpRequiredForFullAccess,
          canRequestFullAccess: true,
          preAuthByDoctorCount: nfcToken.preAuthorizedAccessList.length,
          fullAccessMessage: nfcToken.otpRequiredForFullAccess
            ? 'To view complete medical records, medications, and insurance details, you can request access via one-time password sent to the patient.'
            : 'Full access available.',
        },
        tokenMetadata: {
          tokenCreatedAt: nfcToken.createdAt,
          lastAccessedAt: nfcToken.lastAccessAt,
          totalAccesses: nfcToken.totalScans,
          isTokenValid: nfcToken.isActive && !nfcToken.revokedAt,
          tokenExpiresAt: null,
        },
        ...(anomaly.flagged && {
          anomalyWarning: {
            flagged: true,
            severity: anomaly.severity,
            reasons: anomaly.reasons,
          },
        }),
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Remaining': nfcPublicAccessLimiter.getRemainingRequests(ip).toString(),
          'X-RateLimit-Reset': nfcPublicAccessLimiter.getResetTime(ip).toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('Error retrieving emergency profile:', error);

    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
