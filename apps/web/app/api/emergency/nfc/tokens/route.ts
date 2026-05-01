/**
 * GET /api/emergency/nfc/tokens
 * Lists all NFC tokens for a profile
 * Authentication: Required (authenticated user)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getTokensForProfile } from '@/../../packages/db';
import { getDbClient } from '@/lib/db';
import type { UserDocument } from '@/../../packages/db/users';
import type { ProfileDocument } from '@/../../packages/db/profiles';

export async function GET(req: NextRequest) {
  try {
    // Authentication
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Get user from database
    const db = await getDbClient();
    const usersCollection = db.collection<UserDocument>('users');
    const user = await usersCollection.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Verify user has access to this profile
    const profilesCollection = db.collection<ProfileDocument>('profiles');
    const profile = await profilesCollection.findOne({
      id: profileId,
      userId: user._id.toString(),
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found or access denied', code: 'PROFILE_NOT_FOUND' },
        { status: 403 }
      );
    }

    // Get tokens for profile
    const tokensCollection = db.collection('emergencyNfcTokens');
    const sortMap: Record<string, string> = {
      createdAt: 'createdAt',
      lastAccessAt: 'lastAccessAt',
      totalScans: 'totalScans',
    };
    const sortField = sortMap[sortBy] || 'createdAt';

    const [tokens, total] = await Promise.all([
      tokensCollection
        .find({ profileId })
        .sort({ [sortField]: sortOrder })
        .skip(offset)
        .limit(limit)
        .toArray(),
      tokensCollection.countDocuments({ profileId }),
    ]);

    // Format tokens for response
    const formattedTokens = tokens.map((token: any) => ({
      tokenId: token.id,
      deviceName: token.deviceName,
      createdAt: token.createdAt,
      lastAccessAt: token.lastAccessAt,
      totalScans: token.totalScans,
      isActive: token.isActive,
      isPermanent: token.isPermanent,
      revokedAt: token.revokedAt,
      otpRequired: token.otpRequiredForFullAccess,
      preAuthorizedDoctorCount: token.preAuthorizedAccessList.length,
      preAuthorizedDoctors: token.preAuthorizedAccessList
        .slice(0, 3)
        .map((doc: any) => ({
          doctorEmail: doc.doctorEmail,
          doctorName: doc.doctorName,
          expiresAt: doc.expiresAt,
        })),
      suspiciousActivityCount: token.suspiciousAccessCount,
      recentActivity: {
        lastAction: token.lastAccessAt ? 'view_public' : null,
        lastActionTime: token.lastAccessAt,
        lastActionCity: token.lastAccessLocation,
      },
    }));

    return NextResponse.json(
      {
        tokens: formattedTokens,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching NFC tokens:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', code: 'INVALID_QUERY' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
