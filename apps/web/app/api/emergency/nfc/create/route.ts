/**
 * POST /api/emergency/nfc/create
 * Creates a new NFC emergency access token
 * Authentication: Required (authenticated user)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ObjectId } from 'mongodb';
import {
  createNfcToken,
  getTokensForUser,
  addPreAuthorizedDoctor,
  type PreAuthorizedDoctor,
} from '@/../../packages/db';
import type { UserDocument } from '@/../../packages/db/users';
import type { ProfileDocument } from '@/../../packages/db/profiles';
import { getDbClient } from '@/lib/db';
import { generateNfcTokenBundle } from '@/lib/nfcGenerator';
import { nfcTokenCreationLimiter } from '@/lib/rateLimiter';

function getClientInfo(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return { ip, userAgent };
}

/**
 * Generate a UUID string
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function POST(req: NextRequest) {
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

    // Rate limiting - per user
    const userId = user._id.toString();
    if (!nfcTokenCreationLimiter.isAllowed(userId)) {
      const retryAfter = nfcTokenCreationLimiter.getRetryAfter(userId);
      return NextResponse.json(
        {
          error: 'Too many tokens created. Please wait before creating another.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': '3',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': nfcTokenCreationLimiter.getResetTime(userId).toString(),
          },
        }
      );
    }

    // Get request body
    const body = await req.json();
    const {
      profileId,
      deviceName,
      isPermanent = true,
      otpRequiredForFullAccess = true,
      otpExpiryMinutes = 10,
      preAuthorizedDoctors = [],
    } = body;

    // Validate required fields
    if (!profileId || !deviceName) {
      return NextResponse.json(
        { error: 'deviceName and profileId are required', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Verify user has access to this profile
    // Handle two cases: self-profile (profileId === user._id) or dependent profile in collection
    let profile: ProfileDocument | { id: string; displayName: string } | null = null;

    if (profileId === user._id.toString()) {
      // Self profile - construct from user document
      const usersCollection = db.collection<UserDocument>('users');
      const userDoc = await usersCollection.findOne({ _id: user._id });
      if (userDoc) {
        profile = {
          id: user._id.toString(),
          displayName: userDoc.name || 'User',
        };
      }
    } else {
      // Check if it's a dependent profile in the profiles collection
      const profilesCollection = db.collection<ProfileDocument>('profiles');
      profile = await profilesCollection.findOne({
        id: profileId,
        userId: user._id.toString(),
      });
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found or access denied', code: 'PROFILE_NOT_FOUND' },
        { status: 403 }
      );
    }

    // Check token limit
    const existingTokens = await getTokensForUser(user._id);
    if (existingTokens.length >= 10) {
      return NextResponse.json(
        { error: 'Maximum NFC tokens reached (10)', code: 'TOKEN_LIMIT_EXCEEDED' },
        { status: 400 }
      );
    }

    // Get client info
    const { ip, userAgent } = getClientInfo(req);

    // Get base URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://medora.buzz';

    // Generate NFC token bundle
    const bundle = await generateNfcTokenBundle(baseUrl);

    // Create token in database
    const createdToken = await createNfcToken(
      user._id,
      profileId,
      bundle.tokenHash,
      bundle.nfcUrl,
      deviceName,
      otpRequiredForFullAccess,
      'web'
    );

    // Add pre-authorized doctors if provided
    if (preAuthorizedDoctors && Array.isArray(preAuthorizedDoctors) && preAuthorizedDoctors.length > 0) {
      // Add pre-authorized doctors to the token
      for (const doctor of preAuthorizedDoctors) {
        const doctorAuth: PreAuthorizedDoctor = {
          id: generateUUID(),
          doctorEmail: doctor.doctorEmail.toLowerCase(), // Normalize email
          doctorName: doctor.doctorName,
          fullAccessGranted: doctor.grantFullAccess !== false, // Default to true
          grantedAt: new Date(),
          grantedByUserId: user._id,
          expiresAt: doctor.expiresInDays
            ? new Date(Date.now() + doctor.expiresInDays * 24 * 60 * 60 * 1000)
            : null, // null = permanent
          notes: doctor.notes,
        };

        // Add doctor to token's pre-auth list
        const addedSuccessfully = await addPreAuthorizedDoctor(
          bundle.tokenHash,
          doctorAuth
        );

        if (!addedSuccessfully) {
          console.warn(
            `Failed to add pre-authorized doctor ${doctor.doctorEmail} to token ${createdToken.id}`
          );
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        tokenId: createdToken.id,
        nfcUrl: bundle.nfcUrl,
        rawToken: bundle.rawToken,
        qrCode: bundle.qrCodeUrl,
        instructions: bundle.instructions,
        message: 'NFC token created successfully. Show this page to write URL to your NFC card.',
        deviceName,
        createdAt: createdToken.createdAt,
        preAuthorization: {
          doctorsAdded: preAuthorizedDoctors?.length || 0,
          doctors: preAuthorizedDoctors?.map((d: any) => ({
            email: d.doctorEmail,
            expiresAt: d.expiresInDays
              ? new Date(Date.now() + d.expiresInDays * 24 * 60 * 60 * 1000)
              : null,
          })),
        },
      },
      {
        status: 201,
        headers: {
          'X-RateLimit-Limit': '3',
          'X-RateLimit-Remaining': nfcTokenCreationLimiter.getRemainingRequests(userId).toString(),
          'X-RateLimit-Reset': nfcTokenCreationLimiter.getResetTime(userId).toString(),
        },
      }
    );
  } catch (error) {
    console.error('Error creating NFC token:', error);

    // Handle validation errors
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
