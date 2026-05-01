/**
 * EmergencyNfcCard Component
 * Displays a single NFC token card with management options
 */

'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface NfcToken {
  tokenId: string;
  deviceName: string;
  createdAt: Date;
  lastAccessAt?: Date;
  totalScans: number;
  isActive: boolean;
  isPermanent: boolean;
  revokedAt?: Date;
  otpRequired: boolean;
  preAuthorizedDoctorCount: number;
  preAuthorizedDoctors: Array<{
    doctorEmail: string;
    doctorName?: string;
    expiresAt?: Date;
  }>;
  suspiciousActivityCount: number;
  recentActivity: {
    lastAction?: string;
    lastActionTime?: Date;
    lastActionCity?: string;
  };
}

interface EmergencyNfcCardProps {
  token: NfcToken;
  onRevoke: (tokenId: string) => void;
  onCopyUrl: (url: string) => void;
  onViewLogs: (tokenId: string) => void;
  onAuthorizDoctor: (tokenId: string) => void;
  nfcUrl?: string;
}

export const EmergencyNfcCard: React.FC<EmergencyNfcCardProps> = ({
  token,
  onRevoke,
  onCopyUrl,
  onViewLogs,
  onAuthorizDoctor,
  nfcUrl,
}) => {
  const [isRevoking, setIsRevoking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleRevoke = async () => {
    if (!window.confirm('Are you sure you want to revoke this card? All future taps will be blocked.')) {
      return;
    }

    setIsRevoking(true);
    try {
      onRevoke(token.tokenId);
    } finally {
      setIsRevoking(false);
    }
  };

  const statusColor = token.isActive ? 'text-green-600' : 'text-red-600';
  const statusBadge = token.isActive ? '✅ Active' : '❌ Revoked';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">📱 {token.deviceName}</h3>
          <p className="text-sm text-gray-500 mt-1">
            Created {formatDistanceToNow(new Date(token.createdAt), { addSuffix: true })}
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ⋮
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <button
                onClick={() => {
                  onViewLogs(token.tokenId);
                  setShowMenu(false);
                }}
                className="block w-full text-left px-4 py-2 hover:bg-gray-50"
              >
                📋 View Logs
              </button>
              {token.isActive && (
                <>
                  <button
                    onClick={() => {
                      onAuthorizDoctor(token.tokenId);
                      setShowMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-50"
                  >
                    👨‍⚕️ Pre-authorize Doctor
                  </button>
                  <button
                    onClick={() => {
                      handleRevoke();
                      setShowMenu(false);
                    }}
                    disabled={isRevoking}
                    className="block w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 disabled:opacity-50"
                  >
                    {isRevoking ? '⏳ Revoking...' : '🗑️ Revoke Card'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div className={`text-sm font-medium mb-4 ${statusColor}`}>{statusBadge}</div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4 bg-gray-50 p-4 rounded-lg">
        <div>
          <p className="text-xs text-gray-600">Scans</p>
          <p className="text-2xl font-bold text-gray-900">{token.totalScans}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Last Access</p>
          <p className="text-sm font-medium text-gray-900">
            {token.lastAccessAt
              ? formatDistanceToNow(new Date(token.lastAccessAt), { addSuffix: true })
              : 'Never'}
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      {token.lastAccessAt && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm">
            <span className="font-medium text-blue-900">Last access:</span>
            <span className="text-blue-700 ml-2">
              {formatDistanceToNow(new Date(token.lastAccessAt), { addSuffix: true })} from{' '}
              {token.recentActivity.lastActionCity || 'Unknown location'}
            </span>
          </p>
        </div>
      )}

      {/* Anomalies Warning */}
      {token.suspiciousActivityCount > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-900">
            <span className="font-medium">⚠️ {token.suspiciousActivityCount} suspicious access(es) detected</span>
            <br />
            <span className="text-xs text-yellow-700 mt-1 block">Review logs for details</span>
          </p>
        </div>
      )}

      {/* Pre-Authorized Doctors */}
      {token.preAuthorizedDoctorCount > 0 && (
        <div className="mb-4 bg-purple-50 rounded-lg p-3 border border-purple-200">
          <p className="text-sm font-medium text-purple-900 mb-2">
            👨‍⚕️ Pre-authorized Doctors ({token.preAuthorizedDoctorCount})
          </p>
          <div className="space-y-1">
            {token.preAuthorizedDoctors.map((doctor) => (
              <p key={doctor.doctorEmail} className="text-xs text-purple-700">
                • {doctor.doctorName || doctor.doctorEmail}
                {doctor.expiresAt && (
                  <span className="ml-2 text-purple-600">
                    (until {new Date(doctor.expiresAt).toLocaleDateString()})
                  </span>
                )}
              </p>
            ))}
            {token.preAuthorizedDoctorCount > 3 && (
              <p className="text-xs text-purple-600 font-medium">
                +{token.preAuthorizedDoctorCount - 3} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className="mb-4 text-sm text-gray-600">
        <p>
          <span className="font-medium">OTP Required:</span>{' '}
          <span>{token.otpRequired ? '✓ Yes' : '✗ No'}</span>
        </p>
        <p>
          <span className="font-medium">Type:</span>{' '}
          <span>{token.isPermanent ? 'Permanent (reusable)' : 'One-time use'}</span>
        </p>
      </div>

      {/* Copy URL Button */}
      {nfcUrl && token.isActive && (
        <button
          onClick={() => {
            onCopyUrl(nfcUrl);
          }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          📋 Copy NFC URL
        </button>
      )}

      {/* Revoked Badge */}
      {token.revokedAt && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-900">
            <span className="font-medium">Card revoked</span>
            <br />
            <span className="text-xs text-red-700 mt-1 block">
              All future taps are blocked
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

export default EmergencyNfcCard;
