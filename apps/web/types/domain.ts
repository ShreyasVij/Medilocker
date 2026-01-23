// Shared domain types for web layer; keep aligned with shared-types package.
export interface User {
  id: string;
  email: string;
  roles: Array<'patient' | 'guardian' | 'doctor' | 'admin' | 'system-worker'>;
}

export interface Profile {
  id: string;
  userId: string;
  type: 'self' | 'dependent';
  displayName: string;
}

export interface Document {
  id: string;
  profileId: string;
  docType: 'prescription' | 'lab' | 'scan' | 'discharge' | 'other';
  storageKey: string;
}
