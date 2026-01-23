// claims collection: insurance claim support with bundled documents.
import { IndexSpec } from './indexes';

export interface ClaimDocument {
  id: string;
  profileId: string;
  documentIds: string[]; // Document references for claim
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  bundleKey: string; // S3 key for exported bundle
  insurerId?: string; // Insurance provider ID
  policyNumber?: string;
  claimDate: Date; // When claim was filed
  createdAt: Date;
  updatedAt: Date;
}

// Optimized indexes for claim management
export const claimsIndexes: IndexSpec[] = [
  { key: { profileId: 1, status: 1 }, name: 'idx_profile_status' }, // Claims for profile by status
  { key: { profileId: 1, claimDate: -1 }, name: 'idx_profile_recent' }, // Recent claims
  { key: { status: 1, updatedAt: -1 }, name: 'idx_status_updated' }, // All claims by status
  { key: { insurerId: 1 }, name: 'idx_insurer' }, // Claims by insurance provider
  { key: { bundleKey: 1 }, unique: true, sparse: true, name: 'idx_bundle' }, // Bundle lookup
];
