// summaries collection: document-level or corpus-level summaries.
import { IndexSpec } from './indexes';

export interface SummaryDocument {
  id: string;
  documentId?: string;
  profileId: string;
  type: 'doc' | 'history';
  content: string;
  explanations?: string[];
  confidence: number; // 0-1 confidence score
  modelVersion?: string; // Track which model generated this
  createdAt: Date;
  updatedAt: Date;
}

// Optimized indexes for summary retrieval
export const summariesIndexes: IndexSpec[] = [
  { key: { documentId: 1 }, unique: true, sparse: true, name: 'idx_document' },
  { key: { profileId: 1, type: 1 }, name: 'idx_profile_type' }, // Retrieve summaries by profile and type
  { key: { profileId: 1, createdAt: -1 }, name: 'idx_profile_recent' }, // Recent summaries
  { key: { confidence: 1 }, name: 'idx_confidence' }, // Filter by confidence
];
