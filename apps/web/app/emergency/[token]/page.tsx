'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Phone, MapPin, Navigation, Hospital, Edit } from 'lucide-react';

interface EmergencyProfile {
  displayName: string;
  age?: number;
  dob?: string;
  bloodGroup: string;
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  emergencyNotes: string;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  insuranceId?: string;
}

interface EmergencyData {
  success: boolean;
  accessTimestamp: string;
  profile: EmergencyProfile;
  token: string;
}

interface ErrorResponse {
  error: string;
  locked?: boolean;
  revoked?: boolean;
}

export default function EmergencyQRPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [data, setData] = useState<EmergencyData | null>(null);
  const [error, setError] = useState<ErrorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationSent, setNotificationSent] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number; lon: number} | null>(null);
  
  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (err) => console.log('Location error:', err),
        { timeout: 5000 }
      );
    }
  }, []);
  
  useEffect(() => {
    if (token && userLocation) {
      fetchEmergencyData();
    } else if (token && !navigator.geolocation) {
      // Fetch without location if geolocation not available
      fetchEmergencyData();
    }
  }, [token, userLocation]);
  
  const fetchEmergencyData = async () => {
    try {
      let url = `/api/emergency/${token}`;
      
      // Add location params if available
      if (userLocation) {
        url += `?lat=${userLocation.lat}&lon=${userLocation.lon}`;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (!response.ok) {
        setError(result);
        setLoading(false);
        return;
      }
      
      setData(result);
      setError(null);
      setLoading(false);
      
      // Send emergency notification automatically
      sendEmergencyNotification(result.token, result.accessTimestamp);
      
    } catch (err) {
      setError({
        error: 'Failed to load emergency data. Please try again.',
        locked: true,
      });
      setLoading(false);
    }
  };
  
  const sendEmergencyNotification = async (token: string, timestamp: string) => {
    try {
      const response = await fetch('/api/emergency/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accessTimestamp: timestamp }),
      });
      
      if (response.ok) {
        setNotificationSent(true);
      }
    } catch (err) {
      console.error('Failed to send notification:', err);
    }
  };
  
  const callEmergencyContact = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };
  
  const callAmbulance = () => {
    // Default emergency number (customize based on region)
    window.location.href = 'tel:911';
  };
  
  const shareLocation = () => {
    if (userLocation && navigator.share) {
      navigator.share({
        title: 'Emergency Location',
        text: `I'm at this location and need help`,
        url: `https://www.google.com/maps?q=${userLocation.lat},${userLocation.lon}`,
      }).catch(err => console.log('Share failed:', err));
    } else if (userLocation) {
      window.open(`https://www.google.com/maps?q=${userLocation.lat},${userLocation.lon}`, '_blank');
    }
  };
  
  const openNearestHospitals = () => {
    if (userLocation) {
      window.open(`https://www.google.com/maps/search/hospitals+near+me/@${userLocation.lat},${userLocation.lon},15z`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/hospitals+near+me`, '_blank');
    }
  };
  
  const editInformation = () => {
    // Redirect to authenticated edit flow
    window.location.href = '/emergency/settings';
  };
  
  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #ddd', 
            borderTopColor: '#dc2626',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 15px'
          }} />
          <p style={{ color: '#666', fontSize: '14px' }}>Loading emergency data...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px'
      }}>
        <div style={{ 
          maxWidth: '400px', 
          width: '100%',
          border: '2px solid #dc2626',
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '48px', 
            color: '#dc2626',
            marginBottom: '16px'
          }}>⚠️</div>
          <h1 style={{ 
            fontSize: '20px', 
            fontWeight: 'bold',
            color: '#111',
            marginBottom: '12px'
          }}>Access Denied</h1>
          <p style={{ 
            fontSize: '14px', 
            color: '#666',
            marginBottom: '16px'
          }}>{error.error}</p>
          {error.revoked && (
            <p style={{ 
              fontSize: '13px', 
              color: '#dc2626',
              backgroundColor: '#fef2f2',
              padding: '12px',
              borderRadius: '6px'
            }}>This QR code has been revoked by the owner.</p>
          )}
        </div>
      </div>
    );
  }
  
  if (!data) {
    return null;
  }
  
  const profile = data.profile;
  
  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#fff',
      fontFamily: 'Arial, sans-serif',
      padding: '0',
      margin: '0'
    }}>
      {/* Emergency Banner */}
      <div style={{ 
        backgroundColor: '#c00',
        color: '#fff',
        padding: '12px',
        textAlign: 'center',
        borderBottom: '2px solid #900'
      }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', margin: '0' }}>
          ⚕ EMERGENCY MEDICAL INFORMATION
        </div>
        <div style={{ fontSize: '11px', margin: '4px 0 0 0' }}>
          {notificationSent ? '✓ Emergency contact notified' : 'Read-only access'}
        </div>
      </div>
      
      {/* Main Content - Plain Text */}
      <div style={{ 
        maxWidth: '700px',
        margin: '0 auto',
        padding: '16px'
      }}>
        
        {/* Patient Info */}
        <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #ddd' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>PATIENT</div>
          <div style={{ fontSize: '15px', color: '#000', lineHeight: '1.6' }}>
            <div><strong>Name:</strong> {profile.displayName}</div>
            {profile.age && <div><strong>Age:</strong> {profile.age} years</div>}
            {profile.dob && <div><strong>DOB:</strong> {profile.dob}</div>}
          </div>
        </div>
        
        {/* Blood Group */}
        <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #ddd' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>BLOOD GROUP</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#c00' }}>
            {profile.bloodGroup}
          </div>
        </div>
        
        {/* Allergies */}
        <div style={{ 
          marginBottom: '20px', 
          padding: '12px',
          backgroundColor: '#fff8dc',
          border: '2px solid #f90'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#000', marginBottom: '6px' }}>
            ⚠ ALLERGIES
          </div>
          {profile.allergies.length > 0 ? (
            <div style={{ fontSize: '14px', color: '#000' }}>
              {profile.allergies.map((allergy, idx) => (
                <div key={idx}>• {allergy}</div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#666' }}>None recorded</div>
          )}
        </div>
        
        {/* Chronic Conditions */}
        {profile.chronicConditions.length > 0 && (
          <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #ddd' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>CONDITIONS</div>
            <div style={{ fontSize: '14px', color: '#000' }}>
              {profile.chronicConditions.map((condition, idx) => (
                <div key={idx}>• {condition}</div>
              ))}
            </div>
          </div>
        )}
        
        {/* Medications */}
        {profile.currentMedications.length > 0 && (
          <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #ddd' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>MEDICATIONS</div>
            <div style={{ fontSize: '14px', color: '#000' }}>
              {profile.currentMedications.map((med, idx) => (
                <div key={idx}>• {med}</div>
              ))}
            </div>
          </div>
        )}
        
        {/* Insurance */}
        {profile.insuranceId && (
          <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #ddd' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>INSURANCE ID</div>
            <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#000' }}>
              {profile.insuranceId}
            </div>
          </div>
        )}
        
        {/* Emergency Contacts */}
        {profile.emergencyContacts.length > 0 && (
          <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #ddd' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>EMERGENCY CONTACT</div>
            {profile.emergencyContacts.map((contact, idx) => (
              <div key={idx} style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#000' }}>{contact.name}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>{contact.relationship}</div>
                <a href={`tel:${contact.phone}`} style={{ 
                  fontSize: '14px', 
                  color: '#00c', 
                  textDecoration: 'underline',
                  display: 'inline-block',
                  marginTop: '2px'
                }}>
                  {contact.phone}
                </a>
              </div>
            ))}
          </div>
        )}
        
        {/* Actions */}
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '2px solid #ddd' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>QUICK ACTIONS</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {profile.emergencyContacts.length > 0 && (
              <button
                onClick={() => callEmergencyContact(profile.emergencyContacts[0].phone)}
                style={{ 
                  backgroundColor: '#007bff',
                  color: '#fff',
                  border: 'none',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                📞 Call Emergency Contact
              </button>
            )}
            
            <button
              onClick={callAmbulance}
              style={{ 
                backgroundColor: '#c00',
                color: '#fff',
                border: 'none',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              🚑 Call Ambulance (911)
            </button>
            
            <button
              onClick={openNearestHospitals}
              style={{ 
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              🏥 Find Nearest Hospital
            </button>
            
            {userLocation && (
              <button
                onClick={shareLocation}
                style={{ 
                  backgroundColor: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                📍 Share Location
              </button>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div style={{ 
          marginTop: '24px',
          paddingTop: '12px',
          borderTop: '1px solid #ddd',
          fontSize: '11px',
          color: '#999',
          textAlign: 'center'
        }}>
          Access logged • Patient notified
        </div>
        
      </div>
    </div>
  );
}