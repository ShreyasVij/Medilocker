/**
 * NFC Emergency Access System - Utility Index
 * Centralized exports for easy importing of NFC utilities
 */

// Token & OTP Generation
export * from './nfcGenerator';

// Rate Limiting
export * from './rateLimiter';

// Anomaly Detection
export { detectAnomalies, detectRapidSuccession, detectGeographicJump, detectOtpBruteForce, detectUnusualAccessTime, detectVpnUsage, detectDeviceSwitch, getAnomalyDescription } from './anomalyDetector';

// Profile Filtering
export { filterToPublicProfile, filterToFullProfile, getAccessedFields } from './emergencyNfcFilters';

// Geolocation
export { getGeolocationFromIp, getLocationString } from './geolocation';
