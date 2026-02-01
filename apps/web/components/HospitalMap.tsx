'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  Hospital, 
  getUserGPSLocation, 
  findAllNearbyMedicalFacilitiesFromGPS 
} from '@/services/hospitalService';
import { Copy, Share2, MapPin, AlertCircle, Loader } from 'lucide-react';

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
  };
}

interface HospitalMapProps {
  radiusKm?: number;
  type?: 'hospital' | 'clinic';
  onHospitalSelect?: (hospital: Hospital) => void;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

const isGoogleMapsLoaded = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof window.google !== 'undefined' && 
         typeof window.google.maps !== 'undefined';
};

/**
 * GPS-First Hospital Map Component
 * 1. Gets user's GPS location first
 * 2. Centers map on user's location
 * 3. Searches for nearby hospitals/clinics using Google Places API
 * 4. Displays results on the map
 */
const HospitalMap: React.FC<HospitalMapProps> = ({
  radiusKm = 10,
  type,
  onHospitalSelect,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [displayedHospitals, setDisplayedHospitals] = useState<Hospital[]>([]);
  const [displayedDoctors, setDisplayedDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedDoctorCode, setCopiedDoctorCode] = useState<string | null>(null);
  const doctorCoordinatesRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());

  // Copy location to clipboard
  const copyLocation = async (hospital: Hospital) => {
    const locationText = `${hospital.name}\n${hospital.location}\nCoordinates: ${hospital.latitude}, ${hospital.longitude}\nGoogle Maps: https://www.google.com/maps?q=${hospital.latitude},${hospital.longitude}`;
    
    try {
      await navigator.clipboard.writeText(locationText);
      setCopiedId(hospital.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy');
    }
  };

  // Copy doctor code to clipboard
  const copyDoctorCode = async (doctorCode: string) => {
    try {
      await navigator.clipboard.writeText(doctorCode);
      setCopiedDoctorCode(doctorCode);
      setTimeout(() => setCopiedDoctorCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy doctor code');
    }
  };

  // Share location
  const shareLocation = async (hospital: Hospital) => {
    const shareData = {
      title: hospital.name,
      text: `${hospital.name}\n${hospital.location}`,
      url: `https://www.google.com/maps?q=${hospital.latitude},${hospital.longitude}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await copyLocation(hospital);
      }
    } catch (err) {
      console.log('Share cancelled');
    }
  };

  // Open in Google Maps
  const openInMaps = (hospital: Hospital) => {
    window.open(`https://www.google.com/maps?q=${hospital.latitude},${hospital.longitude}`, '_blank');
  };

  // Add doctor markers to map (with distinct color and doctor code)
  const addDoctorMarkers = (doctors: Doctor[], map: google.maps.Map) => {
    if (!map || !isGoogleMapsLoaded()) return;

    doctors.forEach((doctor) => {
      const coords = doctorCoordinatesRef.current.get(doctor.id);
      if (!coords) return;

      // Green/Teal marker for doctors from our database
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
          ? `<img src="${doctor.profileImageUrl}" alt="${doctor.name}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid #10b981; margin-right: 10px; flex-shrink: 0;" />`
          : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; margin-right: 10px; flex-shrink: 0; border: 2px solid #10b981;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>`;

        const content = `
          <div style="max-width: 300px; padding: 12px; font-family: Arial, sans-serif; color: #1f2937;">
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
              ${profileImageHtml}
              <div>
                <h3 style="margin: 0; font-size: 14px; font-weight: bold; color: #059669;">${doctor.name}</h3>
                <p style="margin: 0; font-size: 11px; color: #6b7280;">${doctor.specialization}</p>
              </div>
            </div>
            
            <div style="margin: 8px 0 0 0; font-size: 12px; color: #4b5563; display: flex; align-items: flex-start;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" style="margin-right: 6px; flex-shrink: 0; margin-top: 2px;">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span style="line-height: 1.4;"><strong>Location:</strong> ${locationStr}</span>
            </div>

            <div style="
              background-color: #f0fdf4;
              padding: 10px;
              border-radius: 6px;
              margin: 10px 0;
              border-left: 3px solid #10b981;
            ">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #6b7280; font-weight: 600;">Doctor Code</p>
              <div style="
                display: flex;
                align-items: center;
                gap: 6px;
                background-color: white;
                padding: 6px 8px;
                border-radius: 4px;
                border: 1px solid #d1d5db;
              ">
                <code style="
                  flex: 1;
                  font-family: 'Courier New', monospace;
                  font-size: 11px;
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
                // Copy to clipboard
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
      });

      markersRef.current.push(marker);
    });
  };

  // Add markers to map
  const addMarkers = (hospitals: Hospital[], map: google.maps.Map) => {
    if (!map || !isGoogleMapsLoaded()) return;

    // Clear existing hospital markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    hospitals.forEach((hospital) => {
      const marker = new google.maps.Marker({
        position: { lat: hospital.latitude, lng: hospital.longitude },
        map: map,
        title: hospital.name,
        icon: hospital.type === 'hospital'
          ? 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
          : 'http://maps.google.com/mapfiles/ms/icons/orange-dot.png',
      });

      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.close();
        }

        const content = `
          <div style="max-width: 280px; padding: 10px; font-family: Arial, sans-serif;">
            <h3 style="margin: 0 0 8px 0; color: #1976d2; font-size: 16px; font-weight: bold;">${hospital.name}</h3>
            <p style="margin: 4px 0; font-size: 12px;">
              <strong>Type:</strong> ${hospital.type === 'hospital' ? '🏥 Hospital' : '⚕️ Clinic'}
            </p>
            <p style="margin: 4px 0; font-size: 12px;">
              <strong>Address:</strong> ${hospital.location}
            </p>
            ${hospital.rating ? `
              <p style="margin: 4px 0; font-size: 12px;">
                <strong>Rating:</strong> ⭐ ${hospital.rating.toFixed(1)}/5
              </p>
            ` : ''}
            ${hospital.distance !== undefined ? `
              <p style="margin: 4px 0; font-size: 12px; color: #1976d2; font-weight: bold;">
                <strong>Distance:</strong> 📍 ${hospital.distance.toFixed(2)} km away
              </p>
            ` : ''}
            ${hospital.isOpen !== undefined ? `
              <p style="margin: 4px 0; font-size: 12px; color: ${hospital.isOpen ? 'green' : 'red'};">
                ${hospital.isOpen ? '🟢 Open now' : '🔴 Closed'}
              </p>
            ` : ''}
            <div style="margin-top: 12px; display: flex; gap: 6px;">
              <button id="copy-${hospital.id}" style="flex: 1; padding: 6px; background: #666; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">📋 Copy</button>
              <button id="share-${hospital.id}" style="flex: 1; padding: 6px; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">📤 Share</button>
              <button id="maps-${hospital.id}" style="flex: 1; padding: 6px; background: #dc3545; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">🗺️ Maps</button>
            </div>
          </div>
        `;

        infoWindowRef.current = new google.maps.InfoWindow({ content });
        infoWindowRef.current.open(map, marker);

        // Add click listeners to buttons after the info window is opened
        setTimeout(() => {
          const copyBtn = document.getElementById(`copy-${hospital.id}`);
          const shareBtn = document.getElementById(`share-${hospital.id}`);
          const mapsBtn = document.getElementById(`maps-${hospital.id}`);

          if (copyBtn) {
            copyBtn.addEventListener('click', () => copyLocation(hospital));
          }
          if (shareBtn) {
            shareBtn.addEventListener('click', () => shareLocation(hospital));
          }
          if (mapsBtn) {
            mapsBtn.addEventListener('click', () => openInMaps(hospital));
          }
        }, 0);
        
        onHospitalSelect?.(hospital);
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
            createMapAndSearchHospitals(location);
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
        createMapAndSearchHospitals(location);
      }
    };

    const createMapAndSearchHospitals = async (location: UserLocation) => {
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

        // Add user location marker
        userMarkerRef.current = new google.maps.Marker({
          position: { lat: location.latitude, lng: location.longitude },
          map: map,
          title: 'Your Location',
          icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          animation: google.maps.Animation.DROP,
        });

        // STEP 3: Search for nearby hospitals/clinics using Google Places API
        const hospitals = await findAllNearbyMedicalFacilitiesFromGPS(
          location.latitude,
          location.longitude,
          radiusKm
        );

        // Filter by type if specified
        const filteredHospitals = type 
          ? hospitals.filter(h => h.type === type)
          : hospitals;

        setDisplayedHospitals(filteredHospitals);

        // STEP 4: Fetch doctors from our database
        let doctorsData: Doctor[] = [];
        try {
          const doctorsRes = await fetch('/api/doctors/with-locations');
          if (doctorsRes.ok) {
            const data = await doctorsRes.json();
            doctorsData = data.doctors || [];
            setDisplayedDoctors(doctorsData);
            console.log(`[HospitalMap] Loaded ${doctorsData.length} doctors`);

            // Geocode doctor locations
            if (doctorsData.length > 0 && isGoogleMapsLoaded()) {
              const geocoder = new google.maps.Geocoder();
              let geocodedCount = 0;

              doctorsData.forEach((doctor) => {
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
                    addDoctorMarkers(doctorsData, map);
                  }
                });
              });
            }
          }
        } catch (err) {
          console.warn('[HospitalMap] Failed to load doctors:', err);
        }

        // STEP 5: Add hospital markers to map
        addMarkers(filteredHospitals, map);

        setLoading(false);
      } catch (err) {
        setError('Failed to load hospitals. ' + (err instanceof Error ? err.message : ''));
        setLoading(false);
      }
    };

    initializeMapWithGPS();
  }, [radiusKm, type]);

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
            <p className="text-gray-400 text-sm mt-2">Searching for nearby hospitals...</p>
          </div>
        </div>
      )}

      {/* Hospital List Sidebar */}
      {!loading && displayedHospitals.length > 0 && (
        <div className="absolute bottom-0 left-0 w-80 bg-white shadow-lg rounded-t-lg max-h-72 overflow-y-auto z-10">
          <div className="p-3 border-b bg-gradient-to-r from-blue-50 to-blue-100 sticky top-0">
            <h3 className="text-sm font-bold text-blue-900">
              Nearby Medical Facilities
            </h3>
            <p className="text-xs text-blue-600">{displayedHospitals.length} found within {radiusKm}km</p>
          </div>

          <div className="divide-y">
            {displayedHospitals.map((hospital) => (
              <div
                key={hospital.id}
                className="p-3 border-b hover:bg-blue-50 transition"
              >
                <div 
                  className="cursor-pointer"
                  onClick={() => {
                    onHospitalSelect?.(hospital);
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.setCenter({
                        lat: hospital.latitude,
                        lng: hospital.longitude,
                      });
                      mapInstanceRef.current.setZoom(16);
                    }
                  }}
                >
                  <p className="font-semibold text-gray-900 text-sm">{hospital.name}</p>
                  <p className="text-gray-500 text-xs mt-1 line-clamp-1">{hospital.location}</p>
                  <div className="flex gap-3 mt-2 items-center">
                    {hospital.distance !== undefined && (
                      <span className="text-blue-600 font-bold text-sm">
                        📍 {hospital.distance.toFixed(1)} km
                      </span>
                    )}
                    {hospital.rating && (
                      <span className="text-yellow-600 text-xs">
                        ⭐ {hospital.rating.toFixed(1)}
                      </span>
                    )}
                    <span className="text-gray-400">
                      {hospital.type === 'hospital' ? '🏥' : '⚕️'}
                    </span>
                    {hospital.isOpen !== undefined && (
                      <span className={hospital.isOpen ? 'text-green-600 text-xs' : 'text-red-600 text-xs'}>
                        {hospital.isOpen ? '🟢' : '🔴'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyLocation(hospital);
                    }}
                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition flex items-center justify-center gap-1 ${
                      copiedId === hospital.id
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-600 text-white hover:bg-gray-700'
                    }`}
                  >
                    <Copy size={14} />
                    {copiedId === hospital.id ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      shareLocation(hospital);
                    }}
                    className="flex-1 px-2 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition flex items-center justify-center gap-1"
                  >
                    <Share2 size={14} />
                    Share
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openInMaps(hospital);
                    }}
                    className="flex-1 px-2 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition flex items-center justify-center gap-1"
                  >
                    <MapPin size={14} />
                    Maps
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No results message */}
      {!loading && displayedHospitals.length === 0 && userLocation && (
        <div className="absolute bottom-4 left-4 bg-white px-4 py-3 rounded-lg shadow-lg z-10">
          <p className="text-sm text-gray-600">No medical facilities found within {radiusKm}km</p>
          <p className="text-xs text-gray-400 mt-1">Try increasing the search radius</p>
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

export default HospitalMap;
