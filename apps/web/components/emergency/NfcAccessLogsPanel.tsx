/**
 * NfcAccessLogsPanel Component
 * Displays access logs for NFC tokens
 */

'use client';

import React, { useState, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';

interface AccessLog {
  logId: string;
  timestamp: Date;
  action: string;
  actionLabel: string;
  ip: string;
  location: {
    city?: string;
    country?: string;
    timezone?: string;
  };
  deviceInfo: {
    os?: string;
    browser?: string;
    deviceName?: string;
  };
  dataAccessedLevel: string;
  responderContext?: {
    name?: string;
    organization?: string;
  };
  flaggedAsAnomalous: boolean;
  anomalyReasons?: string[];
  anomalySeverity?: 'low' | 'medium' | 'high';
  statusCode: number;
  errorMessage?: string;
  patientNotified: boolean;
}

interface NfcAccessLogsPanelProps {
  profileId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const NfcAccessLogsPanel: React.FC<NfcAccessLogsPanelProps> = ({
  profileId,
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [filterAnomalies, setFilterAnomalies] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, filterAnomalies, offset, profileId]);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        profileId,
        limit: limit.toString(),
        offset: offset.toString(),
        ...(filterAnomalies && { anomalyOnly: 'true' }),
      });

      const response = await fetch(`/api/emergency/nfc/logs?${params}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch logs');
      }

      const data = await response.json();
      setLogs(data.logs);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const getActionIcon = (action: string): string => {
    const icons: Record<string, string> = {
      tap: '📱',
      view_public: '👁️',
      request_full_access: '🔓',
      otp_sent: '📧',
      otp_attempted: '🔐',
      otp_verified: '✅',
      full_access_granted: '🔓',
      pre_auth_access_granted: '👨‍⚕️',
      anomaly_detected: '⚠️',
      error: '❌',
    };
    return icons[action] || '📋';
  };

  const getSeverityColor = (severity?: string): string => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">📋 Access Logs</h2>
              <p className="text-sm text-gray-600 mt-1">Audit trail of all emergency profile accesses</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ✕
            </button>
          </div>

          {/* Filters & Summary */}
          <div className="space-y-4">
            {summary && (
              <div className="grid grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-gray-600">Total Accesses</p>
                  <p className="text-xl font-bold text-gray-900">{summary.totalAccesses}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">OTP Verified</p>
                  <p className="text-xl font-bold text-gray-900">{summary.otpVerifiedCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Anomalies</p>
                  <p className="text-xl font-bold text-red-600">{summary.anomalousAccesses}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Pre-Auth Access</p>
                  <p className="text-xl font-bold text-blue-600">{summary.preAuthAccessCount}</p>
                </div>
              </div>
            )}

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filterAnomalies}
                onChange={(e) => {
                  setFilterAnomalies(e.target.checked);
                  setOffset(0);
                }}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">
                Show only anomalies
              </span>
            </label>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading logs...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">
                {filterAnomalies ? 'No anomalies detected' : 'No access logs yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.logId}
                  className={`p-4 rounded-lg border ${
                    log.flaggedAsAnomalous
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getActionIcon(log.action)}</span>
                      <div>
                        <p className="font-medium text-gray-900">{log.actionLabel}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                    {log.statusCode >= 200 && log.statusCode < 300 ? (
                      <span className="text-xs font-medium text-green-600">✓ Success</span>
                    ) : (
                      <span className="text-xs font-medium text-red-600">✗ Error {log.statusCode}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                    <div>
                      <p className="font-medium">Location</p>
                      <p>{log.location.city}, {log.location.country}</p>
                    </div>
                    <div>
                      <p className="font-medium">Device</p>
                      <p>
                        {log.deviceInfo.os} • {log.deviceInfo.browser}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Data Accessed</p>
                      <p className="capitalize">{log.dataAccessedLevel}</p>
                    </div>
                    <div>
                      <p className="font-medium">IP Address</p>
                      <p>{log.ip}</p>
                    </div>
                  </div>

                  {log.responderContext && (
                    <div className="text-xs text-gray-700 mb-2 p-2 bg-white rounded border border-gray-200">
                      <p className="font-medium">Responder</p>
                      <p>
                        {log.responderContext.name}
                        {log.responderContext.organization && ` at ${log.responderContext.organization}`}
                      </p>
                    </div>
                  )}

                  {log.flaggedAsAnomalous && (
                    <div className={`p-2 rounded border ${getSeverityColor(log.anomalySeverity)}`}>
                      <p className="text-xs font-medium mb-1">Anomaly Detected ({log.anomalySeverity?.toUpperCase()})</p>
                      <div className="flex flex-wrap gap-1">
                        {log.anomalyReasons?.map((reason) => (
                          <span
                            key={reason}
                            className="text-xs px-2 py-1 bg-white bg-opacity-50 rounded"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {log.errorMessage && (
                    <div className="text-xs text-red-700 mt-2 p-2 bg-red-100 rounded">
                      {log.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {logs.length > 0 && (
          <div className="flex justify-between items-center p-6 border-t border-gray-200">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0 || isLoading}
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded disabled:opacity-50 hover:bg-gray-300"
            >
              ← Previous
            </button>
            <span className="text-sm text-gray-600">
              Showing {offset + 1}-{offset + logs.length} logs
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={logs.length < limit || isLoading}
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded disabled:opacity-50 hover:bg-gray-300"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NfcAccessLogsPanel;
