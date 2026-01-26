'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  Hospital, 
  getUserGPSLocation, 
  findAllNearbyMedicalFacilitiesFromGPS 
} from '@/services/hospitalService';
import { Copy, Share2, MapPin, AlertCircle, Loader } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

        // STEP 4: Add hospital markers to map
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
