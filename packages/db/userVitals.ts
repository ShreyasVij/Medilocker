// userVitals collection: stores latest vital readings per user with AI-generated explanations
import { IndexSpec } from './indexes';

export interface VitalReading {
  id: string;
  userId: string;
  vitalType: string; // e.g., "blood_sugar", "blood_pressure_systolic", "cholesterol_total", "hemoglobin"
  vitalCategory: string; // e.g., "blood", "vitals", "lipids", "liver", "kidney"
  label: string; // Human-readable label e.g., "Blood Sugar (Fasting)"
  value: string | number;
  unit: string | null;
  documentId: string;
  documentDate: Date; // Prefer report_date from extraction, fallback to upload date
  source: string; // Document title or type
  explanation: string; // AI-generated 1-2 line explanation with health advice
  advice: string; // AI-generated actionable advice for this vital
  status?: "normal" | "warning" | "alert"; // Health status indicator
  createdAt: Date;
  updatedAt: Date;
}

export const userVitalsIndexes: IndexSpec[] = [
  // Unique constraint: one latest reading per user per document per vital type
  { key: { userId: 1, documentId: 1, vitalType: 1 }, unique: true, name: 'idx_user_doc_vital_unique' },
  
  // Query by user and category for organized display
  { key: { userId: 1, vitalCategory: 1, documentDate: -1 }, name: 'idx_user_category' },
  
  // Query all vitals for a user, sorted by date
  { key: { userId: 1, documentDate: -1 }, name: 'idx_user_recent' },
  
  // Track which documents contributed vitals
  { key: { documentId: 1 }, name: 'idx_document' },
];
