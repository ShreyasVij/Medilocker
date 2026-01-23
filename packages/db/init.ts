/**
 * Database Initialization
 * Call this once during application startup
 */

import { Db } from 'mongodb';
import { createAllIndexes } from './indexes';
import { applySchemaValidation } from './schemaValidation';

export async function initializeDatabase(db: Db): Promise<void> {
  console.log('🔧 Initializing database...');

  try {
    // 1. Apply schema validation rules
    console.log('📝 Applying schema validation...');
    await applySchemaValidation(db);

    // 2. Create all indexes
    console.log('📊 Creating indexes...');
    await createAllIndexes(db);

    console.log('✅ Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Health check - run periodically to verify database state
 */
export async function databaseHealthCheck(db: Db): Promise<{
  healthy: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    // Check connection
    await db.admin().ping();

    // Check if collections exist
    const collections = await db.listCollections().toArray();
    const requiredCollections = [
      'users', 'profiles', 'documents', 'classification',
      'shares', 'audits', 'sessions'
    ];

    for (const required of requiredCollections) {
      if (!collections.find(c => c.name === required)) {
        issues.push(`Missing collection: ${required}`);
      }
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  } catch (error) {
    issues.push(`Connection failed: ${error}`);
    return { healthy: false, issues };
  }
}
