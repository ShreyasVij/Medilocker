/**
 * Public Emergency Profile Page
 * Location: /emergency/public/nfc/[token]
 * No authentication required - accessible from NFC tap
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import EmergencyProfilePublic from '@/components/emergency/EmergencyProfilePublic';
import OtpVerificationFlow from '@/components/emergency/OtpVerificationFlow';

interface OtpSessionResponse {
  success: boolean;
  sessionId: string;
  otpSent: boolean;
  sentTo: string;
  otpExpiresIn: number;
  otpExpiresAt: string;
}

export default function PublicEmergencyProfilePage() {
  const params = useParams();
  const token = params.token as string;

  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpSession, setOtpSession] = useState<OtpSessionResponse | null>(null);
  const [requestingOtp, setRequestingOtp] = useState(false);

  // Fetch public profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/emergency/nfc/${token}`);

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 410) {
            throw new Error('This card has been revoked');
          }
          throw new Error(data.error || `Error: ${response.status}`);
        }

        const data = await response.json();
        setProfile(data.emergencyProfile);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchProfile();
    }
  }, [token]);

  const handleRequestFullAccess = async () => {
    if (!showOtpModal) {
      setShowOtpModal(true);
      setRequestingOtp(true);

      try {
        const response = await fetch('/api/emergency/nfc/request-full-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            requestMessage: 'Emergency access request from tap',
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to request OTP');
        }

        const data: OtpSessionResponse = await response.json();
        setOtpSession(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to request OTP');
        setShowOtpModal(false);
      } finally {
        setRequestingOtp(false);
      }
      return;
    }
  };

  const handleVerifyOtp = async (otp: string) => {
    if (!otpSession) {
      throw new Error('No OTP session');
    }

    try {
      const response = await fetch('/api/emergency/nfc/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: otpSession.sessionId,
          otp,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification failed');
      }

      const data = await response.json();

      // Store access token for full profile retrieval
      sessionStorage.setItem('nfc_access_token', data.accessToken);

      // Redirect to full profile
      window.location.href = `/emergency/public/nfc/${token}/full?accessToken=${data.accessToken}`;
    } catch (err) {
      throw err;
    }
  };

  const handleRequestNewOtp = async () => {
    setRequestingOtp(true);

    try {
      const response = await fetch('/api/emergency/nfc/request-full-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          requestMessage: 'Emergency access request from tap - resend',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to request OTP');
      }

      const data: OtpSessionResponse = await response.json();
      setOtpSession(data);
    } catch (err) {
      throw err;
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/emergency/public/nfc/${token}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Emergency Medical Profile',
          text: 'Access my emergency medical information',
          url: shareUrl,
        });
      } catch (err) {
        if (err instanceof Error && err.message !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard');
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-spin">🔄</div>
          <p className="text-gray-600 text-lg">Loading emergency profile...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-6 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error || 'Card not found'}</p>

          {error?.includes('revoked') && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
              <p className="text-sm text-yellow-800">
                This emergency card has been disabled by the patient.
              </p>
            </div>
          )}

          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Success State - Display Profile
  return (
    <>
      <EmergencyProfilePublic
        profile={profile}
        onRequestFullAccess={handleRequestFullAccess}
        onShare={handleShare}
        isLoading={requestingOtp}
      />

      {/* OTP Verification Modal */}
      {showOtpModal && otpSession && (
        <OtpVerificationFlow
          sessionId={otpSession.sessionId}
          sentTo={otpSession.sentTo}
          expiresInSeconds={otpSession.otpExpiresIn}
          onVerifyOtp={handleVerifyOtp}
          onRequestNewOtp={handleRequestNewOtp}
          isOpen={showOtpModal}
          onClose={() => setShowOtpModal(false)}
        />
      )}
    </>
  );
}
