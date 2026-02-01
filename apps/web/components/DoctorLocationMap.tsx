'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getUserGPSLocation } from '@/services/hospitalService';
import { Copy, MapPin, AlertCircle, Loader } from 'lucide-react';

// Google Maps types declaration
declare global {
  interface Window {
    google: typeof google;
  }
}

interface Doctor {
  id: string;
  name: string;
  doctorCode: string;
  specialization: string;
  profileImageUrl?: string;
  location: {
    hos?: string;
    city?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface SelectedDoctor {
  id: string;
  name: string;
  specialization: string;
  doctorCode: string;
  distance?: number;
  location: {
    hos?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

interface DoctorLocationMapProps {
  radiusKm?: number;
  onDoctorSelect?: (doctor: SelectedDoctor) => void;
}

const isGoogleMapsLoaded = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof window.google !== 'undefined' && 
         typeof window.google.maps !== 'undefined';
};

/**
 * Doctor Location Map Component
 * Shows only verified doctors from the database with distance calculation
 */
const DoctorLocationMap: React.FC<DoctorLocationMapProps> = ({
  radiusKm = 10,
  onDoctorSelect,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [displayedDoctors, setDisplayedDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const doctorCoordinatesRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Copy doctor code to clipboard
  const copyDoctorCode = async (doctorCode: string) => {
    try {
      await navigator.clipboard.writeText(doctorCode);
      setCopiedCode(doctorCode);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy doctor code');
    }
  };

  // Add doctor markers to map
  const addDoctorMarkers = (doctors: Doctor[], map: google.maps.Map, userLat: number, userLng: number) => {
    if (!map || !isGoogleMapsLoaded()) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    doctors.forEach((doctor) => {
      const coords = doctorCoordinatesRef.current.get(doctor.id);
      if (!coords) return;

      // Calculate distance from user to doctor
      const distance = calculateDistance(userLat, userLng, coords.lat, coords.lng);

      // Only show doctors within radius
      if (distance > radiusKm) return;

      // Green location pin marker for doctors (similar to Google Maps)
      const marker = new google.maps.Marker({
        position: coords,
        map: map,
        title: doctor.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#10b981', // Green for our doctors
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });

      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.close();
        }

        const locationStr = [doctor.location.hos, doctor.location.city, doctor.location.state, doctor.location.country]
          .filter(Boolean)
          .join(', ');

        const profileImageHtml = doctor.profileImageUrl 
          ? `<img src="${doctor.profileImageUrl}" alt="${doctor.name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #10b981; margin-right: 10px; flex-shrink: 0;" />`
          : `<div style="width: 40px; height: 40px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; margin-right: 10px; flex-shrink: 0; border: 2px solid #10b981;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>`;

        const content = `
          <div style="max-width: 320px; padding: 14px; font-family: Arial, sans-serif; color: #1f2937;">
            <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
              ${profileImageHtml}
              <div style="flex: 1;">
                <h3 style="margin: 0; font-size: 15px; font-weight: bold; color: #059669;">Dr. ${doctor.name}</h3>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">${doctor.specialization}</p>
              </div>
            </div>
            
            <div style="margin: 12px 0; padding: 10px; background-color: #f0fdf4; border-left: 3px solid #10b981; border-radius: 4px;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #6b7280; font-weight: 600;">📍 Location & Distance</p>
              <p style="margin: 0; font-size: 12px; color: #374151; line-height: 1.4;">${locationStr}</p>
              <p style="margin: 6px 0 0 0; font-size: 13px; font-weight: bold; color: #059669;">${distance.toFixed(2)} km away</p>
            </div>

            <div style="
              background-color: #f3f4f6;
              padding: 10px;
              border-radius: 6px;
              margin: 10px 0;
              border-left: 3px solid #10b981;
            ">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #6b7280; font-weight: 600;">Doctor Code</p>
              <div style="
                display: flex;
                align-items: center;
                gap: 8px;
                background-color: white;
                padding: 8px;
                border-radius: 4px;
                border: 1px solid #d1d5db;
              ">
                <code style="
                  flex: 1;
                  font-family: 'Courier New', monospace;
                  font-size: 12px;
                  font-weight: 700;
                  color: #059669;
                  word-break: break-all;
                ">${doctor.doctorCode}</code>
                <button 
                  id="copy-doc-${doctor.id}" 
                  data-code="${doctor.doctorCode}"
                  style="
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 4px;
                    color: #10b981;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: opacity 0.2s;
                  " 
                  onmouseover="this.style.opacity='0.7'" 
                  onmouseout="this.style.opacity='1'"
                  title="Copy doctor code"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div style="margin: 8px 0 0 0; font-size: 10px; color: #9ca3af; display: flex; align-items: center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" style="margin-right: 4px;">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              Verified doctor from our platform
            </div>
          </div>
        `;

        infoWindowRef.current = new google.maps.InfoWindow({ content });
        infoWindowRef.current.open(map, marker);

        // Add click listener to copy button after info window renders
        google.maps.event.addListener(infoWindowRef.current, 'domready', () => {
          const copyBtn = document.getElementById(`copy-doc-${doctor.id}`);
          if (copyBtn) {
            copyBtn.addEventListener('click', async (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              const code = copyBtn.getAttribute('data-code');
              if (!code) return;

              try {
                await navigator.clipboard.writeText(code);
                
                // Visual feedback - change to checkmark
                copyBtn.innerHTML = `
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                `;
                copyBtn.style.color = '#059669';
                
                // Reset after 2 seconds
                setTimeout(() => {
                  copyBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  `;
                  copyBtn.style.color = '#10b981';
                }, 2000);
              } catch (err) {
                console.error('Failed to copy:', err);
                alert('Failed to copy code. Please try again.');
              }
            });
          }
        });

        // Notify parent component of selection with distance
        if (onDoctorSelect) {
          onDoctorSelect({
            id: doctor.id,
            name: doctor.name,
            specialization: doctor.specialization,
            doctorCode: doctor.doctorCode,
            distance,
            location: doctor.location,
          });
        }

        markersRef.current.push(marker);
      });

      markersRef.current.push(marker);
    });
  };

  // GPS-FIRST: Initialize map with user location
  useEffect(() => {
    if (!mapRef.current) return;

    const initializeMapWithGPS = async () => {
      setLoading(true);
      setError(null);

      // STEP 1: Get user's GPS location FIRST
      const location = await getUserGPSLocation();

      if (!location) {
        setError('Unable to access your location. Please enable GPS/location services and refresh the page.');
        setLoading(false);
        return;
      }

      setUserLocation(location);

      // Wait for Google Maps to load
      if (!isGoogleMapsLoaded()) {
        const checkInterval = setInterval(() => {
          if (isGoogleMapsLoaded()) {
            clearInterval(checkInterval);
            createMapAndLoadDoctors(location);
          }
        }, 200);

        setTimeout(() => {
          clearInterval(checkInterval);
          if (!isGoogleMapsLoaded()) {
            setError('Google Maps failed to load. Please check your internet connection.');
            setLoading(false);
          }
        }, 15000);
      } else {
        createMapAndLoadDoctors(location);
      }
    };

    const createMapAndLoadDoctors = async (location: UserLocation) => {
      if (mapInstanceRef.current || !mapRef.current) return;

      try {
        // STEP 2: Create map centered on user's location
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: location.latitude, lng: location.longitude },
          zoom: 13,
          mapTypeControl: true,
          fullscreenControl: true,
          streetViewControl: true,
        });

        mapInstanceRef.current = map;

        // Add user location marker (blue dot)
        userMarkerRef.current = new google.maps.Marker({
          position: { lat: location.latitude, lng: location.longitude },
          map: map,
          title: 'Your Location',
          icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          animation: google.maps.Animation.DROP,
        });

        // STEP 3: Fetch doctors from our database
        let doctorsData: Doctor[] = [];
        try {
          const doctorsRes = await fetch('/api/doctors/with-locations');
          if (doctorsRes.ok) {
            const data = await doctorsRes.json();
            doctorsData = data.doctors || [];
            setDisplayedDoctors(doctorsData);
            console.log(`[DoctorLocationMap] Loaded ${doctorsData.length} doctors`);

            // Geocode doctor locations
            if (doctorsData.length > 0 && isGoogleMapsLoaded()) {
              const geocoder = new google.maps.Geocoder();
              let geocodedCount = 0;

              doctorsData.forEach((doctor) => {
                // If doctor already has coordinates, use them directly
                if (doctor.location.latitude && doctor.location.longitude) {
                  doctorCoordinatesRef.current.set(doctor.id, {
                    lat: doctor.location.latitude,
                    lng: doctor.location.longitude,
                  });
                  geocodedCount++;

                  // All doctors processed, add markers
                  if (geocodedCount === doctorsData.length) {
                    addDoctorMarkers(doctorsData, map, location.latitude, location.longitude);
                  }
                  return;
                }

                // Otherwise, geocode the address
                const addressParts = [
                  doctor.location.hos,
                  doctor.location.city,
                  doctor.location.state,
                  doctor.location.country,
                ].filter(Boolean);

                const address = addressParts.join(', ');

                geocoder.geocode({ address }, (results, status) => {
                  geocodedCount++;

                  if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
                    const { lat, lng } = results[0].geometry.location;
                    doctorCoordinatesRef.current.set(doctor.id, {
                      lat: lat(),
                      lng: lng(),
                    });
                  }

                  // All doctors geocoded, add markers
                  if (geocodedCount === doctorsData.length) {
                    addDoctorMarkers(doctorsData, map, location.latitude, location.longitude);
                  }
                });
              });
            }
          }
        } catch (err) {
          console.warn('[DoctorLocationMap] Failed to load doctors:', err);
          setError('Failed to load doctors. Please try again.');
        }

        setLoading(false);
      } catch (err) {
        setError('Failed to load map. ' + (err instanceof Error ? err.message : ''));
        setLoading(false);
      }
    };

    initializeMapWithGPS();
  }, [radiusKm]);

  // Error state
  if (error) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center p-6 max-w-md">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Map</h3>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative" style={{ minHeight: '400px' }}>
      {/* Map Container */}
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg" 
        style={{ minHeight: '400px' }} 
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <Loader size={48} className="text-blue-600 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600 text-base font-medium">Getting your location...</p>
            <p className="text-gray-400 text-sm mt-2">Loading nearby doctors...</p>
          </div>
        </div>
      )}

      {/* Doctors List Sidebar */}
      {!loading && displayedDoctors.length > 0 && userLocation && (
        <div className="absolute bottom-0 left-0 w-80 bg-white shadow-lg rounded-t-lg max-h-80 overflow-y-auto z-10">
          <div className="p-3 border-b bg-gradient-to-r from-green-50 to-green-100 sticky top-0">
            <h3 className="text-sm font-bold text-green-900">
              Verified Doctors
            </h3>
            <p className="text-xs text-green-600">{displayedDoctors.length} doctors available</p>
          </div>

          <div className="divide-y">
            {displayedDoctors.map((doctor) => {
              const coords = doctorCoordinatesRef.current.get(doctor.id);
              let distance: number | undefined = undefined;

              // Calculate distance if we have coordinates
              if (coords && userLocation) {
                distance = calculateDistance(userLocation.latitude, userLocation.longitude, coords.lat, coords.lng);
              }
              // If no coordinates yet but doctor has lat/lng in profile, use those
              else if (doctor.location.latitude && doctor.location.longitude && userLocation) {
                distance = calculateDistance(userLocation.latitude, userLocation.longitude, doctor.location.latitude, doctor.location.longitude);
              }

              // Skip if outside radius
              if (distance && distance > radiusKm) return null;

              return (
                <div
                  key={doctor.id}
                  className="p-3 border-b hover:bg-green-50 transition"
                >
                  <div 
                    className="cursor-pointer"
                    onClick={() => {
                      if (coords && mapInstanceRef.current) {
                        mapInstanceRef.current.setCenter(coords);
                        mapInstanceRef.current.setZoom(16);
                      }
                    }}
                  >
                    <p className="font-semibold text-gray-900 text-sm">Dr. {doctor.name}</p>
                    <p className="text-gray-500 text-xs mt-1">{doctor.specialization}</p>
                    <p className="text-gray-500 text-xs mt-1 line-clamp-1">
                      {[doctor.location.hos, doctor.location.city]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    <div className="flex gap-2 mt-2 items-center">
                      {distance ? (
                        <span className="text-green-600 font-bold text-sm">
                          📍 {distance.toFixed(1)} km
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          📍 Calculating distance...
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyDoctorCode(doctor.doctorCode);
                      }}
                      className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition flex items-center justify-center gap-1 ${
                        copiedCode === doctor.doctorCode
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-600 text-white hover:bg-gray-700'
                      }`}
                    >
                      <Copy size={14} />
                      {copiedCode === doctor.doctorCode ? 'Copied!' : 'Code'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDoctorSelect && coords && userLocation) {
                          const distance = calculateDistance(userLocation.latitude, userLocation.longitude, coords.lat, coords.lng);
                          onDoctorSelect({
                            id: doctor.id,
                            name: doctor.name,
                            specialization: doctor.specialization,
                            doctorCode: doctor.doctorCode,
                            distance,
                            location: doctor.location,
                          });
                        }
                      }}
                      className="flex-1 px-2 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition"
                    >
                      Select
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No doctors found message */}
      {!loading && displayedDoctors.length === 0 && userLocation && (
        <div className="absolute bottom-4 left-4 bg-white px-4 py-3 rounded-lg shadow-lg z-10">
          <p className="text-sm text-gray-600">No verified doctors found within {radiusKm}km</p>
          <p className="text-xs text-gray-400 mt-1">Try entering a doctor code directly at the top</p>
        </div>
      )}

      {/* User Location Badge */}
      {!loading && userLocation && (
        <div className="absolute top-3 right-3 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-medium z-10">
          📍 Your Location: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
        </div>
      )}
    </div>
  );
};

export default DoctorLocationMap;
