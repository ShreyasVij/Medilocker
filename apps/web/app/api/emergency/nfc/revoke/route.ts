/**
 * POST /api/emergency/nfc/revoke
 * Revokes an NFC emergency access token
 * Authentication: Required (authenticated user)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { revokeNfcToken, findNfcTokenByHash } from '@/../../packages/db';
import { getDbClient } from '@/lib/db';
import type { UserDocument } from '@/../../packages/db/users';

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
    const body = await req.json();
    const { tokenId, reason = 'Revoked by user' } = body;

    if (!tokenId) {
      return NextResponse.json(
        { error: 'tokenId is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Find the token to verify ownership
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

    // Revoke the token
    const success = await revokeNfcToken(token.tokenHash, reason);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to revoke token', code: 'REVOKE_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        tokenId,
        revokedAt: new Date(),
        message: 'Token revoked. All future access attempts will be blocked.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error revoking NFC token:', error);

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
