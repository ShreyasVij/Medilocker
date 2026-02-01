/**
 * Custom React Hooks for Hospital Map functionality
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Hospital,
  getNearbyHospitals,
  getAllHospitals,
  searchHospitals,
  calculateDistance,
} from '@/services/hospitalService';

interface UserLocation {
  latitude: number;
  longitude: number;
}

/**
 * Hook to get user's geolocation
 */
export function useGeolocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  return { location, error, loading };
}

/**
 * Hook to fetch nearby hospitals
 */
export function useNearbyHospitals(radiusKm: number = 5, type?: 'hospital' | 'clinic') {
  const [hospitals, setHospitals] = useState<(Hospital & { distance?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const { location } = useGeolocation();

  useEffect(() => {
    if (location) {
      const fetchNearby = async () => {
        const nearby = await getNearbyHospitals(
          location.latitude,
          location.longitude,
          radiusKm,
          type
        );
        setHospitals(nearby);
        setLoading(false);
      };
      fetchNearby();
    }
  }, [location, radiusKm, type]);

  return { hospitals, loading };
}

/**
 * Hook to search hospitals
 */
export function useHospitalSearch(query: string) {
  const [results, setResults] = useState<Hospital[]>([]);

  useEffect(() => {
    if (query.trim()) {
      const fetchResults = async () => {
        const results = await searchHospitals(query);
        setResults(results);
      };
      fetchResults();
    } else {
      setResults([]);
    }
  }, [query]);

  return results;
}

/**
 * Hook to get all hospitals
 */
export function useAllHospitals() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHospitals = async () => {
      const hospitals = await getAllHospitals();
      setHospitals(hospitals);
      setLoading(false);
    };
    fetchHospitals();
  }, []);

  return { hospitals, loading };
}

/**
 * Hook to calculate distance from user to a hospital
 */
export function useDistanceToHospital(hospital: Hospital) {
  const [distance, setDistance] = useState<number | null>(null);
  const { location } = useGeolocation();

  useEffect(() => {
    if (location) {
      const dist = calculateDistance(
        location.latitude,
        location.longitude,
        hospital.latitude,
        hospital.longitude
      );
      setDistance(dist);
    }
  }, [location, hospital]);

  return distance;
}
