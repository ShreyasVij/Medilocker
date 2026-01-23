// shares collection: time-bound access grants with scopes.
import { IndexSpec } from './indexes';

export interface ShareDocument {
  id: string;
  ownerUserId: string;
  profileId: string;
  grantedToEmail?: string;
  grantedToUserId?: string;
  grantedToName?: string; // Denormalized for performance
  granteeType: 'doctor' | 'email' | 'institution-user';
  permissions: ('view' | 'upload' | 'summary')[];
  scope: {
    docIds?: string[];
    types?: ('prescription' | 'lab' | 'scan' | 'discharge' | 'other')[];
  };
  expiresAt: Date; // Required for TTL enforcement
  status: 'active' | 'revoked' | 'expired';
  usedAt?: Date; // Track first access
  createdAt: Date;
  revokedAt?: Date; // Soft revocation timestamp
}

// Critical indexes for access control and TTL
export const sharesIndexes: IndexSpec[] = [
  { key: { ownerUserId: 1, profileId: 1 }, name: 'idx_owner_profile' }, // Owner's shares
  { key: { profileId: 1, status: 1 }, name: 'idx_profile_active' }, // Active shares per profile
  { key: { grantedToEmail: 1, status: 1 }, name: 'idx_grantee_email' }, // Doctor lookup
  { key: { grantedToUserId: 1, status: 1 }, name: 'idx_grantee_user' }, // Registered doctor access
  { key: { expiresAt: 1 }, name: 'idx_expiry', expireAfterSeconds: 0 }, // TTL auto-cleanup
  { key: { status: 1, expiresAt: -1 }, name: 'idx_status_expiry' }, // Find expired shares
];
