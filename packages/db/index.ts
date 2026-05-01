/**
 * Barrel export for all database collection schemas and indexes
 * This helps TypeScript resolve imports more reliably
 */

// Re-export all collection interfaces and indexes
export * from './users';
export { type EmergencyContact } from './users';
export * from './profiles';
export * from './documents';
export * from './documentVersions';
export * from './classification';
// Note: labStructured is deprecated and not re-exported to avoid type name collisions
export * from './shares';
export * from './audits';
export * from './sessions';
export * from './alerts';
export * from './trends';
export * from './summaries';
export * from './insights';
export * from './timeline';
export * from './claims';
export * from './healthScores';
export * from './redundancyChecks';
export * from './doctors';
export * from './adminEvents';
export * from './jobs';
export * from './ocrOutputs';
export * from './userVitals';
export * from './userHealthSummary';
export * from './emergencyTokens';
export * from './emergencyAudit';
export * from './emergencyNfcTokens';
export * from './emergencyNfcAccessLogs';
export * from './emergencyNfcOtpSessions';

// Re-export utility functions
export * from './indexes';
export * from './schemaValidation';
export * from './init';
export * from './utils'; // Doctor code utilities
