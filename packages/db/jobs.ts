// jobs collection: background processing tasks (ingestion, OCR, classification)
import { IndexSpec } from './indexes';

export interface JobDocument {
  id: string;
  type: 'ingest' | 'ocr' | 'classify' | 'extract-structured' | 'summarize-doc' | 'history-summary';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority?: number;
  attempts?: number;
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt?: Date;
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
}

export const jobsIndexes: IndexSpec[] = [
  { key: { status: 1, createdAt: 1 }, name: 'idx_status_created' },
  { key: { type: 1, status: 1, priority: -1, createdAt: 1 }, name: 'idx_type_status_priority' },
];
