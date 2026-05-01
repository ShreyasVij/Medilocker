/**
 * Full Emergency Profile Page (After OTP)
 * Location: /emergency/public/nfc/[token]/full
 * Requires valid access token from OTP verification
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

export default function FullEmergencyProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const accessToken = searchParams.get('accessToken');

  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Fetch full profile
  useEffect(() => {
    const fetchFullProfile = async () => {
      if (!accessToken) {
        setError('No access token provided. Please verify OTP first.');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/emergency/nfc/${token}/full?accessToken=${accessToken}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Error: ${response.status}`);
        }

        const data = await response.json();
        setProfile(data.fullProfile);
        setTimeRemaining(data.accessInfo?.timeRemainingMinutes || 30);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load full profile');
      } finally {
        setIsLoading(false);
      }
    };

    if (token && accessToken) {
      fetchFullProfile();
    }
  }, [token, accessToken]);

  // Timer for remaining time
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev && prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev ? prev - 1 : null;
      });
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [timeRemaining]);

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-spin">🔄</div>
          <p className="text-gray-600 text-lg">Loading complete medical records...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-6 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Error</h1>
          <p className="text-gray-600 mb-6">{error || 'Could not load full profile'}</p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Full Profile Display
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🔓 Full Medical Records</h1>
              <p className="text-blue-100 text-sm mt-1">Complete access granted</p>
            </div>
            {timeRemaining && (
              <div className="text-right">
                <p className="text-blue-100 text-sm">Access expires in</p>
                <p className="text-2xl font-bold">{timeRemaining}m</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="max-w-4xl mx-auto p-4 mt-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
        <p className="text-sm text-yellow-900">
          <span className="font-bold">📸 Confidential:</span> Please do not share screenshots or take photos of this information. Your medical privacy is protected by law.
        </p>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Medical History */}
        {profile.medicalHistory && (profile.medicalHistory.recentDiagnoses?.length > 0 || profile.medicalHistory.pastSurgeries?.length > 0 || profile.medicalHistory.pastHospitalizations?.length > 0) && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">📋 Medical History</h2>

            {profile.medicalHistory.recentDiagnoses?.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Recent Diagnoses</h3>
                <div className="space-y-2">
                  {profile.medicalHistory.recentDiagnoses.map((diagnosis: any, idx: number) => (
                    <div key={idx} className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <p className="font-semibold text-gray-900">{diagnosis.diagnosis}</p>
                      {diagnosis.diagnosedDate && <p className="text-sm text-gray-700">Date: {diagnosis.diagnosedDate}</p>}
                      {diagnosis.severity && <p className="text-sm text-gray-700">Severity: {diagnosis.severity}</p>}
                      {diagnosis.status && <p className="text-sm text-gray-700">Status: {diagnosis.status}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile.medicalHistory.pastSurgeries?.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Past Surgeries</h3>
                <div className="space-y-2">
                  {profile.medicalHistory.pastSurgeries.map((surgery: any, idx: number) => (
                    <div key={idx} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="font-semibold text-gray-900">{surgery.procedure}</p>
                      {surgery.date && <p className="text-sm text-gray-700">Date: {surgery.date}</p>}
                      {surgery.hospital && <p className="text-sm text-gray-700">Hospital: {surgery.hospital}</p>}
                      {surgery.notes && <p className="text-sm text-gray-700">Notes: {surgery.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile.medicalHistory.pastHospitalizations?.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Past Hospitalizations</h3>
                <div className="space-y-2">
                  {profile.medicalHistory.pastHospitalizations.map((hosp: any, idx: number) => (
                    <div key={idx} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="font-semibold text-gray-900">{hosp.reason}</p>
                      {hosp.dates && <p className="text-sm text-gray-700">Dates: {hosp.dates}</p>}
                      {hosp.hospital && <p className="text-sm text-gray-700">Hospital: {hosp.hospital}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lab Results */}
        {profile.labResults?.recent?.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">🧪 Lab Results</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-3 font-semibold">Test</th>
                    <th className="text-center py-2 px-3 font-semibold">Value</th>
                    <th className="text-center py-2 px-3 font-semibold">Reference</th>
                    <th className="text-center py-2 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.labResults.recent.map((result: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <div>
                          <p className="font-medium text-gray-900">{result.testName}</p>
                          {result.testDate && <p className="text-xs text-gray-600">{result.testDate}</p>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-semibold">
                        {result.value} {result.unit}
                      </td>
                      <td className="py-3 px-3 text-center text-gray-700">
                        {result.referenceRange}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          result.status === 'High' ? 'bg-red-100 text-red-800' :
                          result.status === 'Low' ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {result.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Medications */}
        {profile.medications?.current?.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">💊 Detailed Medications</h2>
            <div className="space-y-4">
              {profile.medications.current.map((med: any, idx: number) => (
                <div key={idx} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-semibold text-gray-900">{med.name}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-700">
                    <p>Dosage: {med.dosage}</p>
                    <p>Frequency: {med.frequency}</p>
                    {med.indication && <p>Indication: {med.indication}</p>}
                    {med.startDate && <p>Started: {med.startDate}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insurance Details */}
        {profile.insurance && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">🏥 Insurance Details</h2>
            <div className="space-y-3">
              <p><span className="font-semibold">Provider:</span> {profile.insurance.provider}</p>
              <p><span className="font-semibold">Policy Number:</span> {profile.insurance.policyNumber}</p>
              <p><span className="font-semibold">Type:</span> {profile.insurance.policyType}</p>
              {profile.insurance.coverageAmount && <p><span className="font-semibold">Coverage:</span> {profile.insurance.coverageAmount}</p>}
              {profile.insurance.sumInsured && <p><span className="font-semibold">Sum Insured:</span> {profile.insurance.sumInsured}</p>}
            </div>
          </div>
        )}

        {/* Recent Documents */}
        {profile.recentDocuments?.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">📄 Recent Documents</h2>
            <div className="space-y-2">
              {profile.recentDocuments.map((doc: any, idx: number) => (
                <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-medium text-gray-900">{doc.docName}</p>
                  <p className="text-sm text-gray-600">Type: {doc.type} | {doc.uploadDate}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl p-4">
        <div className="max-w-4xl mx-auto text-center">
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            🖨️ Print Records
          </button>
          <p className="text-xs text-gray-600 mt-2">
            Access expires in {timeRemaining || 'loading'} minutes
          </p>
        </div>
      </div>
    </div>
  );
}
