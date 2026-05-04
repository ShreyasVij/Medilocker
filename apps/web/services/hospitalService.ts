/**
 * Hospital & Clinic Service
 * GPS-First approach: Uses Google Maps Places API to find nearby medical facilities
 */

// Local Google Maps type shim for the shared service build path.
declare namespace google {
  namespace maps {
    class Map {
      constructor(mapDiv: HTMLElement, opts?: any);
    }

    class LatLng {
      constructor(lat: number, lng: number);
    }

    class Geocoder {
      geocode(request: any, callback: (results: any[] | null, status: string) => void): void;
    }

    namespace places {
      class PlacesService {
        constructor(map: Map);
        nearbySearch(request: any, callback: (results: any[] | null, status: string) => void): void;
        textSearch(request: any, callback: (results: any[] | null, status: string) => void): void;
        getDetails(request: any, callback: (result: any | null, status: string) => void): void;
      }

      interface PlaceSearchRequest {
        location?: LatLng;
        radius?: number;
        type?: string;
      }

      interface TextSearchRequest {
        query?: string;
        location?: LatLng;
        radius?: number;
      }

      const PlacesServiceStatus: { OK: string };
    }
  }
}

// Google Maps types declaration
declare global {
  interface Window {
    google: any;
  }
}

export interface Hospital {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  type?: 'hospital' | 'clinic';
  address?: string;
  phone?: string;
  specialties?: string[];
  doctorId?: string;
  distance?: number;
  rating?: number;
  isOpen?: boolean;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get user's current GPS location
 * @returns Promise with user's coordinates or null if not available
 */
export function getUserGPSLocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

/**
 * Find nearby medical facilities using Google Maps Places API
 */
export async function findNearbyMedicalFacilities(
  userLatitude: number,
  userLongitude: number,
  radiusMeters: number = 5000,
  type: string = 'health'
): Promise<Hospital[]> {
  if (typeof window === 'undefined' || !window.google?.maps?.places) {
    return [];
  }

  return new Promise((resolve) => {
    const location = new google.maps.LatLng(userLatitude, userLongitude);
    const map = new google.maps.Map(document.createElement('div'));
    const service = new google.maps.places.PlacesService(map);

    const request: google.maps.places.PlaceSearchRequest = {
      location: location,
      radius: radiusMeters,
      type: type,
    };

    service.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const hospitals: Hospital[] = results.map((place, index) => {
          const lat = place.geometry?.location?.lat() || 0;
          const lng = place.geometry?.location?.lng() || 0;
          const distance = calculateDistance(userLatitude, userLongitude, lat, lng);

          return {
            id: place.place_id || `place-${index}`,
            name: place.name || 'Unknown',
            location: place.vicinity || place.formatted_address || 'Address not available',
            latitude: lat,
            longitude: lng,
            type: place.types?.includes('hospital') ? 'hospital' : 'clinic',
            address: place.vicinity || place.formatted_address,
            specialties: place.types || [],
            distance: distance,
            rating: place.rating,
            isOpen: place.opening_hours?.isOpen?.() || undefined,
          } as Hospital;
        });

        hospitals.sort((a, b) => (a.distance || 0) - (b.distance || 0));
        resolve(hospitals);
      } else {
        resolve([]);
      }
    });
  });
}

/**
 * GPS-FIRST: Find nearby hospitals/clinics based on user location
 */
export async function getNearbyHospitals(
  userLat: number,
  userLng: number,
  radiusKm: number = 5,
  type?: 'hospital' | 'clinic'
): Promise<Hospital[]> {
  const radiusMeters = radiusKm * 1000;
  const searchType = type === 'hospital' ? 'hospital' : type === 'clinic' ? 'doctor' : 'health';
  
  const facilities = await findNearbyMedicalFacilities(userLat, userLng, radiusMeters, searchType);

  if (type) {
    return facilities.filter(f => f.type === type);
  }

  return facilities;
}

/**
 * GPS-FIRST: Get all nearby hospitals (requires user GPS location)
 */
export async function getAllHospitals(radiusKm: number = 10): Promise<Hospital[]> {
  const userLocation = await getUserGPSLocation();
  
  if (!userLocation) {
    return [];
  }

  const types = ['hospital', 'doctor', 'health'];
  const allResults = await Promise.all(
    types.map(type => findNearbyMedicalFacilities(
      userLocation.latitude,
      userLocation.longitude,
      radiusKm * 1000,
      type
    ))
  );

  const uniquePlaces = new Map<string, Hospital>();
  allResults.flat().forEach(place => {
    if (!uniquePlaces.has(place.id)) {
      uniquePlaces.set(place.id, place);
    }
  });

  const facilities = Array.from(uniquePlaces.values());
  facilities.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  
  return facilities;
}

/**
 * Get hospital details by Place ID
 */
export async function getHospitalById(placeId: string): Promise<Hospital | null> {
  if (typeof window === 'undefined' || !window.google?.maps?.places) {
    return null;
  }

  return new Promise((resolve) => {
    const map = new google.maps.Map(document.createElement('div'));
    const service = new google.maps.places.PlacesService(map);

    service.getDetails({ placeId }, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        const lat = place.geometry?.location?.lat() || 0;
        const lng = place.geometry?.location?.lng() || 0;

        resolve({
          id: place.place_id || placeId,
          name: place.name || 'Unknown',
          location: place.vicinity || place.formatted_address || 'Address not available',
          latitude: lat,
          longitude: lng,
          type: place.types?.includes('hospital') ? 'hospital' : 'clinic',
          address: place.formatted_address,
          phone: place.formatted_phone_number,
          specialties: place.types || [],
          rating: place.rating,
          isOpen: place.opening_hours?.isOpen?.() || undefined,
        });
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Search hospitals by name using GPS location
 */
export async function searchHospitals(query: string, userLocation?: { latitude: number; longitude: number }): Promise<Hospital[]> {
  if (typeof window === 'undefined' || !window.google?.maps?.places) {
    return [];
  }

  const location = userLocation || await getUserGPSLocation();
  if (!location) {
    return [];
  }

  return new Promise((resolve) => {
    const map = new google.maps.Map(document.createElement('div'));
    const service = new google.maps.places.PlacesService(map);

    const request: google.maps.places.TextSearchRequest = {
      query: `${query} hospital doctor clinic`,
      location: new google.maps.LatLng(location.latitude, location.longitude),
      radius: 50000,
    };

    service.textSearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const hospitals: Hospital[] = results.map((place, index) => {
          const lat = place.geometry?.location?.lat() || 0;
          const lng = place.geometry?.location?.lng() || 0;
          const distance = calculateDistance(location.latitude, location.longitude, lat, lng);

          return {
            id: place.place_id || `place-${index}`,
            name: place.name || 'Unknown',
            location: place.vicinity || place.formatted_address || 'Address not available',
            latitude: lat,
            longitude: lng,
            type: place.types?.includes('hospital') ? 'hospital' : 'clinic',
            address: place.formatted_address,
            specialties: place.types || [],
            distance: distance,
            rating: place.rating,
            isOpen: place.opening_hours?.isOpen?.() || undefined,
          };
        });

        hospitals.sort((a, b) => (a.distance || 0) - (b.distance || 0));
        resolve(hospitals);
      } else {
        resolve([]);
      }
    });
  });
}

/**
 * Calculate distance from user to specific hospital
 */
export async function getHospitalDistanceFromUser(
  hospitalId: string,
  userLatitude: number,
  userLongitude: number
): Promise<{ hospital: Hospital; distance: number } | null> {
  const hospital = await getHospitalById(hospitalId);
  
  if (!hospital) {
    return null;
  }

  const distance = calculateDistance(userLatitude, userLongitude, hospital.latitude, hospital.longitude);

  return { hospital, distance };
}

/**
 * MAIN FUNCTION: Find all nearby medical facilities from GPS
 * Searches for hospitals, doctors, clinics, dentists, pharmacies, etc.
 */
export async function findAllNearbyMedicalFacilitiesFromGPS(
  userLatitude: number,
  userLongitude: number,
  radiusKm: number = 10
): Promise<Hospital[]> {
  const radiusMeters = radiusKm * 1000;
  const types = ['hospital', 'doctor', 'health', 'dentist', 'physiotherapist', 'pharmacy'];
  
  const allResults = await Promise.all(
    types.map(type => findNearbyMedicalFacilities(userLatitude, userLongitude, radiusMeters, type))
  );

  const uniquePlaces = new Map<string, Hospital>();
  allResults.flat().forEach(place => {
    if (!uniquePlaces.has(place.id)) {
      uniquePlaces.set(place.id, place);
    }
  });

  const facilities = Array.from(uniquePlaces.values());
  facilities.sort((a, b) => (a.distance || 0) - (b.distance || 0));

  return facilities;
}
