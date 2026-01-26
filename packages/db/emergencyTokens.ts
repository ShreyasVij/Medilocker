import { ObjectId } from 'mongodb';
import { IndexSpec } from './indexes';
import { getDbClient } from '@/lib/db';

export interface EmergencyTokenAccess {
  timestamp: Date;
  ip: string;
  userAgent: string;
  location?: {
    latitude?: number;
    longitude?: number;
    approximate?: string;
  };
  notificationSent: boolean;
}

export interface EmergencyToken {
  _id?: ObjectId;
  userId: ObjectId;
  profileId: ObjectId;
  tokenHash: string; // SHA-256 hash of the actual token
  // Long-lived tokens - no expiration
  isPermanent: boolean; // true for long-lived QR tokens
  revoked: boolean;
  revokedAt?: Date;
  revokedBy?: ObjectId;
  createdAt: Date;
  lastAccessedAt?: Date;
  accessCount: number;
  accessLog: EmergencyTokenAccess[];
  metadata?: {
    createdIp?: string;
    createdUserAgent?: string;
    printedAt?: Date[];
  };
}


export const emergencyTokensIndexes: IndexSpec[] = [
  { key: { tokenHash: 1 }, unique: true, name: 'idx_token_hash_unique' },
  { key: { userId: 1, createdAt: -1 }, name: 'idx_user_created' },
  { key: { profileId: 1, createdAt: -1 }, name: 'idx_profile_created' },
  { key: { isPermanent: 1, revoked: 1 }, name: 'idx_status' },
  { key: { lastAccessedAt: -1 }, name: 'idx_last_accessed' },
];

export async function createEmergencyToken(
  userId: ObjectId,
  profileId: ObjectId,
  tokenHash: string,
  isPermanent: boolean = true,
  metadata?: { createdIp?: string; createdUserAgent?: string }
): Promise<ObjectId> {
  const collection = await getEmergencyTokensCollection();
  
  const token: EmergencyToken = {
    userId,
    profileId,
    tokenHash,
    isPermanent,
    revoked: false,
    createdAt: new Date(),
    accessCount: 0,
    accessLog: [],
    metadata,
  };
  
  const result = await collection.insertOne(token);
  return result.insertedId;
}

export async function findTokenByHash(tokenHash: string): Promise<EmergencyToken | null> {
  const collection = await getEmergencyTokensCollection();
  return collection.findOne({ tokenHash });
}

export async function logTokenAccess(
  tokenHash: string,
  ip: string,
  userAgent: string,
  location?: { latitude?: number; longitude?: number; approximate?: string }
): Promise<boolean> {
  const collection = await getEmergencyTokensCollection();
  
  const accessRecord: EmergencyTokenAccess = {
    timestamp: new Date(),
    ip,
    userAgent,
    location,
    notificationSent: false,
  };
  
  const result = await collection.updateOne(
    { tokenHash, revoked: false },
    {
      $set: {
        lastAccessedAt: new Date(),
      },
      $inc: {
        accessCount: 1,
      },
      $push: {
        accessLog: {
          $each: [accessRecord],
          $slice: -100, // Keep only last 100 accesses
        },
      },
    }
  );
  
  return result.modifiedCount > 0;
}

export async function markAccessNotificationSent(
  tokenHash: string,
  timestamp: Date
): Promise<boolean> {
  const collection = await getEmergencyTokensCollection();
  
  const result = await collection.updateOne(
    { 
      tokenHash, 
      'accessLog.timestamp': timestamp 
    },
    {
      $set: {
        'accessLog.$.notificationSent': true,
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
      revoked: false,
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
      revoked: false,
    })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function regenerateToken(
  oldTokenHash: string,
  newTokenHash: string,
  revokedBy?: ObjectId
): Promise<ObjectId | null> {
  const collection = await getEmergencyTokensCollection();
  
  // Find the old token
  const oldToken = await collection.findOne({ tokenHash: oldTokenHash });
  
  if (!oldToken) {
    return null;
  }
  
  // Revoke old token
  await collection.updateOne(
    { tokenHash: oldTokenHash },
    {
      $set: {
        revoked: true,
        revokedAt: new Date(),
        revokedBy,
      },
    }
  );
  
  // Create new token with same settings
  const newToken: EmergencyToken = {
    userId: oldToken.userId,
    profileId: oldToken.profileId,
    tokenHash: newTokenHash,
    isPermanent: true,
    revoked: false,
    createdAt: new Date(),
    accessCount: 0,
    accessLog: [],
    metadata: oldToken.metadata,
  };
  
  const result = await collection.insertOne(newToken);
  return result.insertedId;
}

export async function markTokenPrinted(tokenHash: string): Promise<boolean> {
  const collection = await getEmergencyTokensCollection();
  
  const result = await collection.updateOne(
    { tokenHash },
    {
      $push: {
        'metadata.printedAt': new Date(),
      },
    }
  );
  
  return result.modifiedCount > 0;
}
async function getEmergencyTokensCollection() {
    const db = await getDbClient();
    return db.collection<EmergencyToken>('emergencyTokens');
}

