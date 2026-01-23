/**
 * Database Index Initialization Script
 * 
 * This file consolidates all indexes from individual collection files
 * and provides utilities for index creation and management.
 * 
 * Usage in production:
 * 1. Call createAllIndexes() during application startup
 * 2. Monitor index performance via MongoDB Atlas
 * 3. Review index usage with db.collection.aggregate([{ $indexStats: {} }])
 */

import { Db, Document, CreateIndexesOptions } from 'mongodb';

// Type definition for index specs used across collections
export interface IndexSpec {
  key: Record<string, 1 | -1>;
  name?: string;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
  [key: string]: any; // Allow other properties if necessary
}

// Import all index definitions
import { usersIndexes } from './users';
import { profilesIndexes } from './profiles';
import { documentsIndexes } from './documents';
import { classificationIndexes } from './classification';
import { labStructuredIndexes } from './labStructured';
import { sharesIndexes } from './shares';
import { auditsIndexes } from './audits';
import { sessionsIndexes } from './sessions';
import { alertsIndexes } from './alerts';
import { trendsIndexes } from './trends';
import { summariesIndexes } from './summaries';
import { insightsIndexes } from './insights';
import { timelineIndexes } from './timeline';
import { claimsIndexes } from './claims';
import { healthScoresIndexes } from './healthScores';
import { redundancyChecksIndexes } from './redundancyChecks';
import { doctorsIndexes, appointmentsIndexes, doctorFilesIndexes } from './doctors';
import { emergencyTokensIndexes } from './emergencyTokens';
import { emergencyAuditIndexes } from './emergencyAudit';

/**
 * Create all database indexes
 * Call this during application initialization
 */
export async function createAllIndexes(db: Db): Promise<void> {
  const collections: Array<{ name: string; indexes: IndexSpec[] }> = [
    { name: 'users', indexes: usersIndexes },
    { name: 'profiles', indexes: profilesIndexes },
    { name: 'documents', indexes: documentsIndexes },
    { name: 'classification', indexes: classificationIndexes },
    { name: 'shares', indexes: sharesIndexes },
    { name: 'audits', indexes: auditsIndexes },
    { name: 'sessions', indexes: sessionsIndexes },
    { name: 'alerts', indexes: alertsIndexes },
    { name: 'trends', indexes: trendsIndexes },
    { name: 'summaries', indexes: summariesIndexes },
    { name: 'insights', indexes: insightsIndexes },
    { name: 'timeline', indexes: timelineIndexes },
    { name: 'claims', indexes: claimsIndexes },
    { name: 'healthScores', indexes: healthScoresIndexes },
    { name: 'redundancyChecks', indexes: redundancyChecksIndexes },
    { name: 'doctors', indexes: doctorsIndexes },
    { name: 'appointments', indexes: appointmentsIndexes },
    { name: 'doctorFiles', indexes: doctorFilesIndexes }, // Files transferred to doctors
    { name: 'emergencyTokens', indexes: emergencyTokensIndexes },
    { name: 'emergencyAudit', indexes: emergencyAuditIndexes },
  ];

  for (const { name, indexes } of collections) {
    if (indexes.length === 0) continue;

    const collection = db.collection(name);
    try {
      for (const indexSpec of indexes) {
        const indexOptions: CreateIndexesOptions = {};
        
        if (indexSpec.name) {
          indexOptions.name = indexSpec.name;
        }
        if (indexSpec.unique) {
          indexOptions.unique = indexSpec.unique;
        }
        if (indexSpec.sparse) {
          indexOptions.sparse = indexSpec.sparse;
        }
        if (indexSpec.expireAfterSeconds !== undefined) {
          indexOptions.expireAfterSeconds = indexSpec.expireAfterSeconds;
        }

        await collection.createIndex(indexSpec.key, indexOptions);
        console.log(`✓ Index created: ${name}.${indexSpec.name || Object.keys(indexSpec.key).join('+')}`);
      }
    } catch (error) {
      console.error(`✗ Failed to create indexes for ${name}:`, error);
      throw error;
    }
  }

  console.log('✓ All database indexes created successfully');
}

/**
 * Get index statistics for all collections
 * Useful for monitoring index usage and performance
 */
export async function getIndexStats(db: Db): Promise<Record<string, any[]>> {
  const stats: Record<string, any[]> = {};

  const collections = [
    'users', 'profiles', 'documents', 'classification', 'shares',
    'audits', 'sessions', 'alerts', 'trends', 'summaries',
    'insights', 'timeline', 'claims', 'healthScores', 'redundancyChecks',
  ];

  for (const name of collections) {
    try {
      const collection = db.collection(name);
      const indexStats = await collection
        .aggregate([{ $indexStats: {} }])
        .toArray();
      stats[name] = indexStats;
    } catch (error) {
      console.warn(`Could not get index stats for ${name}:`, error);
    }
  }

  return stats;
}

/**
 * Drop an index from a collection
 * Use with caution - verify impact before production deletion
 */
export async function dropIndex(
  db: Db,
  collectionName: string,
  indexName: string
): Promise<void> {
  const collection = db.collection(collectionName);
  try {
    await collection.dropIndex(indexName);
    console.log(`✓ Index dropped: ${collectionName}.${indexName}`);
  } catch (error) {
    console.error(`✗ Failed to drop index:`, error);
    throw error;
  }
}

/**
 * Rebuild indexes for a collection (expensive operation)
 * Use sparingly and during low-traffic periods
 * Note: This drops and recreates all indexes
 */
export async function reindexCollection(
  db: Db,
  collectionName: string
): Promise<void> {
  const collection = db.collection(collectionName);
  try {
    // Get existing indexes
    const existingIndexes = await collection.listIndexes().toArray();
    
    // Drop all indexes except _id (which cannot be dropped)
    const indexesToDrop = existingIndexes.filter(idx => idx.name !== '_id');
    for (const idx of indexesToDrop) {
      await collection.dropIndex(idx.name);
    }
    
    // Recreate indexes from schema definitions
    const collectionConfig = [
      { name: 'users', indexes: usersIndexes },
      { name: 'profiles', indexes: profilesIndexes },
      { name: 'documents', indexes: documentsIndexes },
      { name: 'classification', indexes: classificationIndexes },
      { name: 'shares', indexes: sharesIndexes },
      { name: 'audits', indexes: auditsIndexes },
      { name: 'sessions', indexes: sessionsIndexes },
      { name: 'alerts', indexes: alertsIndexes },
      { name: 'trends', indexes: trendsIndexes },
      { name: 'summaries', indexes: summariesIndexes },
      { name: 'insights', indexes: insightsIndexes },
      { name: 'timeline', indexes: timelineIndexes },
      { name: 'claims', indexes: claimsIndexes },
      { name: 'healthScores', indexes: healthScoresIndexes },
      { name: 'redundancyChecks', indexes: redundancyChecksIndexes },
    ].find(c => c.name === collectionName);

    if (collectionConfig) {
      for (const indexSpec of collectionConfig.indexes as IndexSpec[]) {
        const indexOptions: CreateIndexesOptions = {};
        
        if (indexSpec.name) indexOptions.name = indexSpec.name;
        if (indexSpec.unique) indexOptions.unique = indexSpec.unique;
        if (indexSpec.sparse) indexOptions.sparse = indexSpec.sparse;
        if (indexSpec.expireAfterSeconds !== undefined) {
          indexOptions.expireAfterSeconds = indexSpec.expireAfterSeconds;
        }

        await collection.createIndex(indexSpec.key, indexOptions);
      }
    }
    
    console.log(`✓ Collection reindexed: ${collectionName}`);
  } catch (error) {
    console.error(`✗ Failed to reindex collection:`, error);
    throw error;
  }
}

/**
 * Index health check
 * Identifies unused or redundant indexes
 */
export async function checkIndexHealth(db: Db): Promise<void> {
  const collections = [
    'users', 'profiles', 'documents', 'classification', 'shares',
    'audits', 'sessions', 'alerts', 'trends', 'summaries',
  ];

  for (const name of collections) {
    try {
      const collection = db.collection(name);
      const stats = await collection
        .aggregate([{ $indexStats: {} }])
        .toArray();

      const unusedIndexes = stats.filter((s: any) => s.accesses.ops === 0);
      if (unusedIndexes.length > 0) {
        console.warn(`⚠ Unused indexes in ${name}:`, 
          unusedIndexes.map((i: any) => i.name.name));
      }
    } catch (error) {
      // Ignore errors in health check
    }
  }
}
