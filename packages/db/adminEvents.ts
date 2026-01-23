// adminEvents collection: admin actions for verification and monitoring.
export interface AdminEventDocument {
  id: string;
  actorId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  timestamp: Date;
}

// Indexes: actorId; eventType.
export const adminEventsIndexes = [
  { key: { actorId: 1 } },
  { key: { eventType: 1 } },
];
