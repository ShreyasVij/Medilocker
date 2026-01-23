// sessions collection: JWT session tracking with refresh rotation and revocation.
import { IndexSpec } from './indexes';

export interface SessionDocument {
  id: string;
  userId: string;
  refreshTokenHash: string; // SHA256 of refresh token
  accessTokenFamily?: string; // For refresh rotation tracking
  issuedAt: Date;
  expiresAt: Date; // When this session becomes invalid
  revokedAt?: Date; // Explicit revocation timestamp
  lastActivityAt?: Date; // For inactivity tracking
  ipAddress?: string; // For session validation
  userAgent?: string; // Device tracking
  metadata?: Record<string, unknown>;
}

// Indexes for session lifecycle management
export const sessionsIndexes: IndexSpec[] = [
  { key: { userId: 1, expiresAt: -1 }, name: 'idx_user_valid' }, // Valid sessions per user
  { key: { userId: 1, issuedAt: -1 }, name: 'idx_user_recent' }, // Recent sessions
  { key: { expiresAt: 1 }, name: 'idx_expiry', expireAfterSeconds: 0 }, // TTL auto-cleanup
  { key: { revokedAt: 1 }, name: 'idx_revoked' }, // Find revoked sessions
  { key: { refreshTokenHash: 1 }, name: 'idx_refresh_hash' }, // Validate refresh tokens
];
