import { ObjectId } from 'mongodb';
import { IndexSpec } from './indexes';
import { getDbClient } from '@/lib/db';

export type EmergencyAuditAction =
  | 'token_created'
  | 'token_accessed'
  | 'token_expired'
  | 'token_revoked'
  | 'token_invalid'
  | 'token_reuse_attempt'
  | 'token_extended';

export interface EmergencyAudit {
  _id?: ObjectId;
  userId: ObjectId;
  profileId: ObjectId;
  tokenHash?: string; // Optional, for tracking specific token
  action: EmergencyAuditAction;
  timestamp: Date;
  ip: string;
  userAgent: string;
  metadata?: {
    reason?: string;
    error?: string;
    revokedBy?: ObjectId;
    extendedToTokenHash?: string;
    [key: string]: any;
  };
}

export const emergencyAuditIndexes: IndexSpec[] = [
  { key: { userId: 1, timestamp: -1 }, name: 'idx_user_timestamp' },
  { key: { profileId: 1, timestamp: -1 }, name: 'idx_profile_timestamp' },
  { key: { tokenHash: 1, timestamp: -1 }, name: 'idx_token_timestamp' },
  { key: { action: 1, timestamp: -1 }, name: 'idx_action_timestamp' },
  { key: { timestamp: -1 }, name: 'idx_timestamp' },
  { key: { ip: 1, timestamp: -1 }, name: 'idx_ip_timestamp' },
];

export async function logEmergencyAction(
  userId: ObjectId,
  profileId: ObjectId,
  action: EmergencyAuditAction,
  ip: string,
  userAgent: string,
  tokenHash?: string,
  metadata?: EmergencyAudit['metadata']
): Promise<ObjectId> {
  const collection = await getEmergencyAuditCollection();
  
  const audit: EmergencyAudit = {
    userId,
    profileId,
    tokenHash,
    action,
    timestamp: new Date(),
    ip,
    userAgent,
    metadata,
  };
  
  const result = await collection.insertOne(audit);
  return result.insertedId;
}

export async function getAuditLogsForProfile(
  profileId: ObjectId,
  limit: number = 100
): Promise<EmergencyAudit[]> {
  const collection = await getEmergencyAuditCollection();
  
  return collection
    .find({ profileId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

export async function getAuditLogsForToken(
  tokenHash: string,
  limit: number = 50
): Promise<EmergencyAudit[]> {
  const collection = await getEmergencyAuditCollection();
  
  return collection
    .find({ tokenHash })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

export async function detectSuspiciousActivity(
  ip: string,
  windowMinutes: number = 60,
  threshold: number = 10
): Promise<boolean> {
  const collection = await getEmergencyAuditCollection();
  
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  
  const count = await collection.countDocuments({
    ip,
    timestamp: { $gte: windowStart },
    action: { $in: ['token_invalid', 'token_reuse_attempt'] },
  });
  
  return count >= threshold;
}

async function getEmergencyAuditCollection() {
    const db = await getDbClient();
    return db.collection<EmergencyAudit>('emergencyAudit');
}
