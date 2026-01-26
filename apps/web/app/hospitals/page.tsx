'use client';

import React, { useState } from 'react';
import HospitalMap from '@/components/HospitalMap';
import { Hospital } from '@/services/hospitalService';

export default function HospitalFinderPage() {
  const [selectedHospital, setSelectedHospital] = useState<(Hospital & { distance?: number }) | null>(null);
  const [showNearbyOnly, setShowNearbyOnly] = useState(true);
  const [radiusKm, setRadiusKm] = useState(5);

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Control Panel */}
      <div className="bg-white shadow-md p-4 border-b">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Hospital & Clinic Finder</h1>
          
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="nearbyOnly"
                checked={showNearbyOnly}
                onChange={(e) => setShowNearbyOnly(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="nearbyOnly" className="text-sm font-medium">
                Show Only Nearby Hospitals
              </label>
            </div>

            {showNearbyOnly && (
              <div className="flex items-center gap-2">
                <label htmlFor="radius" className="text-sm font-medium">
                  Search Radius (km):
                </label>
                <input
                  type="number"
                  id="radius"
                  min="1"
                  max="20"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-16 px-2 py-1 border rounded"
                />
              </div>
            )}
          </div>

          {selectedHospital && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-lg">{selectedHospital.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{selectedHospital.location}</p>
              <div className="flex gap-4 mt-2 text-sm">
                <span>
                  <strong>Type:</strong> {selectedHospital.type === 'hospital' ? 'Hospital' : 'Clinic'}
                </span>
                {selectedHospital.distance && (
                  <span>
                    <strong>Distance:</strong> {selectedHospital.distance.toFixed(2)} km
                  </span>
                )}
                {selectedHospital.specialties && (
                  <span>
                    <strong>Specialties:</strong> {selectedHospital.specialties.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <HospitalMap
          showNearbyOnly={showNearbyOnly}
          radiusKm={radiusKm}
          onHospitalSelect={setSelectedHospital}
        />
      </div>
    </div>
  );
}
