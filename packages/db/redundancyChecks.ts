// redundancyChecks collection: detect repeated tests within time windows.
import { IndexSpec } from './indexes';

export interface TestOccurrence {
  documentId: string;
  timestamp: Date;
  value?: number; // For numeric tests, store value for comparison
}

export interface RedundancyCheckDocument {
  id: string;
  profileId: string;
  testName: string; // Standardized test name (e.g., "CBC", "Hemoglobin")
  window: number; // Time window in days (e.g., 30, 90)
  occurrences: TestOccurrence[]; // Instances within window
  severity: 'low' | 'medium' | 'high'; // Based on frequency and cost
  isWarning: boolean; // Flag for user attention
  createdAt: Date;
  updatedAt: Date;
}

// Optimized indexes for redundancy detection
export const redundancyChecksIndexes: IndexSpec[] = [
  { key: { profileId: 1, testName: 1 }, unique: true, name: 'idx_profile_test' }, // Current redundancy check per test
  { key: { profileId: 1, isWarning: 1 }, name: 'idx_profile_warnings' }, // Tests flagged as redundant
  { key: { severity: 1 }, name: 'idx_severity' }, // Filter by severity level
  { key: { testName: 1 }, name: 'idx_test_name' }, // Cross-profile test analysis
  { key: { updatedAt: -1 }, name: 'idx_recent' }, // Recently updated checks
];
