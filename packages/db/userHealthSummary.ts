// userHealthSummary collection: stores comprehensive AI-generated health summary per user
import { IndexSpec } from './indexes';

export interface HealthSummarySection {
  heading: string;
  content: string;
}

export interface UserHealthSummary {
  id: string;
  userId: string;
  summary: string; // Full rich text summary
  sections?: HealthSummarySection[]; // Structured sections for better display
  generatedAt: Date;
  documentCount: number; // Number of documents analyzed
  lastDocumentDate: Date | null; // Most recent document date in the analysis
  ocrTextHash?: string; // Hash of all OCR texts to detect if regeneration needed
}

export const userHealthSummaryIndexes: IndexSpec[] = [
  // One summary per user
  { key: { userId: 1 }, unique: true, name: 'idx_user_unique' },
  
  // Query by generation date for stale summary detection
  { key: { generatedAt: -1 }, name: 'idx_recent' },
];
