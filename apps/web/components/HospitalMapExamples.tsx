/**
 * Hospital Map Usage Examples
 * Shows different ways to use the HospitalMap component
 */

'use client';

import React, { useState } from 'react';
import HospitalMap from '@/components/HospitalMap';
import { useNearbyHospitals, useHospitalSearch, useAllHospitals, useDistanceToHospital } from '@/hooks/useHospitals';
import { Hospital } from '@/services/hospitalService';

/**
 * Example 1: Full-screen hospital finder (used at /hospitals)
 */
export function FullScreenHospitalFinder() {
  const [selectedHospital, setSelectedHospital] = useState<(Hospital & { distance?: number }) | null>(null);

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="bg-white shadow-md p-4">
        <h1 className="text-2xl font-bold">Hospital Finder</h1>
        {selectedHospital && (
          <p className="text-sm text-gray-600 mt-2">
            Selected: <strong>{selectedHospital.name}</strong>
          </p>
        )}
      </div>
      <HospitalMap onHospitalSelect={setSelectedHospital} />
    </div>
  );
}

/**
 * Example 2: Embedded in a patient dashboard
 */
export function EmbeddedHospitalMap() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left panel: Patient info */}
      <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Find Nearby Healthcare</h2>
        <p className="text-gray-600 text-sm">
          Locate hospitals and clinics near your current location
        </p>
      </div>

      {/* Right panel: Map */}
      <div className="lg:col-span-2 h-96 rounded-lg overflow-hidden shadow">
        <HospitalMap
          showNearbyOnly={true}
          radiusKm={5}
        />
      </div>
    </div>
  );
}

/**
 * Example 3: Using the useNearbyHospitals hook
 */
export function NearbyHospitalsList() {
  const { hospitals, loading } = useNearbyHospitals(5, 'hospital');

  if (loading) return <div>Loading nearby hospitals...</div>;

  return (
    <div className="space-y-2">
      <h3 className="font-bold">Hospitals within 5km</h3>
      {hospitals.map((hospital) => (
        <div key={hospital.id} className="p-3 border rounded hover:bg-gray-50">
          <p className="font-semibold">{hospital.name}</p>
          <p className="text-xs text-gray-600">{hospital.location}</p>
          {hospital.distance && (
            <p className="text-xs text-blue-600">
              {hospital.distance.toFixed(2)} km away
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Example 4: Search hospitals with hook
 */
export function HospitalSearchBox() {
  const [query, setQuery] = useState('');
  const results = useHospitalSearch(query);

  return (
    <div className="w-full max-w-md">
      <input
        type="text"
        placeholder="Search hospitals, clinics, specialties..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-4 py-2 border rounded-lg"
      />

      {results.length > 0 && (
        <div className="mt-2 border rounded-lg shadow-lg">
          {results.map((hospital) => (
            <div key={hospital.id} className="p-3 border-b last:border-b-0 hover:bg-gray-50">
              <p className="font-semibold">{hospital.name}</p>
              <p className="text-xs text-gray-600">{hospital.location}</p>
              {hospital.specialties && (
                <p className="text-xs text-gray-500">{hospital.specialties.join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Example 5: Distance display for a specific hospital
 */
export function HospitalWithDistance({ hospital }: { hospital: Hospital }) {
  const distance = useDistanceToHospital(hospital);

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold">{hospital.name}</h3>
      <p className="text-sm text-gray-600">{hospital.location}</p>
      {distance !== null && (
        <p className="text-sm text-blue-600 font-medium mt-2">
          {distance.toFixed(2)} km away
        </p>
      )}
    </div>
  );
}

/**
 * Example 6: Hospital list with filtering
 */
export function FilteredHospitalList() {
  const { hospitals } = useAllHospitals();
  const [filter, setFilter] = useState<'all' | 'hospital' | 'clinic'>('all');

  const filtered = hospitals.filter((h) => {
    if (filter === 'all') return true;
    return h.type === filter;
  });

  return (
    <div className="w-full max-w-2xl">
      <div className="flex gap-2 mb-4">
        {(['all', 'hospital', 'clinic'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded font-medium text-sm ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f === 'all' ? 'All' : f === 'hospital' ? 'Hospitals' : 'Clinics'}
            {' '}({filtered.length})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((hospital) => (
          <div key={hospital.id} className="p-3 border rounded">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">{hospital.name}</p>
                <p className="text-xs text-gray-600">{hospital.location}</p>
              </div>
              <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                {hospital.type === 'hospital' ? '🏥' : '⚕️'}{' '}
                {hospital.type === 'hospital' ? 'Hospital' : 'Clinic'}
              </span>
            </div>
            {hospital.specialties && (
              <p className="text-xs text-gray-500 mt-2">{hospital.specialties.join(', ')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
