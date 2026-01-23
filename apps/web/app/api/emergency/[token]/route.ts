import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  findTokenByHash,
  markTokenAsUsed,
  logEmergencyAction,
  detectSuspiciousActivity,
} from '@/../../packages/db';
import type { UserDocument } from '@/../../packages/db/users';
import { getDbClient } from '@/lib/db';

// Rate limiting map for token access attempts
const accessRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkAccessRateLimit(ip: string, maxAttempts: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const limit = accessRateLimitMap.get(ip);
  
  if (!limit || now > limit.resetAt) {
    accessRateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (limit.count >= maxAttempts) {
    return false;
  }
  
  limit.count++;
  return true;
}

function getClientInfo(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
             req.headers.get('x-real-ip') || 
             'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return { ip, userAgent };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { ip, userAgent } = getClientInfo(req);
    
    // Rate limiting per IP
    if (!checkAccessRateLimit(ip, 10, 60000)) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          locked: true,
        },
        { status: 429 }
      );
    }
    
    // Validate token format (64 hex chars)
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
    
    // Find token in database
    const tokenDoc = await findTokenByHash(tokenHash);
    
    if (!tokenDoc) {
      // Log invalid token attempt
      await logEmergencyAction(
        tokenDoc?.userId || new (require('mongodb').ObjectId)(),
        tokenDoc?.profileId || new (require('mongodb').ObjectId)(),
        'token_invalid',
        ip,
        userAgent,
        tokenHash,
        { reason: 'Token not found' }
      );
      
      return NextResponse.json(
        { 
          error: 'Invalid or expired token',
          locked: true,
        },
        { status: 404 }
      );
    }
    
    // Check suspicious activity
    const isSuspicious = await detectSuspiciousActivity(ip, 60, 10);
    if (isSuspicious) {
      await logEmergencyAction(
        tokenDoc.userId,
        tokenDoc.profileId,
        'token_invalid',
        ip,
        userAgent,
        tokenHash,
        { reason: 'Suspicious activity detected', blocked: true }
      );
      
      return NextResponse.json(
        { 
          error: 'Access blocked due to suspicious activity',
          locked: true,
        },
        { status: 403 }
      );
    }
    
    // Check if revoked
    if (tokenDoc.revoked) {
      await logEmergencyAction(
        tokenDoc.userId,
        tokenDoc.profileId,
        'token_invalid',
        ip,
        userAgent,
        tokenHash,
        { reason: 'Token revoked' }
      );
      
      return NextResponse.json(
        { 
          error: 'This emergency access has been revoked',
          locked: true,
          revoked: true,
        },
        { status: 403 }
      );
    }
    
    // Check if expired
    if (new Date() > tokenDoc.expiresAt) {
      await logEmergencyAction(
        tokenDoc.userId,
        tokenDoc.profileId,
        'token_expired',
        ip,
        userAgent,
        tokenHash
      );
      
      return NextResponse.json(
        { 
          error: 'This emergency access has expired',
          locked: true,
          expired: true,
        },
        { status: 410 }
      );
    }
    
    // Check if already used
    if (tokenDoc.used) {
      await logEmergencyAction(
        tokenDoc.userId,
        tokenDoc.profileId,
        'token_reuse_attempt',
        ip,
        userAgent,
        tokenHash,
        { 
          previousUse: {
            usedAt: tokenDoc.usedAt,
            usedIp: tokenDoc.usedIp,
            usedUserAgent: tokenDoc.usedUserAgent,
          },
        }
      );
      
      return NextResponse.json(
        { 
          error: 'This emergency token has already been used and is now invalid',
          locked: true,
          used: true,
        },
        { status: 403 }
      );
    }
    
    // Mark token as used IMMEDIATELY (atomic operation)
    const marked = await markTokenAsUsed(tokenHash, ip, userAgent);
    
    if (!marked) {
      // Race condition or concurrent access
      await logEmergencyAction(
        tokenDoc.userId,
        tokenDoc.profileId,
        'token_reuse_attempt',
        ip,
        userAgent,
        tokenHash,
        { reason: 'Concurrent access attempt' }
      );
      
      return NextResponse.json(
        { 
          error: 'Token already in use',
          locked: true,
        },
        { status: 409 }
      );
    }
    
    // Fetch user with emergency data (profileId is actually userId in this system)
    const db = await getDbClient();
    const usersCollection = db.collection<UserDocument>('users');
    const user = await usersCollection.findOne({ _id: tokenDoc.profileId });
    
    if (!user) {
      await logEmergencyAction(
        tokenDoc.userId,
        tokenDoc.profileId,
        'token_invalid',
        ip,
        userAgent,
        tokenHash,
        { reason: 'User not found' }
      );
      
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Log successful access
    await logEmergencyAction(
      tokenDoc.userId,
      tokenDoc.profileId,
      'token_accessed',
      ip,
      userAgent,
      tokenHash
    );
    
    // Calculate age from DOB if available
    let age: number | undefined;
    if (user.profile?.dob) {
      const today = new Date();
      const birthDate = new Date(user.profile.dob);
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }
    
    // Extract emergency contact info
    const emergencyContacts = user.profile?.emergency ? [{
      name: user.profile.emergency.name || '',
      relationship: user.profile.emergency.relationship || '',
      phone: user.profile.emergency.phone || '',
    }] : [];
    
    // Return ONLY emergency-scope data (minimal critical information)
    const emergencyData = {
      success: true,
      tokenUsed: true,
      expiresAt: tokenDoc.expiresAt.toISOString(),
      profile: {
        displayName: user.name || 'Unknown',
        age,
        bloodGroup: user.profile?.medical?.bloodGroup || 'Unknown',
        allergies: user.profile?.medical?.allergies ? [user.profile.medical.allergies] : [],
        chronicConditions: user.profile?.medical?.conditions ? [user.profile.medical.conditions] : [],
        emergencyNotes: '',
        emergencyContacts,
      },
      warnings: [
        'This is emergency-only access with limited information',
        'No medical history or documents are included',
        'This token can only be used once',
        'All access is logged and monitored',
      ],
    };
    
    return NextResponse.json(emergencyData);
    
  } catch (error) {
    console.error('Error accessing emergency token:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        locked: true,
      },
      { status: 500 }
    );
  }
}
