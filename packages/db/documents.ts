// documents collection: medical artifacts with immutable versions.
import { IndexSpec } from './indexes';

export interface DocumentDocument {
  id: string;
  profileId: string;
  ownerUserId: string;
  ownerName?: string; // Denormalized for performance
  ownerEmail?: string; // Denormalized for performance
  docType: 'prescription' | 'lab' | 'scan' | 'discharge' | 'other';
  storageKey: string;
  versionId: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  status: 'active' | 'archived' | 'deleted'; // Explicit status enum
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  ocrAvailable?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date; // Soft delete timestamp
}

// Comprehensive indexes optimized for common queries
export const documentsIndexes: IndexSpec[] = [
  { key: { profileId: 1, createdAt: -1 }, name: 'idx_profile_recent' }, // List documents by profile
  { key: { profileId: 1, docType: 1 }, name: 'idx_profile_type' }, // Filter by type
  { key: { ownerUserId: 1 }, name: 'idx_owner' }, // Owner access
  { key: { docType: 1 }, name: 'idx_doctype' }, // Aggregation by type
  { key: { status: 1, createdAt: -1 }, name: 'idx_status_recent' }, // Active documents
  { key: { tags: 1 }, name: 'idx_tags' }, // Search by tags
];
