/**
 * Emergency NFC Dashboard Page
 * Manages NFC emergency access tokens
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import EmergencyNfcCard from '@/components/emergency/EmergencyNfcCard';
import CreateNfcTokenModal from '@/components/emergency/CreateNfcTokenModal';
import NfcAccessLogsPanel from '@/components/emergency/NfcAccessLogsPanel';

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
  preAuthorizedDoctors: any[];
  suspiciousActivityCount: number;
  recentActivity: any;
}

interface Profile {
  id: string;
  displayName: string;
  type: 'self' | 'dependent';
}

export default function EmergencyNfcPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<NfcToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogsPanel, setShowLogsPanel] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Fetch profiles
  useEffect(() => {
    if (session?.user?.email) {
      fetchProfiles();
    }
  }, [session]);

  // Fetch tokens when profile changes
  useEffect(() => {
    if (selectedProfileId) {
      fetchTokens();
    }
  }, [selectedProfileId]);

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/profiles');
      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles || []);
        if (data.profiles?.length > 0) {
          setSelectedProfileId(data.profiles[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
  };

  const fetchTokens = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/emergency/nfc/tokens?profileId=${selectedProfileId}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch tokens');
      }

      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    try {
      const response = await fetch('/api/emergency/nfc/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId, reason: 'Revoked by user' }),
      });

      if (!response.ok) {
        throw new Error('Failed to revoke token');
      }

      // Refresh tokens
      await fetchTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke token');
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    // Toast notification would go here
  };

  const handleViewLogs = (tokenId: string) => {
    setSelectedTokenId(tokenId);
    setShowLogsPanel(true);
  };

  const handleAuthorizeDoctor = (tokenId: string) => {
    // TODO: Open doctor authorization modal
    console.log('Open doctor authorization modal for:', tokenId);
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🚨 Emergency NFC Access</h1>
              <p className="text-gray-600 mt-2">
                Create and manage NFC cards for emergency medical access
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              + Create NFC Card
            </button>
          </div>

          {/* Tabs Navigation */}
          <div className="flex gap-4 border-b border-gray-200">
            <Link
              href="/app/emergency/settings"
              className="px-4 py-3 font-semibold text-gray-600 hover:text-gray-900 transition"
            >
              🔲 QR Code
            </Link>
            <button className="px-4 py-3 font-semibold text-blue-600 border-b-2 border-blue-600">
              📱 NFC Card
            </button>
          </div>
        </div>

        {/* Profile Selector */}
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Profile
          </label>
          <select
            value={selectedProfileId || ''}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName} {profile.type === 'dependent' ? '(Dependent)' : '(Self)'}
              </option>
            ))}
          </select>
        </div>

        {/* Info Box */}
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">📲 How It Works</h2>
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>Create an NFC emergency card and get a secure URL</li>
            <li>Write the URL to your physical NFC card/sticker using an NFC writer app</li>
            <li>In an emergency, tap the card with any smartphone</li>
            <li>The card displays your public emergency info (blood type, allergies, conditions)</li>
            <li>For full records, doctors can request OTP verification</li>
            <li>You control access with pre-authorized doctors and OTP settings</li>
          </ol>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Tokens Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading cards...</p>
          </div>
        ) : tokens.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No NFC cards created yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Card
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tokens.map((token) => (
              <EmergencyNfcCard
                key={token.tokenId}
                token={token}
                onRevoke={handleRevokeToken}
                onCopyUrl={handleCopyUrl}
                onViewLogs={handleViewLogs}
                onAuthorizDoctor={handleAuthorizeDoctor}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateNfcTokenModal
        profileId={selectedProfileId || ''}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchTokens();
        }}
      />

      <NfcAccessLogsPanel
        profileId={selectedProfileId || ''}
        isOpen={showLogsPanel}
        onClose={() => setShowLogsPanel(false)}
      />
    </div>
  );
}
