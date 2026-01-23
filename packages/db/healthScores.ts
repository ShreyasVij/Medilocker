// healthScores collection: non-clinical health consistency snapshots.
import { IndexSpec } from './indexes';

export interface HealthScoreDocument {
  id: string;
  profileId: string;
  score: number; // 0-100 consistency/completeness score
  metrics: {
    dataPoints: number; // Total measurements in profile
    completeness: number; // % of expected fields populated
    recencyDays: number; // Days since last update
    consistencyTrend: 'improving' | 'stable' | 'declining';
  };
  labels: string[]; // Category labels (e.g., "well-documented", "needs-attention")
  explanation?: string; // Plain-language explanation
  createdAt: Date;
}

// Optimized indexes for health score queries
export const healthScoresIndexes: IndexSpec[] = [
  { key: { profileId: 1, createdAt: -1 }, unique: true, sparse: true, name: 'idx_profile_recent' }, // Latest score per profile
  { key: { score: 1 }, name: 'idx_score' }, // Find profiles by score ranges
  { key: { labels: 1 }, name: 'idx_labels' }, // Filter by labels
  { key: { 'metrics.completeness': -1 }, name: 'idx_completeness' }, // Sort by completeness
];
