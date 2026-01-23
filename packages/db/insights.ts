// insights collection: non-diagnostic recommendations and signals.
import { IndexSpec } from './indexes';

export interface InsightDocument {
  id: string;
  profileId: string;
  signals: string[]; // Health signals detected (e.g., "high_glucose", "trending_up")
  recommendations: string[]; // Non-diagnostic guidance
  labels: string[]; // Categorical labels for insights
  confidence: number; // 0-1 confidence score
  sources?: string[]; // Which trends/documents generated this insight
  createdAt: Date;
  updatedAt: Date;
}

// Optimized indexes for insight retrieval and filtering
export const insightsIndexes: IndexSpec[] = [
  { key: { profileId: 1, createdAt: -1 }, name: 'idx_profile_recent' }, // Recent insights for profile
  { key: { signals: 1 }, name: 'idx_signals' }, // Find profiles with specific signals
  { key: { confidence: 1 }, name: 'idx_confidence' }, // Filter by confidence threshold
  { key: { labels: 1 }, name: 'idx_labels' }, // Filter by insight category
];
