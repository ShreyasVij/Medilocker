// trends collection: time-series analyses per metric.
// Optimized for MongoDB time-series operations and efficient querying.
import { IndexSpec } from './indexes';

export interface TrendPoint {
  timestamp: Date;
  value: number;
  unit?: string; // Store unit for proper aggregation
  flags?: string[];
}

export interface TrendDocument {
  id: string;
  profileId: string;
  metricKey: string;
  unit?: string; // Metric unit (e.g., 'g/dL', 'mmol/L')
  series: TrendPoint[]; // Required, split into separate docs if > 5000 points
  analysis: 'rising' | 'falling' | 'stable' | 'insufficient_data';
  confidence: number; // 0-1 confidence score
  lastValue?: number; // Cache latest value for quick access
  lastTimestamp?: Date; // Cache latest timestamp
  dataPoints: number; // Total count for statistics
  createdAt: Date;
  updatedAt: Date;
}

// Optimized indexes for time-series queries
export const trendsIndexes: IndexSpec[] = [
  { key: { profileId: 1, metricKey: 1 }, unique: true, name: 'idx_profile_metric' }, // Primary lookup
  { key: { profileId: 1, updatedAt: -1 }, name: 'idx_profile_recent' }, // Recent trends by profile
  { key: { metricKey: 1 }, name: 'idx_metric' }, // Cross-profile metric aggregation
  { key: { analysis: 1 }, name: 'idx_analysis' }, // Filter by trend pattern
  { key: { confidence: 1 }, name: 'idx_confidence' }, // Filter by confidence threshold
];
