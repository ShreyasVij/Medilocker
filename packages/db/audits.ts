// audits collection: comprehensive security and access logging for compliance.
import { IndexSpec } from './indexes';

export interface AuditDocument {
  id: string;
  actorId: string;
  action: 'login' | 'document.upload' | 'document.download' | 'share.create' | 
          'share.revoke' | 'access.grant' | 'access.revoke' | 'emergency.access' | 'admin.action';
  target: string; // Resource being acted upon (profileId, documentId, shareId)
  targetType: 'profile' | 'document' | 'share' | 'user' | 'system';
  resourceId?: string; // Specific resource affected
  result: 'success' | 'failure'; // Outcome of action
  timestamp: Date;
  ipAddress?: string; // For suspicious activity tracking
  userAgent?: string;
  metadata?: Record<string, unknown>;
  archived?: boolean; // For retention policies
}

// Comprehensive indexes for audit queries and compliance
export const auditsIndexes: IndexSpec[] = [
  { key: { actorId: 1, timestamp: -1 }, name: 'idx_actor_time' }, // User activity timeline
  { key: { target: 1, timestamp: -1 }, name: 'idx_target_time' }, // Access to resource
  { key: { action: 1, timestamp: -1 }, name: 'idx_action_time' }, // Action type timeline
  { key: { timestamp: -1 }, name: 'idx_recent' }, // Recent activity
  { key: { result: 1, timestamp: -1 }, name: 'idx_failures' }, // Failed access attempts
  { key: { targetType: 1, timestamp: -1 }, name: 'idx_resource_type' }, // By resource type
];
