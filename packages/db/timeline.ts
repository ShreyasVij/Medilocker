// timeline collection: chronological view grouped by condition or episode.
import { IndexSpec } from './indexes';

export interface TimelineItem {
  docId: string;
  type: 'prescription' | 'lab' | 'scan' | 'discharge' | 'other';
  date: Date;
  tags?: string[];
  title?: string; // Document title for display
}

export interface TimelineDocument {
  id: string;
  profileId: string;
  groupingKey: string; // Condition or episode identifier for grouping
  items: TimelineItem[]; // Sorted chronologically
  createdAt: Date;
  updatedAt: Date;
}

// Optimized indexes for timeline queries
export const timelineIndexes: IndexSpec[] = [
  { key: { profileId: 1 }, name: 'idx_profile' }, // Get all timeline groups for profile
  { key: { profileId: 1, groupingKey: 1 }, unique: true, name: 'idx_profile_grouping' }, // Get specific group
  { key: { 'items.date': -1 }, name: 'idx_item_date' }, // Time-ordered access
  { key: { groupingKey: 1 }, name: 'idx_grouping' }, // Cross-profile grouping analysis
];
