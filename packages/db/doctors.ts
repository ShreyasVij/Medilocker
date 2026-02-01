import { IndexSpec } from './indexes';
import { ObjectId } from 'mongodb';


export interface DoctorProfile {
  phone?: string;
  dob?: Date;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  profileImageUrl?: string;
  profileImageName?: string;
  specialization?: string; // Doctor's specialty (e.g., Cardiology, Pediatrics)
  
  location?: {
    hos?: string; // Hospital/Clinic Address
    city?: string;
    state?: string;
    country?: string;
    latitude?: number; // GPS latitude for clinic location
    longitude?: number; // GPS longitude for clinic location
  };
}


export interface Appointment {
  id: string;
  patientId?: ObjectId; 
  patientName: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  appointmentTime: string;
  date: string; 
  status: "upcoming" | "ongoing" | "completed";
  reason?: string;
  notes?: string;
  duration?: number;
  createdAt?: Date;
  updatedAt?: Date;
}


export interface DoctorDocument {
  _id: ObjectId;
  
  // Unique 16-character code for patient searching
  doctorCode: string; // UNIQUE, auto-generated, 16 alphanumeric characters
  
  userId?: ObjectId; 
  email: string;
  name: string;
  
  profile?: DoctorProfile;
  
  role: "Doctor";
  
  status?: "active" | "inactive" | "suspended";
  
  // Google Calendar Integration
  googleTokens?: {
    access_token: string;
    refresh_token: string;
    expiry_date: number;
  };
  
  // Timestamps
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}


export interface AppointmentDocument {
  _id: ObjectId;
  

  doctorId: ObjectId;
  patientId?: ObjectId; 
  

  patientName: string;
  patientEmail?: string; // Patient email for notifications
  patientAge: number;
  patientGender: "Male" | "Female" | "Other";
  

  appointmentTime: string;
  date: string; 
  duration?: number; 
  

  status: "pending" | "approved" | "rejected" | "upcoming" | "ongoing" | "completed" | "cancelled";
  reason?: string;
  notes?: string;
  diagnosis?: string;
  prescription?: string;
  
  // Google Calendar Integration
  googleEventId?: string; // Google Calendar event ID
  syncedToGoogle?: boolean; // Whether event was synced to Google Calendar
  

  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  approvedAt?: Date; // Timestamp when doctor approved
  rejectedAt?: Date; // Timestamp when doctor rejected
}


export const doctorsIndexes: IndexSpec[] = [
  { key: { email: 1 }, unique: true, name: 'idx_email_unique' },
  { key: { doctorCode: 1 }, unique: true, name: 'idx_doctor_code_unique' }, // CRITICAL: Enforce unique doctor code
  { key: { userId: 1 }, sparse: true, name: 'idx_user_id' },
  { key: { status: 1 }, name: 'idx_status' },
  { key: { 'profile.location.city': 1, 'profile.location.state': 1 }, name: 'idx_location' },
  { key: { lastLoginAt: -1 }, name: 'idx_last_login' },
  { key: { createdAt: -1 }, name: 'idx_created' },
];


export const appointmentsIndexes: IndexSpec[] = [
  { key: { doctorId: 1, date: 1 }, name: 'idx_doctor_date' },
  { key: { patientId: 1, date: 1 }, name: 'idx_patient_date', sparse: true },
  { key: { doctorId: 1, status: 1, date: 1 }, name: 'idx_doctor_status_date' },
  { key: { date: 1, appointmentTime: 1 }, name: 'idx_schedule' },
  { key: { status: 1 }, name: 'idx_status' },
  // CRITICAL: Prevent double booking - unique constraint on doctor + date + time
  { key: { doctorId: 1, date: 1, appointmentTime: 1 }, unique: true, name: 'idx_no_double_booking' },
];

// DoctorFiles - Stores patient medical files temporarily linked to appointments
export interface DoctorFileDocument {
  _id: ObjectId;
  
  // References
  appointmentId: ObjectId; // Link to appointment
  doctorId: ObjectId; // Link to doctor
  patientId: ObjectId; // Link to patient
  
  // Original file metadata from patient
  originalFileId: ObjectId; // Reference to original document in documents collection
  fileName: string;
  fileType: string; // e.g., "prescription", "lab", "scan"
  mimeType?: string;
  storageUrl: string; // URL to the file in storage
  fileSize?: number;
  
  // Metadata
  uploadedAt: Date; // Original upload date from patient
  transferredAt: Date; // When file was transferred to doctor
  createdAt: Date;
}

// Indexes for DoctorFiles collection
export const doctorFilesIndexes: IndexSpec[] = [
  { key: { appointmentId: 1 }, name: 'idx_appointment' }, // Find all files for an appointment
  { key: { doctorId: 1 }, name: 'idx_doctor' }, // Find all files for a doctor
  { key: { patientId: 1 }, name: 'idx_patient' }, // Find all files from a patient
  { key: { appointmentId: 1, doctorId: 1 }, name: 'idx_appointment_doctor' }, // Composite for deletion
  { key: { createdAt: -1 }, name: 'idx_created' },
  { key: { createdAt: -1 }, name: 'idx_created' },
];
