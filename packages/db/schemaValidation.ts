/**
 * Database Schema Validation Utility
 * 
 * Provides MongoDB JSON Schema validators for all collections
 * to enforce data integrity at the database level.
 * 
 * Usage:
 * 1. Call applySchemaValidation() during database initialization
 * 2. Invalid documents will be rejected at insert/update time
 * 3. Adjust validation as needed, using validationLevel: "warning" for backward compatibility
 */

import { Db } from 'mongodb';

export async function applySchemaValidation(db: Db): Promise<void> {
  // Create users collection with validation
  try {
    await db.createCollection('users', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['email', 'identityProvider', 'identityId', 'roles', 'status', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            email: { bsonType: 'string', pattern: '^[\\w.-]+@[\\w.-]+\\.\\w+$' },
            name: { bsonType: 'string' },
            identityProvider: { enum: ['google', 'github', 'oidc', 'local'] },
            identityId: { bsonType: 'string' },
            roles: {
              bsonType: 'array',
              items: { enum: ['patient', 'guardian', 'doctor', 'admin', 'system-worker'] },
            },
            status: { enum: ['active', 'inactive', 'suspended'] },
            lastLoginAt: { bsonType: ['date', 'null'] },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: ['date', 'null'] },
          },
        },
      },
      validationLevel: 'strict',
    });
    console.log('✓ Users collection validation applied');
  } catch (error: any) {
    if (error.code !== 48) throw error; // Ignore "namespace exists" errors
  }

  // Create profiles collection with validation
  try {
    await db.createCollection('profiles', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['userId', 'type', 'displayName', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            id: { bsonType: 'string' },
            userId: { bsonType: 'string' }, // Changed from objectId to string (UUID)
            type: { enum: ['self', 'dependent'] },
            displayName: { bsonType: 'string' },
            dateOfBirth: { bsonType: ['date', 'null'] },
            bloodGroup: { enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null] },
            allergies: { bsonType: 'array', items: { bsonType: 'string' } },
            conditions: { bsonType: 'array', items: { bsonType: 'string' } },
            emergencyContact: {
              bsonType: ['object', 'null'],
              properties: {
                name: { bsonType: 'string' },
                phone: { bsonType: 'string' },
              },
            },
            guardians: {
              bsonType: 'array',
              items: {
                bsonType: 'object',
                required: ['userId', 'name', 'email', 'type'],
                properties: {
                  userId: { bsonType: 'string' }, // Changed from objectId to string
                  name: { bsonType: 'string' },
                  email: { bsonType: 'string' },
                  type: { enum: ['parent', 'caregiver', 'power-of-attorney'] },
                  permissions: { bsonType: 'array', items: { enum: ['view', 'upload', 'manage'] } },
                },
              },
            },
            vitalIdentifiers: { bsonType: ['object', 'null'] },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' },
          },
        },
      },
      validationLevel: 'strict',
    });
    console.log('✓ Profiles collection validation applied');
  } catch (error: any) {
    if (error.code !== 48) throw error;
  }

  // Create documents collection with validation
  try {
    await db.createCollection('documents', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['profileId', 'ownerUserId', 'docType', 'storageKey', 'status', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            id: { bsonType: 'string' },
            profileId: { bsonType: 'string' }, // Changed from objectId to string (UUID)
            ownerUserId: { bsonType: 'string' }, // Changed from objectId to string (UUID)
            ownerName: { bsonType: ['string', 'null'] },
            ownerEmail: { bsonType: ['string', 'null'] },
            docType: { enum: ['prescription', 'lab', 'scan', 'discharge', 'other'] },
            storageKey: { bsonType: 'string' },
            versionId: { bsonType: 'string' },
            tags: { bsonType: ['array', 'null'], items: { bsonType: 'string' } },
            status: { enum: ['active', 'archived', 'deleted'] },
            processingStatus: { enum: ['pending', 'processing', 'completed', 'failed', null] },
            ocrAvailable: { bsonType: ['bool', 'null'] },
            metadata: { bsonType: ['object', 'null'] },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: ['date', 'null'] },
            deletedAt: { bsonType: ['date', 'null'] },
          },
        },
      },
      validationLevel: 'strict',
    });
    console.log('✓ Documents collection validation applied');
  } catch (error: any) {
    if (error.code !== 48) throw error;
  }

  // Create classification collection with validation
  try {
    await db.createCollection('classification', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['documentId', 'type', 'confidence', 'createdAt', 'updatedAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            documentId: { bsonType: 'string' },
            type: { enum: ['classification', 'lab'] },
            ocrText: { bsonType: ['string', 'null'] },
            detectedType: { bsonType: ['string', 'null'] },
            confidence: { bsonType: 'double', minimum: 0, maximum: 1 },
            inferredTags: { bsonType: ['array', 'null'], items: { bsonType: 'string' } },
            panel: { bsonType: ['string', 'null'] },
            observations: {
              bsonType: ['array', 'null'],
              items: {
                bsonType: 'object',
                required: ['name'],
                properties: {
                  name: { bsonType: 'string' },
                  value: { bsonType: ['string', 'double', 'int'] },
                  unit: { bsonType: ['string', 'null'] },
                  refRange: { bsonType: ['string', 'null'] },
                  flags: { bsonType: ['array', 'null'], items: { bsonType: 'string' } },
                },
              },
            },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' },
          },
        },
      },
      validationLevel: 'strict',
    });
    console.log('✓ Classification collection validation applied');
  } catch (error: any) {
    if (error.code !== 48) throw error;
  }

  // Create shares collection with validation
  try {
    await db.createCollection('shares', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['ownerUserId', 'profileId', 'granteeType', 'permissions', 'expiresAt', 'status', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            ownerUserId: { bsonType: 'string' },
            profileId: { bsonType: 'string' },
            grantedToEmail: { bsonType: ['string', 'null'] },
            grantedToUserId: { bsonType: ['string', 'null'] },
            grantedToName: { bsonType: ['string', 'null'] },
            granteeType: { enum: ['doctor', 'email', 'institution-user'] },
            permissions: {
              bsonType: 'array',
              items: { enum: ['view', 'upload', 'summary'] },
            },
            scope: {
              bsonType: 'object',
              properties: {
                docIds: { bsonType: ['array', 'null'], items: { bsonType: 'string' } },
                types: {
                  bsonType: ['array', 'null'],
                  items: { enum: ['prescription', 'lab', 'scan', 'discharge', 'other'] },
                },
              },
            },
            expiresAt: { bsonType: 'date' },
            status: { enum: ['active', 'revoked', 'expired'] },
            usedAt: { bsonType: ['date', 'null'] },
            createdAt: { bsonType: 'date' },
            revokedAt: { bsonType: ['date', 'null'] },
          },
        },
      },
      validationLevel: 'strict',
    });
    console.log('✓ Shares collection validation applied');
  } catch (error: any) {
    if (error.code !== 48) throw error;
  }

  // Create doctors collection with validation
  try {
    await db.createCollection('doctors', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['doctorCode', 'email', 'name', 'role', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            doctorCode: { bsonType: 'string', minLength: 16, maxLength: 16 },
            userId: { bsonType: ['string', 'null'] },
            email: { bsonType: 'string', pattern: '^[\\w.-]+@[\\w.-]+\\.\\w+$' },
            name: { bsonType: 'string' },
            profile: {
              bsonType: ['object', 'null'],
              properties: {
                phone: { bsonType: ['string', 'null'] },
                dob: { bsonType: ['date', 'null'] },
                gender: { enum: ['male', 'female', 'other', 'prefer_not_to_say', null] },
                profileImageUrl: { bsonType: ['string', 'null'] },
                profileImageName: { bsonType: ['string', 'null'] },
                specialization: { bsonType: ['string', 'null'] },
                location: {
                  bsonType: ['object', 'null'],
                  properties: {
                    hos: { bsonType: ['string', 'null'] },
                    city: { bsonType: ['string', 'null'] },
                    state: { bsonType: ['string', 'null'] },
                    country: { bsonType: ['string', 'null'] },
                  },
                },
              },
            },
            role: { enum: ['Doctor'] },
            status: { enum: ['active', 'inactive', 'suspended', null] },
            lastLoginAt: { bsonType: ['date', 'null'] },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: ['date', 'null'] },
          },
        },
      },
      validationLevel: 'strict',
    });
    console.log('✓ Doctors collection validation applied');
  } catch (error: any) {
    if (error.code !== 48) throw error;
  }

  // Create audits collection with validation
  try {
    await db.createCollection('audits', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['actorId', 'action', 'target', 'targetType', 'result', 'timestamp'],
          properties: {
            _id: { bsonType: 'objectId' },
            id: { bsonType: 'string' },
            actorId: { bsonType: 'string' }, // Changed from objectId to string (UUID)
            action: {
              enum: [
                'login', 'document.upload', 'document.download',
                'share.create', 'share.revoke', 'access.grant',
                'access.revoke', 'emergency.access', 'admin.action',
              ],
            },
            target: { bsonType: 'string' },
            targetType: { enum: ['profile', 'document', 'share', 'user', 'system'] },
            resourceId: { bsonType: ['string', 'null'] }, // Changed from objectId to string
            result: { enum: ['success', 'failure'] },
            timestamp: { bsonType: 'date' },
            ipAddress: { bsonType: ['string', 'null'] },
            userAgent: { bsonType: ['string', 'null'] },
            metadata: { bsonType: ['object', 'null'] },
            archived: { bsonType: ['bool', 'null'] },
          },
        },
      },
      validationLevel: 'strict',
    });
    console.log('✓ Audits collection validation applied');
  } catch (error: any) {
    if (error.code !== 48) throw error;
  }

  console.log('✓ All schema validations applied successfully');
}

/**
 * Drop schema validation from a collection
 * Use for backward compatibility if needed
 */
export async function dropSchemaValidation(
  db: Db,
  collectionName: string
): Promise<void> {
  try {
    await db.collection(collectionName).updateMany(
      {},
      [{ $unset: 'validator' }],
      { upsert: false }
    );
    console.log(`✓ Schema validation removed from ${collectionName}`);
  } catch (error) {
    console.error(`✗ Failed to drop schema validation:`, error);
    throw error;
  }
}
