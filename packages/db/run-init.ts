/**
 * Test runner for database initialization
 * This demonstrates how to run the init.ts functions
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { MongoClient } from 'mongodb';
import { initializeDatabase, databaseHealthCheck } from './init';

// Load environment variables from apps/web/.env
config({ path: resolve(process.cwd(), 'apps/web/.env') });

const MONGODB_URI = process.env.MONGODB_URI?.trim();
const DB_NAME = process.env.MONGODB_DB?.trim() || 'medilocker';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  console.error('Please set MONGODB_URI in apps/web/.env');
  process.exit(1);
}

async function main() {
  console.log('🚀 Starting database initialization...');
  console.log(`📍 Connecting to: ${MONGODB_URI}`);
  console.log(`📦 Database: ${DB_NAME}\n`);

  const client = new MongoClient(MONGODB_URI);

  try {
    // Connect to MongoDB
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);

    // Initialize database (create indexes and apply schema validation)
    await initializeDatabase(db);

    // Run health check
    console.log('\n🏥 Running health check...');
    const health = await databaseHealthCheck(db);
    
    if (health.healthy) {
      console.log('✅ Database is healthy!');
    } else {
      console.warn('⚠️  Database health issues found:');
      health.issues.forEach(issue => console.warn(`  - ${issue}`));
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

main();
