/**
 * OtpVerificationFlow Component
 * Handles OTP entry and verification for full access
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';

export type OtpFlowState = 'requesting' | 'entering' | 'verifying' | 'success' | 'error' | 'expired';

interface OtpVerificationFlowProps {
  sessionId?: string;
  sentTo?: string;
  expiresInSeconds?: number;
  onVerifyOtp: (otp: string) => Promise<void>;
  onRequestNewOtp: () => Promise<void>;
  state?: OtpFlowState;
  error?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const OtpVerificationFlow: React.FC<OtpVerificationFlowProps> = ({
  sessionId,
  sentTo,
  expiresInSeconds = 600,
  onVerifyOtp,
  onRequestNewOtp,
  state = 'entering',
  error,
  isOpen,
  onClose,
}) => {
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(expiresInSeconds);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [currentError, setCurrentError] = useState(error);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Timer for OTP expiry
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [isOpen]);

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
    setCurrentError(null);

    // Auto-submit when 6 digits entered
    if (value.length === 6) {
      setTimeout(() => handleVerify(value), 200);
    }
  };

  const handleVerify = async (otpValue?: string) => {
    const codeToVerify = otpValue || otp;

    if (codeToVerify.length !== 6) {
      setCurrentError('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    setCurrentError(null);

    try {
      await onVerifyOtp(codeToVerify);
    } catch (err) {
      setCurrentError(err instanceof Error ? err.message : 'Verification failed');
      setAttemptsRemaining((prev) => Math.max(0, prev - 1));
      setOtp('');
      otpInputRef.current?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRequestNewOtp = async () => {
    try {
      setCurrentError(null);
      await onRequestNewOtp();
      setOtp('');
      setTimeRemaining(expiresInSeconds);
      setAttemptsRemaining(3);
      setResendCooldown(60);
      otpInputRef.current?.focus();
    } catch (err) {
      setCurrentError(err instanceof Error ? err.message : 'Failed to request new OTP');
    }
  };

  if (!isOpen) {
    return null;
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isExpired = timeRemaining <= 0;
  const isLocked = attemptsRemaining <= 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">🔐 Verify Access</h2>
          <p className="text-gray-600 mt-2">Enter the 6-digit code sent to your email</p>
        </div>

        {/* Info Box */}
        {sentTo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Code sent to:</span>
              <br />
              {sentTo}
            </p>
          </div>
        )}

        {/* Timer */}
        <div className="mb-6 text-center">
          <div className={`text-4xl font-mono font-bold ${isExpired ? 'text-red-600' : 'text-blue-600'}`}>
            ⏱ {formatTime(timeRemaining)}
          </div>
          <p className={`text-sm mt-2 ${isExpired ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
            {isExpired ? 'Code has expired' : 'Time remaining'}
          </p>
        </div>

        {/* OTP Input */}
        <div className="mb-6">
          <label htmlFor="otp-input" className="block text-sm font-medium text-gray-700 mb-2">
            6-Digit Code
          </label>
          <input
            ref={otpInputRef}
            id="otp-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={handleOtpChange}
            disabled={isVerifying || isExpired || isLocked}
            placeholder="000000"
            className="w-full px-4 py-3 text-center text-3xl font-mono border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
          />
          <p className="text-xs text-gray-500 mt-2 text-center">
            Type or paste the code • Auto-submits at 6 digits
          </p>
        </div>

        {/* Error Messages */}
        {currentError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium">❌ {currentError}</p>
            {attemptsRemaining > 0 && (
              <p className="text-xs text-red-700 mt-2">
                Attempts remaining: {attemptsRemaining}
              </p>
            )}
          </div>
        )}

        {/* Status Messages */}
        {isExpired && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800 font-medium">⏰ Code Expired</p>
            <p className="text-xs text-orange-700 mt-1">Request a new code to continue</p>
          </div>
        )}

        {isLocked && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium">🔒 Too Many Attempts</p>
            <p className="text-xs text-red-700 mt-1">Request a new code to try again</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleVerify()}
            disabled={isVerifying || otp.length !== 6 || isExpired || isLocked}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? '⏳ Verifying...' : '✓ Verify Code'}
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isVerifying}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Close
            </button>

            {(isExpired || isLocked) && (
              <button
                onClick={handleRequestNewOtp}
                disabled={resendCooldown > 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Wait ${resendCooldown}s` : '📧 Send New Code'}
              </button>
            )}
          </div>
        </div>

        {/* Help Text */}
        <div className="border-t border-gray-200 pt-4">
          <details className="text-sm text-gray-600">
            <summary className="cursor-pointer font-medium hover:text-gray-900">
              Didn't receive the code?
            </summary>
            <div className="mt-3 space-y-2 text-xs">
              <p>• Check your spam/junk folder</p>
              <p>• Make sure the email address is correct</p>
              <p>• Request a new code if it has expired</p>
              <p>• Contact support if problems persist</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default OtpVerificationFlow;
