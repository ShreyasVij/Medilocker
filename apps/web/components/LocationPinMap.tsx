'use client';

import React, { useEffect, useRef, useState } from 'react';

// Local Google Maps type shim for this component build path.
declare namespace google {
  namespace maps {
    class Map {
      constructor(mapDiv: HTMLElement, opts?: any);
      addListener(eventName: string, handler: (...args: any[]) => void): void;
    }

    class Marker {
      constructor(opts?: any);
      setMap(map: Map | null): void;
      addListener(eventName: string, handler: (...args: any[]) => void): void;
      getPosition(): { lat(): number; lng(): number } | null;
    }

    class InfoWindow {
      constructor(opts?: any);
      open(map?: Map, anchor?: any): void;
    }

    class Geocoder {
      geocode(request: any, callback: (results: any[] | null, status: string) => void): void;
    }

    interface MapMouseEvent {
      latLng?: { lat(): number; lng(): number } | null;
    }

    const SymbolPath: { CIRCLE: any };
    const GeocoderStatus: { OK: string };
  }
}

// Google Maps types declaration
declare global {
  interface Window {
    google: any;
  }
}
import { MapPin, AlertCircle, Loader } from 'lucide-react';
import { getUserGPSLocation } from '@/services/hospitalService';

interface LocationPinMapProps {
  onLocationSelect?: (location: {
    address: string;
    latitude: number;
    longitude: number;
  }) => void;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
}

const isGoogleMapsLoaded = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof window.google !== 'undefined' && 
         typeof window.google.maps !== 'undefined';
};

/**
 * Location Pinning Map Component
 * Allows users to select their clinic/hospital location on a map
 */
const LocationPinMap: React.FC<LocationPinMapProps> = ({
  onLocationSelect,
  initialLat,
  initialLng,
  initialAddress,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    address: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    const initializeMap = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get user's GPS location or use initial values
        let userLat = initialLat;
        let userLng = initialLng;

        if (!userLat || !userLng) {
          const location = await getUserGPSLocation();
          if (location) {
            userLat = location.latitude;
            userLng = location.longitude;
          } else {
            // Fallback to default location (Chandigarh, India)
            userLat = 30.7333;
            userLng = 76.7794;
          }
        }

        // Wait for Google Maps to load
        if (!isGoogleMapsLoaded()) {
          const checkInterval = setInterval(() => {
            if (isGoogleMapsLoaded()) {
              clearInterval(checkInterval);
              createMap(userLat, userLng);
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
          createMap(userLat, userLng);
        }
      } catch (err) {
        setError('Failed to initialize map. ' + (err instanceof Error ? err.message : ''));
        setLoading(false);
      }
    };

    const createMap = async (centerLat: number, centerLng: number) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      try {
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 15,
          mapTypeControl: true,
          fullscreenControl: true,
          streetViewControl: true,
        });

        mapInstanceRef.current = map;

        // Add initial marker if coordinates provided
        if (initialLat && initialLng) {
          addMarker(map, initialLat, initialLng, initialAddress || 'Selected Location');
        } else {
          // Add marker at current location
          addMarker(map, centerLat, centerLng, 'Your Location');
        }

        // Listen for map clicks
        map.addListener('click', (event: google.maps.MapMouseEvent) => {
          const lat = event.latLng?.lat();
          const lng = event.latLng?.lng();

          if (lat && lng) {
            // Remove old marker
            if (markerRef.current) {
              markerRef.current.setMap(null);
            }

            // Add new marker
            addMarker(map, lat, lng, 'Selected Location');

            // Reverse geocode to get address
            reverseGeocode(lat, lng);
          }
        });

        setLoading(false);
      } catch (err) {
        setError('Failed to create map. ' + (err instanceof Error ? err.message : ''));
        setLoading(false);
      }
    };

    initializeMap();
  }, []);

  // Add marker to map and reverse geocode
  const addMarker = (map: google.maps.Map, lat: number, lng: number, title: string) => {
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: map,
      title: title,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: '#ef4444', // Red for clinic location
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
      draggable: true, // Allow dragging
    });

    // Listen for marker drag
    marker.addListener('dragend', () => {
      const pos = marker.getPosition();
      if (pos) {
        reverseGeocode(pos.lat(), pos.lng());
      }
    });

    markerRef.current = marker;
  };

  // Reverse geocode coordinates to get address
  const reverseGeocode = (lat: number, lng: number) => {
    if (!isGoogleMapsLoaded()) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
        const address = results[0].formatted_address;
        const location = { address, latitude: lat, longitude: lng };

        setSelectedLocation(location);
        onLocationSelect?.(location);

        // Show info window
        if (markerRef.current) {
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 10px; font-family: Arial, sans-serif; max-width: 250px;">
                <p style="margin: 0 0 8px 0; font-weight: bold; color: #ef4444;">📍 Selected Clinic Location</p>
                <p style="margin: 0 0 6px 0; font-size: 12px; color: #374151;">${address}</p>
                <p style="margin: 0; font-size: 11px; color: #6b7280;">
                  Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}
                </p>
              </div>
            `,
          });
          infoWindow.open(mapInstanceRef.current!, markerRef.current);
        }
      }
    });
  };

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
    <div className="w-full space-y-4">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900 font-semibold mb-2">📍 Pinpoint Your Clinic/Hospital Location</p>
        <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
          <li>Click on the map to pinpoint your clinic/hospital location</li>
          <li>You can drag the marker to adjust the location</li>
          <li>The address will be automatically detected</li>
          <li>Or you can manually type your address in the field below</li>
        </ul>
      </div>

      {/* Map Container */}
      <div
        ref={mapRef}
        className="w-full rounded-lg border border-gray-300"
        style={{ minHeight: '400px', position: 'relative' }}
      />

      {/* Loading overlay */}
      {loading && (
        <div
          className="absolute inset-0 bg-gray-100 flex items-center justify-center rounded-lg"
          style={{ minHeight: '400px' }}
        >
          <div className="text-center">
            <Loader size={48} className="text-blue-600 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600 text-base font-medium">Loading map...</p>
            <p className="text-gray-400 text-sm mt-2">Getting your location...</p>
          </div>
        </div>
      )}

      {/* Selected Location Display */}
      {selectedLocation && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-green-900 mb-2">✓ Selected Location</p>
          <p className="text-sm text-gray-700 mb-2">{selectedLocation.address}</p>
          <p className="text-xs text-gray-600">
            Coordinates: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationPinMap;
