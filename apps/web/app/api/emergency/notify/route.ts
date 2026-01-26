import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { findTokenByHash, markAccessNotificationSent } from '@/../../packages/db';
import type { UserDocument } from '@/../../packages/db/users';
import { getDbClient } from '@/lib/db';

// This endpoint sends emergency contact notification
// In production, integrate with Twilio/SendGrid/WhatsApp Business API
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, accessTimestamp } = body;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }
    
    // Hash the token
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Find token
    const tokenDoc = await findTokenByHash(tokenHash);
    
    if (!tokenDoc || tokenDoc.revoked) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      );
    }
    
    // Fetch user with emergency contact info
    const db = await getDbClient();
    const usersCollection = db.collection<UserDocument>('users');
    const user = await usersCollection.findOne({ _id: tokenDoc.profileId });
    
    if (!user || !user.profile?.emergency) {
      return NextResponse.json(
        { error: 'No emergency contact configured' },
        { status: 404 }
      );
    }
    
    const emergencyContact = user.profile.emergency;
    
    // TODO: Integrate with actual SMS/WhatsApp/Email service
    // For now, we'll simulate the notification
    console.log(`[EMERGENCY NOTIFICATION] Sending to ${emergencyContact.phone}`);
    console.log(`Message: This is MediLocker: someone has scanned ${user.name}'s medical QR—is this an emergency? Reply YES or NO.`);
    
    // In production, use services like:
    // - Twilio for SMS
    // - WhatsApp Business API
    // - SendGrid for Email
    
    const notificationMessage = `This is MediLocker: someone has scanned ${user.name}'s medical QR—is this an emergency? Reply YES or NO.`;
    
    // Mark notification as sent
    if (accessTimestamp) {
      await markAccessNotificationSent(tokenHash, new Date(accessTimestamp));
    }
    
    return NextResponse.json({
      success: true,
      message: 'Emergency contact notified',
      contact: {
        name: emergencyContact.name,
        phone: emergencyContact.phone,
        relationship: emergencyContact.relationship,
      },
      notificationMessage,
    });
    
  } catch (error) {
    console.error('Error sending emergency notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
