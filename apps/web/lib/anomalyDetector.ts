/**
 * Anomaly Detection Utility
 * Detects suspicious patterns in NFC emergency access attempts
 */

import { EmergencyNfcAccessLog, GeoLocation } from '@/../../packages/db';

export interface AnomalyDetectionResult {
  flagged: boolean;
  reasons: string[];
  severity: 'low' | 'medium' | 'high';
  score: number; // 0-100 confidence
}

interface AccessPattern {
  timestamp: Date;
  ip: string;
  location?: GeoLocation;
  action: string;
}

/**
 * Detect rapid succession taps
 * Multiple accesses within a very short time window
 */
export function detectRapidSuccession(
  recentAccesses: AccessPattern[],
  windowSeconds: number = 10,
  threshold: number = 5
): boolean {
  if (recentAccesses.length < threshold) {
    return false;
  }

  const now = Date.now();
  const recentInWindow = recentAccesses.filter(
    (access) => now - access.timestamp.getTime() < windowSeconds * 1000
  );

  return recentInWindow.length >= threshold;
}

/**
 * Detect geographic jumps
 * Same token accessed from different locations too quickly
 */
export function detectGeographicJump(
  recentAccesses: AccessPattern[],
  maxTimeMinutes: number = 60
): { detected: boolean; distance?: number } {
  if (recentAccesses.length < 2) {
    return { detected: false };
  }

  // Sort by timestamp descending (most recent first)
  const sorted = [...recentAccesses].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const most = sorted[0];
  const previous = sorted[1];

  // Check time difference
  const timeDiffMs = most.timestamp.getTime() - previous.timestamp.getTime();
  const timeDiffMinutes = timeDiffMs / (1000 * 60);

  if (timeDiffMinutes > maxTimeMinutes) {
    return { detected: false }; // Enough time has passed
  }

  // Check location difference
  if (!most.location || !previous.location) {
    return { detected: false }; // Can't determine
  }

  // Simple distance calculation using Haversine formula
  const distance = calculateDistance(
    most.location.latitude || 0,
    most.location.longitude || 0,
    previous.location.latitude || 0,
    previous.location.longitude || 0
  );

  // Impossible to travel >500 km in less than 1 hour
  const maxDistanceKm = (timeDiffMinutes / 60) * 900; // Assume max speed 900 km/h (plane)

  if (distance > maxDistanceKm) {
    return { detected: true, distance };
  }

  return { detected: false, distance };
}

/**
 * Calculate distance between two coordinates (in km)
 * Using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Detect brute force OTP attempts
 * Multiple failed OTP attempts in short time
 */
export function detectOtpBruteForce(
  recentOtpAttempts: { timestamp: Date; verified: boolean }[],
  threshold: number = 3,
  windowMinutes: number = 15
): boolean {
  if (recentOtpAttempts.length < threshold) {
    return false;
  }

  const now = Date.now();
  const recentFailures = recentOtpAttempts.filter(
    (attempt) =>
      !attempt.verified && now - attempt.timestamp.getTime() < windowMinutes * 60 * 1000
  );

  return recentFailures.length >= threshold;
}

/**
 * Detect unusual access time
 * Access at unusual hours (e.g., 3 AM on a weekday)
 */
export function detectUnusualAccessTime(timestamp: Date): boolean {
  const hour = timestamp.getHours();
  const dayOfWeek = timestamp.getDay();

  // Flag if accessing between 2 AM and 5 AM on weekday
  if (hour >= 2 && hour < 5 && dayOfWeek >= 1 && dayOfWeek <= 5) {
    return true;
  }

  return false;
}

/**
 * Detect VPN usage
 */
export function detectVpnUsage(geoLocation?: GeoLocation): boolean {
  if (!geoLocation) {
    return false;
  }

  return geoLocation.isVpn === true;
}

/**
 * Detect different OS/Browser combinations
 * Same user accessing from different devices quickly
 */
export function detectDeviceSwitch(
  recentAccesses: {
    timestamp: Date;
    deviceOs?: string;
    deviceBrowser?: string;
  }[],
  windowMinutes: number = 30
): boolean {
  if (recentAccesses.length < 2) {
    return false;
  }

  const now = Date.now();
  const recentInWindow = recentAccesses.filter(
    (access) => now - access.timestamp.getTime() < windowMinutes * 60 * 1000
  );

  if (recentInWindow.length < 2) {
    return false;
  }

  // Check if OS or browser changed
  const devices = new Set<string>();
  for (const access of recentInWindow) {
    const key = `${access.deviceOs}-${access.deviceBrowser}`;
    devices.add(key);
  }

  return devices.size > 1;
}

/**
 * Comprehensive anomaly detection
 * Combines multiple detection methods
 */
export function detectAnomalies(options: {
  recentAccesses?: AccessPattern[];
  recentOtpAttempts?: { timestamp: Date; verified: boolean }[];
  timestamp?: Date;
  geoLocation?: GeoLocation;
  recentDeviceAccesses?: {
    timestamp: Date;
    deviceOs?: string;
    deviceBrowser?: string;
  }[];
}): AnomalyDetectionResult {
  const reasons: string[] = [];
  let score = 0;

  // Check rapid succession
  if (options.recentAccesses && detectRapidSuccession(options.recentAccesses, 10, 5)) {
    reasons.push('rapid_succession');
    score += 15;
  }

  // Check geographic jump
  if (options.recentAccesses) {
    const geoJump = detectGeographicJump(options.recentAccesses, 60);
    if (geoJump.detected) {
      reasons.push('geographic_jump');
      score += 25;
    }
  }

  // Check OTP brute force
  if (options.recentOtpAttempts && detectOtpBruteForce(options.recentOtpAttempts, 3, 15)) {
    reasons.push('otp_brute_force');
    score += 30;
  }

  // Check unusual access time
  if (options.timestamp && detectUnusualAccessTime(options.timestamp)) {
    reasons.push('unusual_time');
    score += 10;
  }

  // Check VPN usage
  if (options.geoLocation && detectVpnUsage(options.geoLocation)) {
    reasons.push('vpn_detected');
    score += 5;
  }

  // Check device switch
  if (
    options.recentDeviceAccesses &&
    detectDeviceSwitch(options.recentDeviceAccesses, 30)
  ) {
    reasons.push('device_switch');
    score += 10;
  }

  // Determine severity
  let severity: 'low' | 'medium' | 'high' = 'low';
  if (score >= 30 && score < 60) {
    severity = 'medium';
  } else if (score >= 60) {
    severity = 'high';
  }

  return {
    flagged: reasons.length > 0,
    reasons,
    severity,
    score: Math.min(100, score),
  };
}

/**
 * Get anomaly description for user notification
 */
export function getAnomalyDescription(
  anomaly: AnomalyDetectionResult
): { title: string; description: string } | null {
  if (!anomaly.flagged) {
    return null;
  }

  const reasonMap: Record<string, string> = {
    rapid_succession: 'Multiple rapid accesses detected',
    geographic_jump: 'Access from geographically distant location',
    otp_brute_force: 'Multiple failed OTP attempts',
    unusual_time: 'Access at unusual time',
    vpn_detected: 'Access through VPN detected',
    device_switch: 'Access from different devices',
  };

  const reasonDescriptions = anomaly.reasons
    .map((r) => reasonMap[r] || r)
    .join(', ');

  return {
    title: `Unusual Activity Alert (${anomaly.severity.toUpperCase()})`,
    description: `We detected unusual activity on your emergency profile: ${reasonDescriptions}. If this wasn't you, please revoke the affected NFC card immediately.`,
  };
}
