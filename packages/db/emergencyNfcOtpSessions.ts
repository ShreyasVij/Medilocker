/**
 * emergencyNfcOtpSessions collection
 * Manages OTP lifecycle - each OTP request creates a new session
 */
import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { IndexSpec } from './indexes';
import { getDbClient } from '@/lib/db';

export interface RequestContext {
  responderName?: string;
  responderOrganization?: string;
  requestReason?: string;
  requestIp: string;
  requestUserAgent: string;
  requestGeoLocation?: {
    city?: string;
    country?: string;
  };
}

export type OtpDeliveryMethod = 'email' | 'sms' | 'websocket';

export type FailureReason = 'max_attempts_exceeded' | 'expired' | 'invalid_code';

export interface EmergencyNfcOtpSession {
  _id?: ObjectId;
  id: string; // UUID
  tokenId: string;
  userId: ObjectId;
  profileId: string;

  // OTP Code
  otpCode: string; // SHA-256 hash - NEVER store plaintext
  otpLength: number; // Always 6
  otpRawCode?: string; // Only in initial response

  // OTP Delivery
  deliveryMethod: OtpDeliveryMethod;
  deliveredTo: string; // email or phone
  deliveredToMasked: string; // p***@example.com for UI
  deliveryAttempts: number;
  deliverySucceededAt?: Date;
  deliveryErrorMessage?: string;

  // Lifecycle
  createdAt: Date;
  expiresAt: Date;
  verifiedAt?: Date;

  // Validation Attempts
  attemptCount: number;
  maxAttempts: number; // Usually 3
  firstAttemptAt?: Date;
  lastAttemptAt?: Date;
  lastAttemptIp?: string;

  // Outcome
  verified: boolean;
  verificationFailed: boolean;
  failureReason?: FailureReason;

  // Request Context
  requestContext?: RequestContext;

  // Access Scope
  accessScope: 'public' | 'full';
  grantedUntil?: Date;
  accessTokenCreated?: boolean;
  accessToken?: string; // Optional JWT

  // Flags
  flaggedAsAnomalous?: boolean;

  // Source
  source: 'nfc_tap' | 'api_call' | 'manual';
}

export const emergencyNfcOtpSessionsIndexes: IndexSpec[] = [
  { key: { tokenId: 1, expiresAt: 1 }, name: 'idx_token_expiry' },
  { key: { userId: 1, createdAt: -1 }, name: 'idx_user_created' },
  // TTL: expires after OTP expiry
  { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: 'idx_ttl_otp_expiry' },
  { key: { tokenId: 1, verified: 1 }, name: 'idx_token_verified' },
];

export async function createOtpSession(
  tokenId: string,
  userId: ObjectId,
  profileId: string,
  deliveryMethod: OtpDeliveryMethod,
  deliveredTo: string,
  deliveredToMasked: string,
  otpCodeHash: string,
  options?: {
    otpExpiryMinutes?: number;
    requestContext?: RequestContext;
    maxAttempts?: number;
    source?: 'nfc_tap' | 'api_call' | 'manual';
  }
): Promise<EmergencyNfcOtpSession> {
  const collection = await getEmergencyNfcOtpSessionsCollection();

  const expiryMinutes = options?.otpExpiryMinutes || 10;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const session: EmergencyNfcOtpSession = {
    id: generateUUID(),
    tokenId,
    userId,
    profileId,
    otpCode: otpCodeHash,
    otpLength: 6,
    deliveryMethod,
    deliveredTo,
    deliveredToMasked,
    deliveryAttempts: 0,
    createdAt: new Date(),
    expiresAt,
    attemptCount: 0,
    maxAttempts: options?.maxAttempts || 3,
    verified: false,
    verificationFailed: false,
    accessScope: 'full',
    requestContext: options?.requestContext,
    source: options?.source || 'nfc_tap',
  };

  const result = await collection.insertOne(session);
  return { ...session, _id: result.insertedId };
}

export async function findOtpSession(sessionId: string): Promise<EmergencyNfcOtpSession | null> {
  const collection = await getEmergencyNfcOtpSessionsCollection();
  return collection.findOne({ id: sessionId });
}

export async function markOtpDelivered(
  sessionId: string
): Promise<boolean> {
  const collection = await getEmergencyNfcOtpSessionsCollection();

  const result = await collection.updateOne(
    { id: sessionId },
    {
      $set: {
        deliverySucceededAt: new Date(),
      },
      $inc: {
        deliveryAttempts: 1,
      },
    }
  );

  return result.modifiedCount > 0;
}

export async function markOtpDeliveryFailed(
  sessionId: string,
  errorMessage: string
): Promise<boolean> {
  const collection = await getEmergencyNfcOtpSessionsCollection();

  const result = await collection.updateOne(
    { id: sessionId },
    {
      $set: {
        deliveryErrorMessage: errorMessage,
      },
      $inc: {
        deliveryAttempts: 1,
      },
    }
  );

  return result.modifiedCount > 0;
}

export async function recordOtpAttempt(
  sessionId: string,
  ip: string
): Promise<boolean> {
  const collection = await getEmergencyNfcOtpSessionsCollection();

  const update: any = {
    $inc: { attemptCount: 1 },
    $set: {
      lastAttemptAt: new Date(),
      lastAttemptIp: ip,
    },
  };

  // Only set firstAttemptAt if not already set
  const session = await collection.findOne({ id: sessionId });
  if (!session?.firstAttemptAt) {
    update.$setOnInsert = { firstAttemptAt: new Date() };
  }

  const result = await collection.updateOne(
    { id: sessionId },
    update
  );

  return result.modifiedCount > 0;
}

export async function verifyOtp(
  sessionId: string,
  accessToken?: string
): Promise<boolean> {
  const collection = await getEmergencyNfcOtpSessionsCollection();

  const result = await collection.updateOne(
    { id: sessionId },
    {
      $set: {
        verified: true,
        verifiedAt: new Date(),
        ...(accessToken && { accessToken, accessTokenCreated: true }),
      },
    }
  );

  return result.modifiedCount > 0;
}

export async function markOtpFailed(
  sessionId: string,
  reason: FailureReason
): Promise<boolean> {
  const collection = await getEmergencyNfcOtpSessionsCollection();

  const result = await collection.updateOne(
    { id: sessionId },
    {
      $set: {
        verificationFailed: true,
        failureReason: reason,
      },
    }
  );

  return result.modifiedCount > 0;
}

export async function flagOtpAsAnomalous(sessionId: string): Promise<boolean> {
  const collection = await getEmergencyNfcOtpSessionsCollection();

  const result = await collection.updateOne(
    { id: sessionId },
    {
      $set: {
        flaggedAsAnomalous: true,
      },
    }
  );

  return result.modifiedCount > 0;
}

export async function getActiveOtpForToken(
  tokenId: string
): Promise<EmergencyNfcOtpSession | null> {
  const collection = await getEmergencyNfcOtpSessionsCollection();

  return collection.findOne({
    tokenId,
    verified: false,
    verificationFailed: false,
    expiresAt: { $gt: new Date() },
  });
}

export async function countRecentFailedAttempts(
  userId: ObjectId,
  profileId: string,
  minutes: number = 15
): Promise<number> {
  const collection = await getEmergencyNfcOtpSessionsCollection();

  const since = new Date(Date.now() - minutes * 60 * 1000);

  return collection.countDocuments({
    userId,
    profileId,
    verificationFailed: true,
    failureReason: 'invalid_code',
    lastAttemptAt: { $gte: since },
  });
}

export async function getUserOtpSessions(
  userId: ObjectId,
  limit: number = 20,
  offset: number = 0
): Promise<{ sessions: EmergencyNfcOtpSession[]; total: number }> {
  const collection = await getEmergencyNfcOtpSessionsCollection();

  const [sessions, total] = await Promise.all([
    collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
    collection.countDocuments({ userId }),
  ]);

  return { sessions, total };
}

async function getEmergencyNfcOtpSessionsCollection() {
  const db = await getDbClient();
  return db.collection<EmergencyNfcOtpSession>('emergencyNfcOtpSessions');
}

function generateUUID(): string {
  return randomUUID();
}
