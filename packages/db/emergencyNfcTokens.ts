/**
 * emergencyNfcTokens collection
 * Stores NFC emergency access tokens with metadata, pre-authorization, and statistics
 */
import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { IndexSpec } from './indexes';
import { getDbClient } from '@/lib/db';

export interface PreAuthorizedDoctor {
  id: string; // UUID for the pre-auth entry
  doctorId?: string; // Reference to doctor.id if registered
  doctorEmail: string; // Unique identifier
  doctorName?: string; // Cached name from doctor profile
  fullAccessGranted: boolean; // Can bypass OTP?
  grantedAt: Date;
  grantedByUserId?: ObjectId; // Who authorized?
  expiresAt?: Date; // null = permanent
  notes?: string; // User notes
}

export interface EmergencyNfcToken {
  _id?: ObjectId;
  id: string; // UUID for API layer
  userId: ObjectId; // Profile owner
  profileId: string; // UUID of profile this accesses

  // Token Security
  tokenHash: string; // SHA-256 hash of raw token
  tokenType: 'nfc' | 'qr'; // Distinguish token types

  // NFC Physical Metadata
  nfcUrl: string; // Full URL: https://medora.buzz/emergency/nfc/{token}
  nfcSerialNumber?: string; // Optional: manufacturer serial
  deviceName?: string; // User-friendly: "Driver License Card"
  createdFromDevice: 'web' | 'mobile' | 'api';

  // Lifecycle Management
  isActive: boolean;
  isPermanent: boolean; // true = unlimited use, false = one-time
  revokedAt?: Date;
  revokedReason?: string; // "Lost card", "Security concern", etc

  // OTP Configuration
  otpRequiredForFullAccess: boolean;
  otpExpiryMinutes: number; // Default: 10
  otpSendTo?: string; // Override email for OTP

  // Pre-Authorized Access
  preAuthorizedAccessList: PreAuthorizedDoctor[];

  // Access Statistics
  totalScans: number;
  totalOtpRequests: number;
  totalOtpVerified: number;
  totalPreAuthAccess: number;
  lastAccessAt?: Date;
  lastAccessIp?: string;
  lastAccessLocation?: string; // City/Country

  // Anomaly Tracking
  suspiciousAccessCount: number;
  suspiciousAccessLastSeenAt?: Date;
  failedOtpAttempts: number;
  lastFailedOtpAt?: Date;

  // Security & Encryption
  encryptionVersion: 'v1';
  encryptedFields: string[]; // Fields that are encrypted

  // Versioning & Tracking
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export const emergencyNfcTokensIndexes: IndexSpec[] = [
  { key: { tokenHash: 1 }, unique: true, name: 'idx_tokenHash_unique' },
  { key: { profileId: 1, isActive: 1, revokedAt: 1 }, name: 'idx_profile_active_revoked' },
  { key: { userId: 1, createdAt: -1 }, name: 'idx_user_created_recent' },
  { key: { suspiciousAccessCount: -1, userId: 1 }, name: 'idx_suspicious_by_user' },
  { key: { lastAccessAt: -1 }, name: 'idx_last_access_recent' },
  { key: { 'preAuthorizedAccessList.doctorEmail': 1, profileId: 1 }, name: 'idx_preauth_doctor_profile' },
  // TTL Index: Remove tokens 24 hours after revocation
  { key: { revokedAt: 1 }, expireAfterSeconds: 86400, name: 'idx_revoked_cleanup' },
];

export async function createNfcToken(
  userId: ObjectId,
  profileId: string,
  tokenHash: string,
  nfcUrl: string,
  deviceName: string,
  otpRequired: boolean = true,
  createdFromDevice: 'web' | 'mobile' | 'api' = 'web'
): Promise<EmergencyNfcToken> {
  const collection = await getEmergencyNfcTokensCollection();

  const token: EmergencyNfcToken = {
    id: generateUUID(),
    userId,
    profileId,
    tokenHash,
    nfcUrl,
    deviceName,
    createdFromDevice,
    tokenType: 'nfc',
    isActive: true,
    isPermanent: true,
    otpRequiredForFullAccess: otpRequired,
    otpExpiryMinutes: 10,
    preAuthorizedAccessList: [],
    totalScans: 0,
    totalOtpRequests: 0,
    totalOtpVerified: 0,
    totalPreAuthAccess: 0,
    suspiciousAccessCount: 0,
    failedOtpAttempts: 0,
    encryptionVersion: 'v1',
    encryptedFields: ['preAuthorizedAccessList'],
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  };

  const result = await collection.insertOne(token);
  return { ...token, _id: result.insertedId };
}

export async function findNfcTokenByHash(tokenHash: string): Promise<EmergencyNfcToken | null> {
  const collection = await getEmergencyNfcTokensCollection();
  return collection.findOne({ tokenHash });
}

export async function updateTokenAccess(
  tokenHash: string,
  ip: string,
  location?: string
): Promise<boolean> {
  const collection = await getEmergencyNfcTokensCollection();

  const result = await collection.updateOne(
    { tokenHash, isActive: true, revokedAt: { $exists: false } },
    {
      $set: {
        lastAccessAt: new Date(),
        lastAccessIp: ip,
        ...(location && { lastAccessLocation: location }),
      },
      $inc: {
        totalScans: 1,
      },
    }
  );

  return result.modifiedCount > 0;
}

export async function incrementOtpRequest(tokenHash: string): Promise<boolean> {
  const collection = await getEmergencyNfcTokensCollection();
  const result = await collection.updateOne(
    { tokenHash },
    { $inc: { totalOtpRequests: 1 } }
  );
  return result.modifiedCount > 0;
}

export async function incrementOtpVerified(tokenHash: string): Promise<boolean> {
  const collection = await getEmergencyNfcTokensCollection();
  const result = await collection.updateOne(
    { tokenHash },
    { $inc: { totalOtpVerified: 1 } }
  );
  return result.modifiedCount > 0;
}

export async function addPreAuthorizedDoctor(
  tokenHash: string,
  doctor: PreAuthorizedDoctor
): Promise<boolean> {
  const collection = await getEmergencyNfcTokensCollection();

  const result = await collection.updateOne(
    { tokenHash },
    {
      $push: { preAuthorizedAccessList: doctor },
      $set: { updatedAt: new Date() },
    }
  );

  return result.modifiedCount > 0;
}

export async function removePreAuthorizedDoctor(
  tokenHash: string,
  doctorEmail: string
): Promise<boolean> {
  const collection = await getEmergencyNfcTokensCollection();

  const result = await collection.updateOne(
    { tokenHash },
    {
      $pull: { 'preAuthorizedAccessList': { doctorEmail } },
      $set: { updatedAt: new Date() },
    }
  );

  return result.modifiedCount > 0;
}

export async function revokeNfcToken(
  tokenHash: string,
  reason: string = 'Revoked by user'
): Promise<boolean> {
  const collection = await getEmergencyNfcTokensCollection();

  const result = await collection.updateOne(
    { tokenHash },
    {
      $set: {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason,
        updatedAt: new Date(),
      },
    }
  );

  return result.modifiedCount > 0;
}

export async function incrementFailedOtp(tokenHash: string): Promise<boolean> {
  const collection = await getEmergencyNfcTokensCollection();

  const result = await collection.updateOne(
    { tokenHash },
    {
      $inc: { failedOtpAttempts: 1 },
      $set: { lastFailedOtpAt: new Date(), updatedAt: new Date() },
    }
  );

  return result.modifiedCount > 0;
}

export async function flagAnomalousAccess(
  tokenHash: string,
  count: number = 1
): Promise<boolean> {
  const collection = await getEmergencyNfcTokensCollection();

  const result = await collection.updateOne(
    { tokenHash },
    {
      $inc: { suspiciousAccessCount: count },
      $set: { suspiciousAccessLastSeenAt: new Date(), updatedAt: new Date() },
    }
  );

  return result.modifiedCount > 0;
}

export async function getTokensForProfile(profileId: string): Promise<EmergencyNfcToken[]> {
  const collection = await getEmergencyNfcTokensCollection();
  return collection
    .find({ profileId, isActive: true })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getTokensForUser(userId: ObjectId): Promise<EmergencyNfcToken[]> {
  const collection = await getEmergencyNfcTokensCollection();
  return collection
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function findPreAuthDoctorForToken(
  tokenHash: string,
  doctorEmail: string
): Promise<PreAuthorizedDoctor | null> {
  const collection = await getEmergencyNfcTokensCollection();

  const token = await collection.findOne(
    { tokenHash, 'preAuthorizedAccessList.doctorEmail': doctorEmail },
    { projection: { 'preAuthorizedAccessList.$': 1 } }
  );

  if (!token || !token.preAuthorizedAccessList || token.preAuthorizedAccessList.length === 0) {
    return null;
  }

  const doctor = token.preAuthorizedAccessList[0];

  // Check if expired
  if (doctor.expiresAt && doctor.expiresAt < new Date()) {
    return null;
  }

  return doctor;
}

async function getEmergencyNfcTokensCollection() {
  const db = await getDbClient();
  return db.collection<EmergencyNfcToken>('emergencyNfcTokens');
}

// UUID generator (RFC 4122 v4 compliant)
function generateUUID(): string {
  return randomUUID();
}
