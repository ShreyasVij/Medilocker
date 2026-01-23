// classification collection: OCR and inferred tags per document.
// Merged with labStructured data for atomicity and reduced complexity.
import { IndexSpec } from './indexes';

export interface Observation {
  name: string;
  value: number | string;
  unit?: string;
  refRange?: string;
  flags?: string[];
}

export interface ClassificationDocument {
  id: string;
  documentId: string;
  type: 'classification' | 'lab'; // Discriminator for consolidated collection
  
  // Classification fields
  ocrText?: string;
  detectedType?: string;
  confidence: number; // Always required for filtering
  inferredTags?: string[];
  overrides?: Record<string, unknown>;
  
  // Lab-structured fields (when type === 'lab')
  panel?: string;
  observations?: Observation[];
  
  createdAt: Date;
  updatedAt: Date;
}

// Optimized indexes for document analysis queries
export const classificationIndexes: IndexSpec[] = [
  { key: { documentId: 1 }, unique: true, name: 'idx_document_unique' }, // Unique per document
  { key: { confidence: 1 }, name: 'idx_confidence' }, // Filter by confidence threshold
  { key: { type: 1 }, name: 'idx_type' }, // Filter by analysis type
  { key: { detectedType: 1 }, name: 'idx_detected_type' }, // Aggregation
  { key: { panel: 1 }, name: 'idx_panel' }, // Lab-specific queries
  { key: { createdAt: -1 }, name: 'idx_recent' }, // Time-ordered
];
