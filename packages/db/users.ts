import { IndexSpec } from './indexes';
import { ObjectId } from 'mongodb';

export interface MedicalProfile {
  bloodGroup?: string;
  allergies?: string;
  conditions?: string;
  medications?: string;
}

export interface EmergencyContact {
  name?: string;
  phone?: string;
  relationship?: string;
}

export interface LocationProfile {
  city?: string;
  state?: string;
  country?: string;
}

export interface UserProfile {
  phone?: string;
  dob?: Date;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  profileImageUrl?: string;
  profileImageName?: string;

  medical?: MedicalProfile;
  emergency?: EmergencyContact;
  location?: LocationProfile;
}



export interface UserDocument {
  _id: ObjectId;


  email: string;
  name: string;
  googleSub: string;

  identityProvider?: "google" | "email";
  identityId?: string;


  familyId?: string | null;
  familyRole?: "owner" | "member";


  roles: ('patient' | 'guardian' | 'doctor' | 'admin' | 'system-worker')[];


  profile?: UserProfile;


  status?: "active" | "suspended" | "deleted";
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}


export const usersIndexes: IndexSpec[] = [
  { key: { email: 1 }, unique: true, name: 'idx_email_unique' },

  { 
    key: { identityProvider: 1, identityId: 1 }, 
    unique: true, 
    sparse: true,
    name: 'idx_identity_unique' 
  },

  { key: { status: 1 }, name: 'idx_status' },
  { key: { roles: 1 }, name: 'idx_roles' },
  { key: { lastLoginAt: -1 }, name: 'idx_last_login' },

  { key: { familyId: 1 }, name: 'idx_family' }
];
