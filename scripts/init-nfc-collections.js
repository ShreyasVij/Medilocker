const { MongoClient } = require('mongodb');

async function initNfcCollections() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    console.log('Initializing NFC emergency access collections...\n');

    // Check if collections exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    // Create emergencyNfcTokens
    if (!collectionNames.includes('emergencyNfcTokens')) {
      console.log('Creating emergencyNfcTokens collection...');
      await db.createCollection('emergencyNfcTokens');

      // Create indexes
      const tokensCollection = db.collection('emergencyNfcTokens');
      await tokensCollection.createIndex({ tokenHash: 1 }, { unique: true });
      await tokensCollection.createIndex(
        { profileId: 1, isActive: 1, revokedAt: 1 }
      );
      await tokensCollection.createIndex({ userId: 1, createdAt: -1 });
      await tokensCollection.createIndex({ suspiciousAccessCount: -1, userId: 1 });
      await tokensCollection.createIndex({ lastAccessAt: -1 });
      await tokensCollection.createIndex({
        'preAuthorizedAccessList.doctorEmail': 1,
        profileId: 1,
      });
      // TTL index
      await tokensCollection.createIndex(
        { revokedAt: 1 },
        { expireAfterSeconds: 86400 }
      );
      console.log('✓ emergencyNfcTokens collection created with indexes\n');
    } else {
      console.log('✓ emergencyNfcTokens collection already exists\n');
    }

    // Create emergencyNfcAccessLogs
    if (!collectionNames.includes('emergencyNfcAccessLogs')) {
      console.log('Creating emergencyNfcAccessLogs collection...');
      await db.createCollection('emergencyNfcAccessLogs');

      const logsCollection = db.collection('emergencyNfcAccessLogs');
      await logsCollection.createIndex({ tokenId: 1, timestamp: -1 });
      await logsCollection.createIndex({ userId: 1, timestamp: -1 });
      await logsCollection.createIndex({ flaggedAsAnomalous: 1, timestamp: -1 });
      await logsCollection.createIndex({ ip: 1, timestamp: -1 });
      // TTL index (1 year)
      await logsCollection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 31536000 }
      );
      console.log('✓ emergencyNfcAccessLogs collection created with indexes\n');
    } else {
      console.log('✓ emergencyNfcAccessLogs collection already exists\n');
    }

    // Create emergencyNfcOtpSessions
    if (!collectionNames.includes('emergencyNfcOtpSessions')) {
      console.log('Creating emergencyNfcOtpSessions collection...');
      await db.createCollection('emergencyNfcOtpSessions');

      const sessionsCollection = db.collection('emergencyNfcOtpSessions');
      await sessionsCollection.createIndex({ tokenId: 1, expiresAt: 1 });
      await sessionsCollection.createIndex({ userId: 1, createdAt: -1 });
      // TTL index
      await sessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await sessionsCollection.createIndex({ tokenId: 1, verified: 1 });
      console.log('✓ emergencyNfcOtpSessions collection created with indexes\n');
    } else {
      console.log('✓ emergencyNfcOtpSessions collection already exists\n');
    }

    console.log('✓ All NFC collections initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing NFC collections:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run if environment variables are set
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set');
  process.exit(1);
}

initNfcCollections().catch(console.error);
