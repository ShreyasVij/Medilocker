import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import QRCode from 'qrcode';
import {
  createEmergencyToken,
  logEmergencyAction,
  getActiveTokensForProfile,
  regenerateToken,
  markTokenPrinted,
} from '@/../../packages/db';
import type { UserDocument } from '@/../../packages/db/users';
import type { ProfileDocument } from '@/../../packages/db/profiles';
import { getDbClient } from '@/lib/db';

// Rate limiting map (in-memory, use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, maxRequests: number = 3, windowMs: number = 60000): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (userLimit.count >= maxRequests) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

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
    
    // Rate limiting
    if (!checkRateLimit(user._id.toString(), 3, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before generating a new token.' },
        { status: 429 }
      );
    }
    
    // Get body
    const body = await req.json();
    const { profileId, regenerate = false, oldToken = null } = body;
    
    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId is required' },
        { status: 400 }
      );
    }
    
    // Validate profileId (which is actually the user's ID in this system)
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
    
    // Check if user has required profile data
    if (!user.profile) {
      return NextResponse.json(
        { error: 'Please complete your profile before generating emergency tokens' },
        { status: 400 }
      );
    }
    
    // Generate cryptographically secure token (32 bytes = 64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');
    
    // Hash the token for storage
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    let tokenId: ObjectId;
    
    // If regenerating, revoke old token and create new one
    if (regenerate && oldToken) {
      const oldTokenHash = crypto
        .createHash('sha256')
        .update(oldToken)
        .digest('hex');
      
      const newTokenId = await regenerateToken(oldTokenHash, tokenHash, user._id);
      
      if (!newTokenId) {
        return NextResponse.json(
          { error: 'Failed to regenerate token' },
          { status: 400 }
        );
      }
      
      tokenId = newTokenId;
      
      // Log regeneration
      await logEmergencyAction(
        user._id,
        profileObjectId,
        'token_created',
        ip,
        userAgent,
        tokenHash,
        {
          tokenId: tokenId.toString(),
          regenerated: true,
          oldTokenHash,
        }
      );
    } else {
      // Create new permanent token in database
      tokenId = await createEmergencyToken(
        user._id,
        profileObjectId,
        tokenHash,
        true, // isPermanent
        { createdIp: ip, createdUserAgent: userAgent }
      );
      
      // Log action
      await logEmergencyAction(
        user._id,
        profileObjectId,
        'token_created',
        ip,
        userAgent,
        tokenHash,
        {
          tokenId: tokenId.toString(),
          isPermanent: true,
        }
      );
    }
    
    // Generate QR code
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const emergencyUrl = `${baseUrl}/emergency/${token}`;
    
    const qrCode = await QRCode.toDataURL(emergencyUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 400,
    });
    
    return NextResponse.json({
      success: true,
      token,
      tokenId: tokenId.toString(),
      qrCode,
      url: emergencyUrl,
      isPermanent: true,
      regenerated: regenerate,
      warning: 'This QR code is long-lived and reusable. You can print it for wallet cards or bracelets. Regenerate to revoke the old QR.',
    });
    
  } catch (error) {
    console.error('Error generating emergency token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to list active tokens
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const db = await getDbClient();
    const usersCollection = db.collection<UserDocument>('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');
    
    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId is required' },
        { status: 400 }
      );
    }
    
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
    
    const activeTokens = await getActiveTokensForProfile(profileObjectId);
    
    // Return sanitized tokens (no hash)
    const sanitizedTokens = activeTokens.map(t => ({
      id: t._id?.toString(),
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      used: t.used,
      revoked: t.revoked,
    }));
    
    return NextResponse.json({
      success: true,
      tokens: sanitizedTokens,
    });
    
  } catch (error) {
    console.error('Error fetching active tokens:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
