/**
 * CreateNfcTokenModal Component
 * Modal for creating new NFC emergency tokens
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface CreateNfcTokenModalProps {
  profileId: string;
  onSuccess: (token: any) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const CreateNfcTokenModal: React.FC<CreateNfcTokenModalProps> = ({
  profileId,
  onSuccess,
  onClose,
  isOpen,
}) => {
  const { data: session } = useSession();
  const [deviceName, setDeviceName] = useState('');
  const [otpRequired, setOtpRequired] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setDeviceName('');
      setOtpRequired(true);
      setIsLoading(false);
      setError(null);
      setCreatedToken(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    setDeviceName('');
    setOtpRequired(true);
    setIsLoading(false);
    setError(null);
    setCreatedToken(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!deviceName.trim()) {
      setError('Please enter a device name');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/emergency/nfc/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId,
          deviceName,
          isPermanent: true,
          otpRequiredForFullAccess: otpRequired,
          otpExpiryMinutes: 10,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create token');
      }

      const data = await response.json();
      setCreatedToken(data);
      onSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  // Success state - show generated token
  if (createdToken) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="Close NFC token info"
          >
            ×
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">✅ NFC Token Created!</h2>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800 mb-4">
              Your NFC card has been created successfully. Now you need to write the URL to your physical NFC card or sticker.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Device Name</label>
                <p className="text-sm font-medium text-gray-900 bg-white p-2 rounded border border-gray-200">
                  {createdToken.deviceName}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">NFC URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={createdToken.nfcUrl}
                    readOnly
                    className="flex-1 text-xs bg-gray-50 p-2 rounded border border-gray-200 font-mono"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdToken.nfcUrl);
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {createdToken.qrCode && (
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">QR Code</label>
                  <img
                    src={createdToken.qrCode}
                    alt="NFC Token QR Code"
                    className="w-32 h-32 mx-auto border border-gray-200 p-2 rounded"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-blue-900 mb-2">📖 How to write to NFC card:</h3>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              {createdToken.instructions?.steps?.map((step: string, idx: number) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                handleClose();
              }}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form state
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          aria-label="Close NFC token creator"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Create NFC Emergency Card</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700 mb-1">
              Device Name
            </label>
            <input
              id="deviceName"
              type="text"
              placeholder="e.g., Wallet Card, Phone Sticker"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Choose a friendly name to identify this physical card
            </p>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={otpRequired}
                onChange={(e) => setOtpRequired(e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">
                Require OTP for full access
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              ✓ Recommended: Requires patient confirmation before sharing full medical records
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {isLoading ? '⏳ Creating...' : '✓ Create Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateNfcTokenModal;
