/**
 * emergencyNfcAccessLogs collection
 * Immutable audit trail of all NFC access attempts
 */
import { ObjectId } from 'mongodb';
import { IndexSpec } from './indexes';
import { getDbClient } from '@/lib/db';

export type NfcAccessAction =
  | 'tap'
  | 'view_public'
  | 'request_full_access'
  | 'otp_sent'
  | 'otp_attempted'
  | 'otp_verified'
  | 'full_access_granted'
  | 'pre_auth_access_granted'
  | 'access_expired'
  | 'rate_limit_exceeded'
  | 'token_revoked_access'
  | 'anomaly_detected'
  | 'error';

export type DataAccessLevel = 'none' | 'public' | 'public_with_summary' | 'full';

export interface GeoLocation {
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  isp?: string;
  isVpn?: boolean;
  errorMessage?: string;
}

export interface ResponderContext {
  name?: string;
  role?: string;
  organization?: string;
  specialization?: string;
}

export interface OtpFlowDetails {
  otpSessionId?: string;
  deliveryMethod?: 'email' | 'sms';
  sentTo?: string;
  sentToMasked?: string;
  verified?: boolean;
  attempts?: number;
  firstAttemptAt?: Date;
  lastAttemptAt?: Date;
}

export interface EmergencyNfcAccessLog {
  _id?: ObjectId;
  id: string; // UUID
  tokenId: string; // UUID
  profileId: string;
  userId: ObjectId;

  action: NfcAccessAction;
  timestamp: Date;

  // Requester Info
  ip: string;
  userAgent: string;
  deviceOs?: 'iOS' | 'Android' | 'Web' | 'Unknown';
  deviceBrowser?: string;
  deviceName?: string;

  // Geolocation Data
  geoLocation?: GeoLocation;

  // Access Level & Data Exposure
  dataAccessedLevel: DataAccessLevel;
  dataAccessedFields?: string[];

  // OTP Flow Details
  otpFlow?: OtpFlowDetails;

  // Doctor/Responder Context
  responderContext?: ResponderContext;

  // Anomalies & Flags
  flaggedAsAnomalous: boolean;
  anomalyReasons?: string[];
  anomalySeverity?: 'low' | 'medium' | 'high';

  // Response & Outcome
  statusCode: number;
  errorMessage?: string;
  responseTimeMs?: number;

  // Patient Notification
  patientNotifiedAt?: Date;
  patientNotificationRead?: boolean;

  createdAt: Date;
}

export const emergencyNfcAccessLogsIndexes: IndexSpec[] = [
  { key: { tokenId: 1, timestamp: -1 }, name: 'idx_token_recent' },
  { key: { userId: 1, timestamp: -1 }, name: 'idx_user_recent' },
  { key: { flaggedAsAnomalous: 1, timestamp: -1 }, name: 'idx_anomalies' },
  { key: { ip: 1, timestamp: -1 }, name: 'idx_ip_access_pattern' },
  // TTL Index: Auto-delete logs after 1 year (compliance)
  { key: { createdAt: 1 }, expireAfterSeconds: 31536000, name: 'idx_ttl_1year' },
  // Geospatial index
  {
    key: { 'geoLocation.latitude': '2d', 'geoLocation.longitude': '2d' },
    name: 'idx_geo_2d',
  },
];

export async function createAccessLog(
  tokenId: string,
  profileId: string,
  userId: ObjectId,
  action: NfcAccessAction,
  ip: string,
  userAgent: string,
  statusCode: number,
  dataAccessedLevel: DataAccessLevel = 'none',
  options?: {
    deviceOs?: 'iOS' | 'Android' | 'Web' | 'Unknown';
    deviceBrowser?: string;
    deviceName?: string;
    geoLocation?: GeoLocation;
    responderContext?: ResponderContext;
    otpFlow?: OtpFlowDetails;
    errorMessage?: string;
    responseTimeMs?: number;
    flaggedAsAnomalous?: boolean;
    anomalyReasons?: string[];
    anomalySeverity?: 'low' | 'medium' | 'high';
  }
): Promise<EmergencyNfcAccessLog> {
  const collection = await getEmergencyNfcAccessLogsCollection();

  const log: EmergencyNfcAccessLog = {
    id: generateUUID(),
    tokenId,
    profileId,
    userId,
    action,
    timestamp: new Date(),
    ip,
    userAgent,
    statusCode,
    dataAccessedLevel,
    flaggedAsAnomalous: options?.flaggedAsAnomalous || false,
    createdAt: new Date(),
    ...options,
  };

  const result = await collection.insertOne(log);
  return { ...log, _id: result.insertedId };
}

export async function getLogsForToken(
  tokenId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ logs: EmergencyNfcAccessLog[]; total: number }> {
  const collection = await getEmergencyNfcAccessLogsCollection();

  const [logs, total] = await Promise.all([
    collection
      .find({ tokenId })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
    collection.countDocuments({ tokenId }),
  ]);

  return { logs, total };
}

export async function getLogsForUser(
  userId: ObjectId,
  limit: number = 50,
  offset: number = 0,
  filters?: {
    actionFilter?: NfcAccessAction;
    anomalyOnly?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
  }
): Promise<{ logs: EmergencyNfcAccessLog[]; total: number }> {
  const collection = await getEmergencyNfcAccessLogsCollection();

  const query: any = { userId };

  if (filters?.actionFilter) {
    query.action = filters.actionFilter;
  }

  if (filters?.anomalyOnly) {
    query.flaggedAsAnomalous = true;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    query.timestamp = {};
    if (filters.dateFrom) {
      query.timestamp.$gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      query.timestamp.$lte = filters.dateTo;
    }
  }

  const [logs, total] = await Promise.all([
    collection
      .find(query)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
    collection.countDocuments(query),
  ]);

  return { logs, total };
}

export async function getAnomalousLogs(
  userId: ObjectId,
  limit: number = 50
): Promise<EmergencyNfcAccessLog[]> {
  const collection = await getEmergencyNfcAccessLogsCollection();

  return collection
    .find({ userId, flaggedAsAnomalous: true })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

export async function markPatientNotified(logId: string): Promise<boolean> {
  const collection = await getEmergencyNfcAccessLogsCollection();

  const result = await collection.updateOne(
    { id: logId },
    {
      $set: {
        patientNotifiedAt: new Date(),
      },
    }
  );

  return result.modifiedCount > 0;
}

export async function getAccessLogsSummary(
  userId: ObjectId,
  profileId?: string
): Promise<{
  totalAccesses: number;
  anomalousAccesses: number;
  preAuthAccessCount: number;
  otpVerifiedCount: number;
  publicViewCount: number;
  lastAccessTime?: Date;
}> {
  const collection = await getEmergencyNfcAccessLogsCollection();

  const query: any = { userId };
  if (profileId) {
    query.profileId = profileId;
  }

  const [
    totalAccesses,
    anomalousAccesses,
    preAuthAccessCount,
    otpVerifiedCount,
    publicViewCount,
  ] = await Promise.all([
    collection.countDocuments(query),
    collection.countDocuments({ ...query, flaggedAsAnomalous: true }),
    collection.countDocuments({ ...query, action: 'pre_auth_access_granted' }),
    collection.countDocuments({ ...query, action: 'otp_verified' }),
    collection.countDocuments({ ...query, action: 'view_public' }),
  ]);

  const lastAccess = await collection
    .findOne(query, { sort: { timestamp: -1 } });

  return {
    totalAccesses,
    anomalousAccesses,
    preAuthAccessCount,
    otpVerifiedCount,
    publicViewCount,
    lastAccessTime: lastAccess?.timestamp,
  };
}

async function getEmergencyNfcAccessLogsCollection() {
  const db = await getDbClient();
  return db.collection<EmergencyNfcAccessLog>('emergencyNfcAccessLogs');
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
