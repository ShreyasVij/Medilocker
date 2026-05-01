/**
 * EmergencyProfilePublic Component
 * Displays emergency profile publicly (no auth required)
 * Mobile-first responsive design
 */

'use client';

import React from 'react';

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

interface PublicEmergencyProfile {
  id: string;
  patient: {
    name: string;
    age?: number;
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
    bloodGroupEmoji?: string;
  };
  allergies: {
    list: string[];
    severity: string[];
    description?: string;
  };
  medicalConditions: {
    activeConditions: Array<{
      condition: string;
      diagnosed?: string;
      status?: string;
    }>;
  };
  medications: {
    current: string[];
    note?: string;
  };
  healthSummary?: {
    overallStatus: string;
    keyFindings: string[];
    alert?: string | null;
  };
  insurance: {
    hasInsurance: boolean;
    insurerName?: string;
    policyType?: string;
    policyNumberHidden: boolean;
    estimatedCoverage?: string;
    contactButtonText?: string;
  };
  emergencyContacts: EmergencyContact[];
  vaccinations?: {
    lastUpdated?: string;
    summary?: string;
  };
  doctorNotes?: string;
}

interface EmergencyProfilePublicProps {
  profile: PublicEmergencyProfile;
  onRequestFullAccess: () => void;
  onShare: () => void;
  isLoading?: boolean;
}

export const EmergencyProfilePublic: React.FC<EmergencyProfilePublicProps> = ({
  profile,
  onRequestFullAccess,
  onShare,
  isLoading,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-red-600 to-orange-600 text-white p-4 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🚨 Emergency Profile</h1>
              <p className="text-red-100 text-sm mt-1">Medical Information Available</p>
            </div>
            <div className="text-4xl">🩺</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto p-4 pb-24">
        {/* Patient Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{profile.patient.name}</h2>
              {profile.patient.age && (
                <p className="text-gray-600">
                  {profile.patient.age} years old
                  {profile.patient.gender && ` • ${profile.patient.gender}`}
                </p>
              )}
            </div>
            <div className="text-5xl">{profile.patient.bloodGroupEmoji}</div>
          </div>

          {/* Blood Group - High Priority */}
          {profile.patient.bloodGroup && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 text-center">
                <p className="text-sm font-medium text-gray-700">Blood Group</p>
                <p className="text-3xl font-bold text-red-600">{profile.patient.bloodGroup}</p>
              </div>
            </div>
          )}
        </div>

        {/* Critical Allergies - RED ALERT */}
        {profile.allergies.list.length > 0 && (
          <div className="bg-white border-4 border-red-500 rounded-lg shadow-md p-6 mb-4">
            <h3 className="text-lg font-bold text-red-600 mb-3">⚠️ CRITICAL ALLERGIES</h3>
            <div className="space-y-2">
              {profile.allergies.list.map((allergen, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-red-50 border-l-4 border-red-500 rounded flex items-start gap-2"
                >
                  <span className="text-red-600 font-bold">❌</span>
                  <div>
                    <p className="font-semibold text-red-900">{allergen}</p>
                    <p className="text-sm text-red-800">Severity: {profile.allergies.severity[idx]}</p>
                  </div>
                </div>
              ))}
            </div>
            {profile.allergies.description && (
              <p className="text-sm text-red-900 mt-3 font-medium italic">
                {profile.allergies.description}
              </p>
            )}
          </div>
        )}

        {/* Medical Conditions */}
        {profile.medicalConditions.activeConditions.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">📋 Active Conditions</h3>
            <div className="space-y-2">
              {profile.medicalConditions.activeConditions.map((condition, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <span className="text-yellow-600 text-xl">•</span>
                  <div>
                    <p className="font-semibold text-gray-900">{condition.condition}</p>
                    {condition.status && <p className="text-sm text-gray-700">Status: {condition.status}</p>}
                    {condition.diagnosed && <p className="text-xs text-gray-600">Diagnosed: {condition.diagnosed}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Medications */}
        {profile.medications.current.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">💊 Current Medications</h3>
            <div className="space-y-2">
              {profile.medications.current.map((med, idx) => (
                <div key={idx} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-semibold text-blue-900">{med}</p>
                </div>
              ))}
            </div>
            {profile.medications.note && (
              <p className="text-sm text-gray-700 mt-3 italic">{profile.medications.note}</p>
            )}
          </div>
        )}

        {/* Health Summary */}
        {profile.healthSummary && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">📊 Health Summary</h3>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-4">
              <p className="font-semibold text-blue-900 text-lg">{profile.healthSummary.overallStatus}</p>
            </div>

            {profile.healthSummary.keyFindings.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Key Findings:</p>
                <ul className="space-y-1">
                  {profile.healthSummary.keyFindings.map((finding, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-blue-600 font-bold">✓</span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile.healthSummary.alert && (
              <div className="p-3 bg-orange-50 border border-orange-300 rounded-lg">
                <p className="text-sm text-orange-900">
                  <span className="font-semibold">Alert:</span> {profile.healthSummary.alert}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Insurance */}
        {profile.insurance.hasInsurance && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">🏥 Insurance</h3>
            <div className="space-y-2">
              {profile.insurance.insurerName && (
                <p className="text-lg font-semibold text-gray-900">{profile.insurance.insurerName}</p>
              )}
              {profile.insurance.policyType && (
                <p className="text-sm text-gray-700">Type: {profile.insurance.policyType}</p>
              )}
              {profile.insurance.estimatedCoverage && (
                <p className="text-sm text-gray-700">Coverage: {profile.insurance.estimatedCoverage}</p>
              )}
              <button className="w-full mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                {profile.insurance.contactButtonText || 'Contact Insurance'}
              </button>
            </div>
          </div>
        )}

        {/* Emergency Contacts - Critical */}
        {profile.emergencyContacts.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">📞 Emergency Contacts</h3>
            <div className="space-y-3">
              {profile.emergencyContacts.map((contact, idx) => (
                <a
                  key={idx}
                  href={`tel:${contact.phone}`}
                  className="block p-4 bg-green-50 border-2 border-green-300 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <p className="font-semibold text-gray-900">{contact.name}</p>
                  <p className="text-sm text-gray-700">{contact.relationship}</p>
                  <p className="text-lg font-bold text-green-600 mt-2">{contact.phone}</p>
                  <p className="text-xs text-gray-600 mt-2">⬆️ Tap to call</p>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Doctor Notes */}
        {profile.doctorNotes && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">👨‍⚕️ Doctor Notes</h3>
            <p className="text-gray-700">{profile.doctorNotes}</p>
          </div>
        )}

        {/* Vaccinations */}
        {profile.vaccinations && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">💉 Vaccinations</h3>
            {profile.vaccinations.summary && (
              <p className="text-gray-700">{profile.vaccinations.summary}</p>
            )}
            {profile.vaccinations.lastUpdated && (
              <p className="text-xs text-gray-600 mt-2">Last updated: {profile.vaccinations.lastUpdated}</p>
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl">
        <div className="max-w-2xl mx-auto p-4 flex gap-3">
          <button
            onClick={onShare}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            📤 Share
          </button>
          <button
            onClick={onRequestFullAccess}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? '⏳ Loading...' : '🔓 Request Full Access'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmergencyProfilePublic;
