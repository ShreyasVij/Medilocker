'use client';

import React, { useState } from 'react';
import { getHospitalDistanceFromUser, getUserGPSLocation, Hospital } from '@/services/hospitalService';
import { Copy, Share2, MapPin, CheckCircle } from 'lucide-react';

interface HospitalDistanceCalculatorProps {
  hospital: Hospital;
}

/**
 * Component to calculate and display the distance of a chosen hospital from user's GPS location
 */
const HospitalDistanceCalculator: React.FC<HospitalDistanceCalculatorProps> = ({ hospital }) => {
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const calculateDistance = async () => {
    setLoading(true);
    setError(null);
    setDistance(null);

    try {
      // Get user's GPS location
      const userLocation = await getUserGPSLocation();

      if (!userLocation) {
        setError('Unable to access your GPS location. Please enable location services.');
        setLoading(false);
        return;
      }

      // Calculate distance to chosen hospital
      const result = await getHospitalDistanceFromUser(
        hospital.id,
        userLocation.latitude,
        userLocation.longitude
      );

      if (result) {
        setDistance(result.distance);
      } else {
        setError('Hospital not found.');
      }
    } catch (err) {
      setError('Failed to calculate distance.');
    } finally {
      setLoading(false);
    }
  };

  const copyLocation = async () => {
    const locationText = `${hospital.name}\n${hospital.location}\nCoordinates: ${hospital.latitude}, ${hospital.longitude}\nGoogle Maps: https://www.google.com/maps?q=${hospital.latitude},${hospital.longitude}`;
    
    try {
      await navigator.clipboard.writeText(locationText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy location');
    }
  };

  const shareLocation = async () => {
    const shareData = {
      title: hospital.name,
      text: `${hospital.name}\n${hospital.location}`,
      url: `https://www.google.com/maps?q=${hospital.latitude},${hospital.longitude}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await copyLocation();
      }
    } catch (err) {
      // User cancelled or error occurred
      console.log('Share cancelled');
    }
  };

  const openInMaps = () => {
    window.open(`https://www.google.com/maps?q=${hospital.latitude},${hospital.longitude}`, '_blank');
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-2">{hospital.name}</h3>
      <p className="text-sm text-gray-600 mb-4">{hospital.location}</p>

      <button
        onClick={calculateDistance}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
      >
        {loading ? 'Calculating...' : 'Calculate Distance from My Location'}
      </button>

      <div className="flex gap-2 mt-3">
        <button
          onClick={copyLocation}
          className={`flex-1 px-3 py-2 rounded-lg transition text-sm font-medium flex items-center justify-center gap-2 ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          {copied ? (
            <>
              <CheckCircle size={16} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={16} />
              Copy Location
            </>
          )}
        </button>
        <button
          onClick={shareLocation}
          className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium flex items-center justify-center gap-2"
        >
          <Share2 size={16} />
          Share
        </button>
        <button
          onClick={openInMaps}
          className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium flex items-center justify-center gap-2"
        >
          <MapPin size={16} />
          Open in Maps
        </button>
      </div>

      {distance !== null && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800 flex items-center gap-2">
            <MapPin size={16} className="text-green-600" />
            Distance: <span className="text-lg font-bold">{distance.toFixed(2)} km</span>
          </p>
          <p className="text-xs text-green-600 mt-1">
            Approximately {(distance * 0.621371).toFixed(2)} miles
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
};

export default HospitalDistanceCalculator;
