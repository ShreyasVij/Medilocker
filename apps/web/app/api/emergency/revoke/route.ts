import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import {
  revokeToken,
  revokeAllActiveTokensForProfile,
  findTokenByHash,
  logEmergencyAction,
} from '@/../../packages/db';
import type { UserDocument } from '@/../../packages/db/users';
import type { ProfileDocument } from '@/../../packages/db/profiles';
import { getDbClient } from '@/lib/db';

function getClientInfo(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
             req.headers.get('x-real-ip') || 
             'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return { ip, userAgent };
}

export async function POST(req: NextRequest) {
  try {
    // Get authenticated session
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { ip, userAgent } = getClientInfo(req);
    
    // Find user
    const db = await getDbClient();
    const usersCollection = db.collection<UserDocument>('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Get body
    const body = await req.json();
    const { profileId, token, revokeAll } = body;
    
    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId is required' },
        { status: 400 }
      );
    }
    
    // Validate profileId
    let profileObjectId: ObjectId;
    try {
      profileObjectId = new ObjectId(profileId);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid profileId' },
        { status: 400 }
      );
    }
    
    // Verify the profileId matches the user's ID (since profiles are embedded in users)
    if (!user._id.equals(profileObjectId)) {
      return NextResponse.json(
        { error: 'Profile not found or access denied' },
        { status: 403 }
      );
    }
    
    let revokedCount = 0;
    
    if (revokeAll) {
      // Revoke all active tokens for the profile
      revokedCount = await revokeAllActiveTokensForProfile(profileObjectId, user._id);
      
      // Log action
      await logEmergencyAction(
        user._id,
        profileObjectId,
        'token_revoked',
        ip,
        userAgent,
        undefined,
        {
          revokeAll: true,
          count: revokedCount,
        }
      );
      
      return NextResponse.json({
        success: true,
        message: `Revoked ${revokedCount} active token(s)`,
        revokedCount,
      });
      
    } else if (token) {
      // Revoke specific token
      
      // Validate token format
      if (!/^[a-f0-9]{64}$/i.test(token)) {
        return NextResponse.json(
          { error: 'Invalid token format' },
          { status: 400 }
        );
      }
      
      // Hash the token
      const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
      
      // Verify token belongs to this profile
      const tokenDoc = await findTokenByHash(tokenHash);
      
      if (!tokenDoc) {
        return NextResponse.json(
          { error: 'Token not found' },
          { status: 404 }
        );
      }
      
      if (!tokenDoc.profileId.equals(profileObjectId)) {
        return NextResponse.json(
          { error: 'Token does not belong to this profile' },
          { status: 403 }
        );
      }
      
      // Revoke the token
      const revoked = await revokeToken(tokenHash, user._id);
      
      if (!revoked) {
        return NextResponse.json(
          { error: 'Token already revoked or not found' },
          { status: 404 }
        );
      }
      
      // Log action
      await logEmergencyAction(
        user._id,
        profileObjectId,
        'token_revoked',
        ip,
        userAgent,
        tokenHash,
        {
          revokedBy: user._id,
        }
      );
      
      return NextResponse.json({
        success: true,
        message: 'Token revoked successfully',
        revokedCount: 1,
      });
      
    } else {
      return NextResponse.json(
        { error: 'Either "token" or "revokeAll" must be provided' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('Error revoking emergency token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
