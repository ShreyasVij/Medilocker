// labStructured collection: DEPRECATED - merged into classification collection
// This file is kept for backwards compatibility only.
// New implementations should use classification.ts instead.

export interface Observation {
  name: string;
  value: number | string;
  unit?: string;
  refRange?: string;
  flags?: string[];
}

export interface LabStructuredDocument {
  id: string;
  documentId: string;
  panel?: string;
  observations?: Observation[];
  createdAt: Date;
}

// DEPRECATED: See classification.ts for merged schema
export const labStructuredIndexes: any[] = [];
