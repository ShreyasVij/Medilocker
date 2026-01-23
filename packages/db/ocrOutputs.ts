// ocrOutputs collection: raw OCR text extracted from documents
import { IndexSpec } from './indexes';

export interface OcrOutputDocument {
  /**
   * Primary identifier for the OCR output. Historically this was a composite
   * `documentId:versionId` string stored in `id`. For user-based queries the
   * `userId` contains the owner's user `_id` value. Do NOT use the
   * Mongo `_id` field to store the owner's id because `_id` must be unique per
   * document. `ownerId` is an alias for `userId`.
   */
  id: string;
  documentId: string;
  versionId: string;
  storageKey: string;
  text: string;
  engine?: string;
  confidence?: number;
  userId?: string; // Owner's user _id as string for user-based queries
  ownerId?: string; // alias for `userId`
  createdAt: Date;
}

export const ocrOutputsIndexes: IndexSpec[] = [
  { key: { documentId: 1, versionId: 1 }, name: 'idx_doc_version' },
  { key: { userId: 1 }, name: 'idx_user' },
  { key: { createdAt: -1 }, name: 'idx_recent' },
];
