'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import EmergencyTokenGenerator from '@/components/EmergencyTokenGenerator';
import { Shield } from 'lucide-react';

export default function EmergencySettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    
    if (status === 'authenticated' && session?.user) {
      // Fetch user's primary profile
      fetchUserProfile();
    }
  }, [status, session]);
  
  const fetchUserProfile = async () => {
    try {
      // Replace with your actual profile fetch endpoint
      const response = await fetch('/api/profiles');
      const data = await response.json();
      
      if (data.profiles && data.profiles.length > 0) {
        // Get the primary (self) profile
        const primaryProfile = data.profiles.find((p: any) => p.type === 'self');
        if (primaryProfile) {
          setProfileId(primaryProfile.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!profileId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Profile Found</h1>
          <p className="text-gray-600 mb-6">
            You need to create a profile before setting up emergency access.
          </p>
          <button
            onClick={() => router.push('/profile/create')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Create Profile
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Emergency Access Settings</h1>
          <p className="text-gray-600">
            Manage emergency access tokens for your health information
          </p>
        </div>
        
        {/* Emergency Token Generator */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <EmergencyTokenGenerator profileId={profileId} />
        </div>
        
        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* When to Use */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">When to Use Emergency Access</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold">•</span>
                <span>Medical emergencies where you cannot communicate</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold">•</span>
                <span>Hospital admissions requiring immediate medical information</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold">•</span>
                <span>Paramedic or emergency responder situations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold">•</span>
                <span>Travel emergencies in unfamiliar locations</span>
              </li>
            </ul>
          </div>
          
          {/* Security Best Practices */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Security Best Practices</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Only share tokens with trusted emergency contacts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Generate tokens only when immediately needed</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Revoke tokens as soon as the emergency is over</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Keep your emergency contact information up to date</span>
              </li>
            </ul>
          </div>
          
        </div>
        
        {/* Emergency Data Preview */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-blue-900 mb-4">What Emergency Responders Will See</h2>
          <p className="text-blue-800 mb-4">
            When someone uses your emergency token, they will only see:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Basic Information</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Your name and age</li>
                <li>• Blood group</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Medical Critical</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Known allergies</li>
                <li>• Chronic conditions</li>
                <li>• Emergency notes</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4 md:col-span-2">
              <h3 className="font-semibold text-gray-900 mb-2">Emergency Contacts</h3>
              <p className="text-sm text-gray-700">
                Your designated emergency contacts with names, relationships, and phone numbers
              </p>
            </div>
          </div>
          <div className="mt-4 bg-amber-100 border border-amber-300 rounded-lg p-3">
            <p className="text-sm text-amber-900 font-semibold">
              ⚠️ Note: No medical history, documents, or files are included in emergency access.
            </p>
          </div>
        </div>
        
      </div>
    </div>
  );
}
