import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  findTokenByHash,
  logTokenAccess,
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
    
    // Get location from query params (sent from client)
    const url = new URL(req.url);
    const latitude = url.searchParams.get('lat');
    const longitude = url.searchParams.get('lon');
    const approximate = url.searchParams.get('loc');
    
    const location = {
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      approximate: approximate || undefined,
    };
    
    // Rate limiting per IP
    if (!checkAccessRateLimit(ip, 20, 60000)) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Too many QR scans from your location.',
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
      return NextResponse.json(
        { 
          error: 'Invalid QR code',
          locked: true,
        },
        { status: 404 }
      );
    }
    
    // Check suspicious activity
    const isSuspicious = await detectSuspiciousActivity(ip, 60, 15);
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
          error: 'This emergency QR has been revoked by the owner',
          locked: true,
          revoked: true,
        },
        { status: 403 }
      );
    }
    
    // Log QR access
    await logTokenAccess(tokenHash, ip, userAgent, location);
    
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
      tokenHash,
      { location }
    );
    
    // Calculate age from DOB if available
    let age: number | undefined;
    let dob: string | undefined;
    if (user.profile?.dob) {
      const today = new Date();
      const birthDate = new Date(user.profile.dob);
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      dob = birthDate.toLocaleDateString();
    }
    
    // Extract emergency contact info
    const emergencyContacts = user.profile?.emergency ? [{
      name: user.profile.emergency.name || '',
      relationship: user.profile.emergency.relationship || '',
      phone: user.profile.emergency.phone || '',
    }] : [];
    
    // Parse allergies and conditions (assuming they're stored as comma-separated strings)
    const allergies = user.profile?.medical?.allergies 
      ? user.profile.medical.allergies.split(',').map(a => a.trim()).filter(Boolean)
      : [];
    
    const chronicConditions = user.profile?.medical?.conditions 
      ? user.profile.medical.conditions.split(',').map(c => c.trim()).filter(Boolean)
      : [];
    
    const currentMedications = user.profile?.medical?.medications 
      ? user.profile.medical.medications.split(',').map(m => m.trim()).filter(Boolean)
      : [];
    
    // Return ONLY emergency-scope data (minimal critical information)
    const emergencyData = {
      success: true,
      accessTimestamp: new Date().toISOString(),
      profile: {
        displayName: user.name || 'Unknown',
        age,
        dob,
        bloodGroup: user.profile?.medical?.bloodGroup || 'Unknown',
        allergies,
        chronicConditions,
        currentMedications,
        emergencyNotes: '',
        emergencyContacts,
        // Optional masked insurance ID
        insuranceId: user.profile?.medical?.['insuranceId'] 
          ? `****${String(user.profile.medical['insuranceId']).slice(-4)}`
          : undefined,
      },
      token, // Send back token for notification purposes
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
