/**
 * POST /api/emergency/nfc/authorize-doctor
 * Pre-authorizes a doctor for full access to an NFC token
 * Authentication: Required (authenticated user)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  addPreAuthorizedDoctor,
  findNfcTokenByHash,
} from '@/../../packages/db';
import { getDbClient } from '@/lib/db';
import type { UserDocument } from '@/../../packages/db/users';
import type { ProfileDocument } from '@/../../packages/db/profiles';

interface RequestBody {
  tokenId: string;
  doctorEmail: string;
  expiresInDays?: number;
  grantFullAccess?: boolean;
  notes?: string;
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

    // Get request body
    const body: RequestBody = await req.json();
    const {
      tokenId,
      doctorEmail,
      expiresInDays = 180,
      grantFullAccess = true,
      notes,
    } = body;

    // Validate required fields
    if (!tokenId || !doctorEmail) {
      return NextResponse.json(
        { error: 'tokenId and doctorEmail are required', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(doctorEmail)) {
      return NextResponse.json(
        { error: 'Invalid doctor email format', code: 'INVALID_EMAIL' },
        { status: 400 }
      );
    }

    // Validate expiry days (1-730 days, roughly 2 years)
    if (expiresInDays < 1 || expiresInDays > 730) {
      return NextResponse.json(
        { error: 'expiresInDays must be between 1 and 730', code: 'INVALID_EXPIRY' },
        { status: 400 }
      );
    }

    // Find token
    const tokenCollection = db.collection('emergencyNfcTokens');
    const token = await tokenCollection.findOne({ id: tokenId });

    if (!token) {
      return NextResponse.json(
        { error: 'Token not found', code: 'TOKEN_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (token.userId.toString() !== user._id.toString()) {
      return NextResponse.json(
        { error: 'Token not found or access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Check if doctor is already pre-authorized
    const existingAuth = token.preAuthorizedAccessList.find(
      (auth: any) => auth.doctorEmail.toLowerCase() === doctorEmail.toLowerCase()
    );

    if (existingAuth) {
      return NextResponse.json(
        { error: 'Doctor is already pre-authorized for this token', code: 'ALREADY_AUTHORIZED' },
        { status: 400 }
      );
    }

    // Check pre-auth limit (max 10 doctors per token)
    if (token.preAuthorizedAccessList.length >= 10) {
      return NextResponse.json(
        { error: 'Maximum pre-authorized doctors reached (10)', code: 'LIMIT_EXCEEDED' },
        { status: 400 }
      );
    }

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Generate UUID for pre-auth entry
    const uuid = generateUUID();

    // Create pre-auth entry
    const preAuthEntry = {
      id: uuid,
      doctorEmail: doctorEmail.toLowerCase(),
      doctorName: undefined, // TODO: Lookup doctor name from profiles
      fullAccessGranted: grantFullAccess,
      grantedAt: new Date(),
      grantedByUserId: user._id,
      expiresAt,
      notes,
    };

    // Add to database
    const success = await addPreAuthorizedDoctor(token.tokenHash, preAuthEntry);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to authorize doctor', code: 'AUTHORIZATION_FAILED' },
        { status: 500 }
      );
    }

    // TODO: Send email to doctor notifying them of pre-authorization

    return NextResponse.json(
      {
        success: true,
        authorizationId: uuid,
        tokenId,
        doctorEmail,
        grantedAt: preAuthEntry.grantedAt,
        expiresAt,
        grantFullAccess,
        message: `Dr. ${doctorEmail} will now have instant full access when tapping this card.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error authorizing doctor:', error);

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

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
