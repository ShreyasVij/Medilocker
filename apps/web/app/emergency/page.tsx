'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EmergencyAccessPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to emergency settings page
    router.push('/emergency/settings');
  }, [router]);
  
  return (
    <div className="container" style={{ maxWidth: 720, padding: '40px 20px' }}>
      <div className="my-4 p-6 border rounded text-center" style={{ background: '#fff' }}>
        <div style={{ 
          width: '48px', 
          height: '48px', 
          border: '3px solid #ddd', 
          borderTopColor: '#dc2626',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 20px'
        }} />
        <h1 className="h5" style={{ color: '#111', marginBottom: '12px' }}>
          Redirecting to Emergency Settings...
        </h1>
        <p className="text-muted small">
          Please wait while we take you to the emergency QR code management page.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

