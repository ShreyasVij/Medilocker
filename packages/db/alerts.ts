// alerts collection: time-bound alerts and reminders with auto-cleanup.
import { IndexSpec } from './indexes';

export interface AlertDocument {
  id: string;
  profileId: string;
  type: 'followup' | 'medication' | 'abnormal' | 'preventive' | 'lab_overdue';
  eventTime: Date; // When the alert should trigger
  relatedDocumentId?: string; // Link to triggering document
  payload: {
    title: string;
    description: string;
    actionUrl?: string;
  };
  status: 'pending' | 'triggered' | 'acknowledged' | 'dismissed';
  triggeredAt?: Date;
  dismissedAt?: Date;
  createdAt: Date;
  expiresAt?: Date; // Auto-delete after expiration (e.g., 90 days)
}

// Indexes optimized for alert retrieval and cleanup
export const alertsIndexes: IndexSpec[] = [
  { key: { profileId: 1, status: 1 }, name: 'idx_profile_status' }, // Active alerts per profile
  { key: { profileId: 1, type: 1, status: 1 }, name: 'idx_profile_type_status' }, // Filtered alerts
  { key: { eventTime: 1 }, name: 'idx_event_time' }, // Upcoming alerts
  { key: { status: 1, createdAt: -1 }, name: 'idx_status_recent' }, // By status
  { key: { expiresAt: 1 }, name: 'idx_expiry', expireAfterSeconds: 0 }, // TTL auto-cleanup
];
