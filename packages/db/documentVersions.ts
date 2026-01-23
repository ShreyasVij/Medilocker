// documentVersions collection: immutable file versions with hashes.
export interface DocumentVersionDocument {
  id: string;
  documentId: string;
  storageKey: string;
  hash?: string;
  size?: number;
  mimeType?: string;
  createdAt: Date;
}

// Indexes: documentId; createdAt.
export const documentVersionsIndexes = [
  { key: { documentId: 1 } },
  { key: { createdAt: -1 } },
];
