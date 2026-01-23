/**
 * Update MongoDB collection schema validations
 * Run with: npx tsx scripts/update-schemas.ts
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'medilocker';

if (!uri) {
  console.error('MONGODB_URI environment variable is required');
  process.exit(1);
}

async function updateSchemas() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbName);

    // Update profiles collection
    console.log('\n📝 Updating profiles collection...');
    await db.command({
      collMod: 'profiles',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['userId', 'type', 'displayName', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            id: { bsonType: 'string' },
            userId: { bsonType: 'string' },
            type: { enum: ['self', 'dependent'] },
            displayName: { bsonType: 'string' },
            dateOfBirth: { bsonType: ['date', 'null'] },
            bloodGroup: { enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null] },
            allergies: { bsonType: 'array', items: { bsonType: 'string' } },
            conditions: { bsonType: 'array', items: { bsonType: 'string' } },
            guardians: { bsonType: 'array' },
            vitalIdentifiers: { bsonType: ['object', 'null'] },
            emergencyContact: { bsonType: ['object', 'null'] },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' },
          },
        },
      },
      validationLevel: 'strict',
    });
    console.log('✅ Profiles schema updated');

    // Update documents collection
    console.log('\n📝 Updating documents collection...');
    await db.command({
      collMod: 'documents',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['profileId', 'ownerUserId', 'docType', 'storageKey', 'status', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            id: { bsonType: 'string' },
            profileId: { bsonType: 'string' },
            ownerUserId: { bsonType: 'string' },
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
    console.log('✅ Documents schema updated');

    // Update audits collection
    console.log('\n📝 Updating audits collection...');
    await db.command({
      collMod: 'audits',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['actorId', 'action', 'target', 'targetType', 'result', 'timestamp'],
          properties: {
            _id: { bsonType: 'objectId' },
            id: { bsonType: 'string' },
            actorId: { bsonType: 'string' },
            action: {
              enum: [
                'login', 'document.upload', 'document.download',
                'share.create', 'share.revoke', 'access.grant',
                'access.revoke', 'emergency.access', 'admin.action',
              ],
            },
            target: { bsonType: 'string' },
            targetType: { enum: ['profile', 'document', 'share', 'user', 'system'] },
            resourceId: { bsonType: ['string', 'null'] },
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
    console.log('✅ Audits schema updated');

    console.log('\n🎉 All schemas updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating schemas:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

updateSchemas();
