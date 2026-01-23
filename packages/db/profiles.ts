// profiles collection: health identity (self or dependent).
import { IndexSpec } from './indexes';

export interface GuardianLink {
  userId: string;
  name: string; // Denormalized
  email: string; // Denormalized
  type: 'parent' | 'caregiver' | 'power-of-attorney';
  permissions: ('view' | 'upload' | 'manage')[];
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface EmergencyData {
  notes?: string; // Critical emergency instructions
  contacts?: EmergencyContact[];
}

export interface ProfileDocument {
  id: string;
  userId: string; // Owner user ID
  type: 'self' | 'dependent';
  displayName: string;
  dateOfBirth?: Date; // For age calculation
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  allergies?: string[];
  conditions?: string[];
  emergencyData?: EmergencyData; // Emergency access data
  // Encrypted at rest; decrypted on read for authorized users
  emergencyContactEnc?: string; // v1.base64(iv|tag|ciphertext)
  vitalIdentifiers?: Record<string, unknown>;
  guardians: GuardianLink[]; // Cached denormalized data
  createdAt: Date;
  updatedAt: Date;
}

// Indexes for profile access and hierarchy
export const profilesIndexes: IndexSpec[] = [
  { key: { userId: 1, type: 1 }, name: 'idx_user_type' }, // User's profiles
  { key: { userId: 1 }, name: 'idx_user' }, // All profiles for user
  { key: { 'guardians.userId': 1 }, name: 'idx_guardian_user' }, // Dependent lookup by guardian
  { key: { type: 1 }, name: 'idx_type' }, // Filter by type
];
