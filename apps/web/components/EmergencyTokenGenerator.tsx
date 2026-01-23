'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, QrCode, Copy, Check, AlertTriangle, Clock, X, RefreshCw } from 'lucide-react';

interface EmergencyTokenGeneratorProps {
  profileId: string;
}

interface ActiveToken {
  id: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  revoked: boolean;
}

interface TokenResponse {
  success: boolean;
  token: string;
  tokenId: string;
  qrCode: string;
  url: string;
  expiresAt: string;
  ttlMinutes: number;
  warning: string;
}

export default function EmergencyTokenGenerator({ profileId }: EmergencyTokenGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<TokenResponse | null>(null);
  const [activeTokens, setActiveTokens] = useState<ActiveToken[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  
  const fetchActiveTokens = async () => {
    try {
      const response = await fetch(`/api/emergency/token?profileId=${profileId}`);
      const data = await response.json();
      
      if (data.success) {
        setActiveTokens(data.tokens);
      }
    } catch (err) {
      console.error('Failed to fetch active tokens:', err);
    }
  };
  
  useEffect(() => {
    fetchActiveTokens();
  }, [profileId]);
  
  // Update countdown timer
  useEffect(() => {
    if (!generatedToken) return;
    
    const expiresAt = new Date(generatedToken.expiresAt).getTime();
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeRemaining(remaining);
      
      if (remaining === 0) {
        setGeneratedToken(null);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [generatedToken]);
  
  const generateToken = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/emergency/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, ttlMinutes: 10 }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate token');
      }
      
      setGeneratedToken(data);
      await fetchActiveTokens();
      
    } catch (err: any) {
      setError(err.message || 'Failed to generate emergency token');
    } finally {
      setLoading(false);
    }
  };
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  const revokeToken = async (token?: string) => {
    try {
      const response = await fetch('/api/emergency/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          token,
          revokeAll: !token,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (!token) {
          setGeneratedToken(null);
        }
        await fetchActiveTokens();
      }
    } catch (err) {
      console.error('Failed to revoke token:', err);
    }
  };
  
  const extendAccess = async () => {
    // Generate a new token (extension)
    await generateToken();
  };
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-600" />
            Emergency Access
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Generate a secure, single-use token for emergency medical access
          </p>
        </div>
        
        <button
          onClick={generateToken}
          disabled={loading || !!generatedToken}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-2 font-semibold"
        >
          <ShieldAlert className="h-5 w-5" />
          {loading ? 'Generating...' : 'Generate Token'}
        </button>
      </div>
      
      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      
      {/* Generated Token Display */}
      {generatedToken && (
        <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-500 rounded-lg p-6 shadow-lg">
          
          {/* Timer */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-red-200">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-600" />
              <span className="font-semibold text-gray-900">Time Remaining:</span>
            </div>
            <span className="text-2xl font-mono font-bold text-red-600">
              {formatTime(timeRemaining)}
            </span>
          </div>
          
          {/* Warning */}
          <div className="bg-red-600 text-white rounded-lg p-4 mb-4">
            <p className="font-semibold mb-2">⚠️ SECURITY WARNING</p>
            <p className="text-sm">{generatedToken.warning}</p>
          </div>
          
          {/* QR Code */}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-shrink-0">
              <div className="bg-white p-4 rounded-lg shadow-md border-2 border-gray-200">
                <img
                  src={generatedToken.qrCode}
                  alt="Emergency Access QR Code"
                  className="w-48 h-48"
                />
                <p className="text-xs text-gray-600 text-center mt-2">Scan to access</p>
              </div>
            </div>
            
            <div className="flex-1 space-y-4">
              
              {/* URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Emergency Access URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedToken.url}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm font-mono"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedToken.url)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span className="text-sm">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Token (optional, for manual entry) */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Token (for manual entry)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedToken.token}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-xs font-mono"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedToken.token)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => revokeToken(generatedToken.token)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Revoke Now
                </button>
                <button
                  onClick={extendAccess}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Extend (New Token)
                </button>
              </div>
              
            </div>
          </div>
          
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-900">
              <strong>Note:</strong> Extending access generates a new token and invalidates this one.
              The new token will have a fresh 10-minute timer.
            </p>
          </div>
        </div>
      )}
      
      {/* Active Tokens List */}
      {activeTokens.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Active Emergency Tokens</h3>
            {activeTokens.length > 0 && (
              <button
                onClick={() => revokeToken()}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm font-semibold"
              >
                Revoke All
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {activeTokens.map((token) => {
              const expiresAt = new Date(token.expiresAt);
              const now = new Date();
              const isExpired = now > expiresAt;
              const timeLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
              
              return (
                <div
                  key={token.id}
                  className={`border rounded-lg p-4 ${
                    isExpired || token.revoked || token.used
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Created {new Date(token.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-600">
                        {isExpired ? (
                          <span className="text-red-600">Expired</span>
                        ) : token.revoked ? (
                          <span className="text-orange-600">Revoked</span>
                        ) : token.used ? (
                          <span className="text-blue-600">Used</span>
                        ) : (
                          <span className="text-green-600">
                            Active • {formatTime(timeLeft)} remaining
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How Emergency Access Works</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Tokens are single-use and expire after 10 minutes</li>
          <li>• Only minimal critical information is exposed (no files or history)</li>
          <li>• All access is logged and monitored for security</li>
          <li>• You can revoke access at any time instantly</li>
          <li>• Share the QR code or link only with trusted emergency contacts</li>
        </ul>
      </div>
      
    </div>
  );
}
