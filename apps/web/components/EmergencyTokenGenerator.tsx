'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, QrCode, Copy, Check, AlertTriangle, RefreshCw, Printer, Download } from 'lucide-react';

interface EmergencyTokenGeneratorProps {
  profileId: string;
}

interface ActiveToken {
  id: string;
  createdAt: string;
  revoked: boolean;
  accessCount: number;
  lastAccessedAt?: string;
}

interface TokenResponse {
  success: boolean;
  token: string;
  tokenId: string;
  qrCode: string;
  url: string;
  isPermanent: boolean;
  regenerated: boolean;
  warning: string;
}

export default function EmergencyTokenGenerator({ profileId }: EmergencyTokenGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<TokenResponse | null>(null);
  const [activeTokens, setActiveTokens] = useState<ActiveToken[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
  
  const generateToken = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/emergency/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
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
  
  const regenerateQR = async () => {
    if (!generatedToken) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/emergency/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          profileId, 
          regenerate: true,
          oldToken: generatedToken.token
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate token');
      }
      
      setGeneratedToken(data);
      await fetchActiveTokens();
      
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate emergency token');
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
  
  const revokeToken = async (revokeAll: boolean = false) => {
    try {
      const response = await fetch('/api/emergency/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          revokeAll,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (revokeAll) {
          setGeneratedToken(null);
        }
        await fetchActiveTokens();
      }
    } catch (err) {
      console.error('Failed to revoke token:', err);
    }
  };
  
  const printQR = async () => {
    if (!generatedToken) return;
    
    // Mark token as printed
    try {
      await fetch('/api/emergency/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: generatedToken.token }),
      });
    } catch (err) {
      console.error('Failed to mark as printed:', err);
    }
    
    // Create printable page
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Emergency Medical QR Code</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 40px;
              margin: 0;
            }
            .card {
              border: 3px solid #dc2626;
              border-radius: 16px;
              padding: 32px;
              text-align: center;
              max-width: 400px;
              background: white;
            }
            h1 {
              color: #dc2626;
              font-size: 24px;
              margin: 0 0 16px 0;
              font-weight: bold;
            }
            .qr {
              margin: 20px 0;
            }
            .qr img {
              width: 300px;
              height: 300px;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              padding: 12px;
            }
            .instructions {
              font-size: 14px;
              color: #374151;
              margin: 16px 0;
              line-height: 1.6;
            }
            .emergency {
              background: #fef3c7;
              border: 2px solid #f59e0b;
              border-radius: 8px;
              padding: 12px;
              margin-top: 20px;
              font-size: 13px;
              color: #78350f;
              font-weight: 600;
            }
            @media print {
              body { padding: 0; }
              .card { border: 3px solid #dc2626; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>⚕️ EMERGENCY MEDICAL QR</h1>
            <div class="qr">
              <img src="${generatedToken.qrCode}" alt="Emergency QR Code" />
            </div>
            <div class="instructions">
              <strong>In case of emergency, scan this QR code</strong><br/>
              to access critical medical information
            </div>
            <div class="emergency">
              ⚠️ KEEP IN WALLET OR WEAR AS BRACELET
            </div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
  
  const downloadQR = () => {
    if (!generatedToken) return;
    
    const link = document.createElement('a');
    link.href = generatedToken.qrCode;
    link.download = 'emergency-medical-qr.png';
    link.click();
  };
  
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2 leading-tight">
            <ShieldAlert className="h-6 w-6 text-red-600" />
            Emergency QR Code
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Generate a permanent, reusable QR code for emergency medical access
          </p>
        </div>
        
        {!generatedToken && (
          <button
            onClick={generateToken}
            disabled={loading}
            className="w-full md:w-auto px-5 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 font-semibold"
          >
            <QrCode className="h-5 w-5" />
            {loading ? 'Generating...' : 'Generate QR Code'}
          </button>
        )}
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
        <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-500 rounded-lg p-4 sm:p-6 shadow-lg">
          
          {/* Warning */}
          <div className="bg-red-600 text-white rounded-lg p-4 mb-6">
            <p className="font-semibold mb-2">⚠️ PERMANENT QR CODE</p>
            <p className="text-sm">{generatedToken.warning}</p>
          </div>
          
          {/* QR Code and Actions */}
          <div className="flex flex-col md:flex-row gap-5 md:gap-6 items-stretch">
            <div className="flex-shrink-0 flex justify-center md:justify-start">
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border-2 border-gray-200 w-full max-w-[320px]">
                <img
                  src={generatedToken.qrCode}
                  alt="Emergency Access QR Code"
                  className="w-56 h-56 sm:w-64 sm:h-64 mx-auto"
                />
                <p className="text-xs text-gray-600 text-center mt-3 font-semibold">
                  SCAN FOR EMERGENCY ACCESS
                </p>
              </div>
            </div>
            
            <div className="flex-1 space-y-4 min-w-0">
              
              {/* URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Emergency Access URL
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={generatedToken.url}
                    readOnly
                    className="w-full min-w-0 px-4 py-2 border border-gray-300 rounded-lg bg-white text-xs sm:text-sm font-mono"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedToken.url)}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center justify-center gap-2"
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
              
              {/* Print & Download Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={printQR}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 font-semibold w-full"
                >
                  <Printer className="h-5 w-5" />
                  Print QR
                </button>
                <button
                  onClick={downloadQR}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 font-semibold w-full"
                >
                  <Download className="h-5 w-5" />
                  Download
                </button>
              </div>
              
              {/* Regenerate & Revoke */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={regenerateQR}
                  disabled={loading}
                  className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 transition flex items-center justify-center gap-2 font-semibold w-full"
                >
                  <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
                <button
                  onClick={() => revokeToken(true)}
                  className="px-4 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800 transition flex items-center justify-center gap-2 font-semibold w-full"
                >
                  Revoke QR
                </button>
              </div>
              
            </div>
          </div>
          
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-900">
              <strong>💡 Important:</strong> This QR code is long-lived and reusable. 
              Print it for wallet cards, medical bracelets, or emergency contacts. 
              Click "Regenerate" to revoke the old QR and create a new one.
            </p>
          </div>
        </div>
      )}
      
      {/* Active Tokens List */}
      {activeTokens.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Active Emergency QR Codes</h3>
          </div>
          
          <div className="space-y-3">
            {activeTokens.map((token) => {
              return (
                <div
                  key={token.id}
                  className={`border rounded-lg p-4 ${
                    token.revoked
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Created {new Date(token.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {token.revoked ? (
                          <span className="text-orange-600 font-semibold">Revoked</span>
                        ) : (
                          <>
                            <span className="text-green-600 font-semibold">Active</span>
                            {' • '}
                            <span>Accessed {token.accessCount} times</span>
                            {token.lastAccessedAt && (
                              <span> • Last: {new Date(token.lastAccessedAt).toLocaleString()}</span>
                            )}
                          </>
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
        <h4 className="font-semibold text-blue-900 mb-2">How Emergency QR Works</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ QR codes are permanent and reusable (not time-limited)</li>
          <li>✓ Every scan is logged with timestamp and location</li>
          <li>✓ You'll be notified when someone scans your QR</li>
          <li>✓ Your emergency contact receives an automatic notification</li>
          <li>✓ Only critical medical info is shown (no documents or history)</li>
          <li>✓ Regenerate anytime to revoke old QR and create a new one</li>
          <li>✓ Print for wallet cards, medical bracelets, or emergency folders</li>
        </ul>
      </div>
      
    </div>
  );
}
