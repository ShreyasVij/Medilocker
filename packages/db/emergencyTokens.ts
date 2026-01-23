import { ObjectId } from 'mongodb';
import { IndexSpec } from './indexes';
import { getDbClient } from '@/lib/db';
export interface EmergencyToken {
  _id?: ObjectId;
  userId: ObjectId;
  profileId: ObjectId;
  tokenHash: string; // SHA-256 hash of the actual token
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  usedIp?: string;
  usedUserAgent?: string;
  revoked: boolean;
  revokedAt?: Date;
  revokedBy?: ObjectId;
  createdAt: Date;
  metadata?: {
    createdIp?: string;
    createdUserAgent?: string;
  };
}

export const emergencyTokensIndexes: IndexSpec[] = [
  { key: { tokenHash: 1 }, unique: true, name: 'idx_token_hash_unique' },
  { key: { userId: 1, createdAt: -1 }, name: 'idx_user_created' },
  { key: { profileId: 1, createdAt: -1 }, name: 'idx_profile_created' },
  { key: { expiresAt: 1 }, name: 'idx_expiry', expireAfterSeconds: 86400 },
  { key: { used: 1, revoked: 1, expiresAt: 1 }, name: 'idx_status' },
];

export async function createEmergencyToken(
  userId: ObjectId,
  profileId: ObjectId,
  tokenHash: string,
  ttlMinutes: number = 10,
  metadata?: { createdIp?: string; createdUserAgent?: string }
): Promise<ObjectId> {
  const collection = await getEmergencyTokensCollection();
  
  const token: EmergencyToken = {
    userId,
    profileId,
    tokenHash,
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    used: false,
    revoked: false,
    createdAt: new Date(),
    metadata,
  };
  
  const result = await collection.insertOne(token);
  return result.insertedId;
}

export async function findTokenByHash(tokenHash: string): Promise<EmergencyToken | null> {
  const collection = await getEmergencyTokensCollection();
  return collection.findOne({ tokenHash });
}

export async function markTokenAsUsed(
  tokenHash: string,
  ip: string,
  userAgent: string
): Promise<boolean> {
  const collection = await getEmergencyTokensCollection();
  
  const result = await collection.updateOne(
    { tokenHash, used: false },
    {
      $set: {
        used: true,
        usedAt: new Date(),
        usedIp: ip,
        usedUserAgent: userAgent,
      },
    }
  );
  
  return result.modifiedCount > 0;
}

export async function revokeToken(
  tokenHash: string,
  revokedBy?: ObjectId
): Promise<boolean> {
  const collection = await getEmergencyTokensCollection();
  
  const result = await collection.updateOne(
    { tokenHash },
    {
      $set: {
        revoked: true,
        revokedAt: new Date(),
        revokedBy,
      },
    }
  );
  
  return result.modifiedCount > 0;
}

export async function revokeAllActiveTokensForProfile(
  profileId: ObjectId,
  revokedBy?: ObjectId
): Promise<number> {
  const collection = await getEmergencyTokensCollection();
  
  const result = await collection.updateMany(
    {
      profileId,
      used: false,
      revoked: false,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        revoked: true,
        revokedAt: new Date(),
        revokedBy,
      },
    }
  );
  
  return result.modifiedCount;
}

export async function getActiveTokensForProfile(profileId: ObjectId): Promise<EmergencyToken[]> {
  const collection = await getEmergencyTokensCollection();
  
  return collection
    .find({
      profileId,
      used: false,
      revoked: false,
      expiresAt: { $gt: new Date() },
    })
    .sort({ createdAt: -1 })
    .toArray();
}
async function getEmergencyTokensCollection() {
    const db = await getDbClient();
    return db.collection<EmergencyToken>('emergencyTokens');
}

