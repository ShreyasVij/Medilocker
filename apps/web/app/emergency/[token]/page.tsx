'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Clock, ShieldAlert, User, Droplet, AlertCircle, Phone, Activity, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

interface EmergencyProfile {
  displayName: string;
  age?: number;
  bloodGroup: string;
  allergies: string[];
  chronicConditions: string[];
  emergencyNotes: string;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
}

interface EmergencyData {
  success: boolean;
  tokenUsed: boolean;
  expiresAt: string;
  profile: EmergencyProfile;
  warnings: string[];
}

interface ErrorResponse {
  error: string;
  locked?: boolean;
  revoked?: boolean;
  expired?: boolean;
  used?: boolean;
}

export default function EmergencyAccessPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  
  const [data, setData] = useState<EmergencyData | null>(null);
  const [error, setError] = useState<ErrorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [locked, setLocked] = useState(false);
  
  const fetchEmergencyData = useCallback(async () => {
    try {
      const response = await fetch(`/api/emergency/${token}`);
      const result = await response.json();
      
      if (!response.ok) {
        setError(result);
        setLocked(result.locked || false);
        setLoading(false);
        return;
      }
      
      setData(result);
      setError(null);
      
      // Calculate initial time remaining
      const expiresAt = new Date(result.expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeRemaining(remaining);
      
      setLoading(false);
    } catch (err) {
      setError({
        error: 'Failed to load emergency data. Please try again.',
        locked: true,
      });
      setLoading(false);
    }
  }, [token]);
  
  useEffect(() => {
    if (token) {
      fetchEmergencyData();
    }
  }, [token, fetchEmergencyData]);
  
  // Countdown timer
  useEffect(() => {
    if (!data || timeRemaining <= 0) return;
    
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        
        // Lock UI when expired
        if (newTime <= 0) {
          setLocked(true);
          setError({
            error: 'Emergency access has expired',
            locked: true,
            expired: true,
          });
        }
        
        return Math.max(0, newTime);
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [data, timeRemaining]);
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-300 border-t-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Loading emergency data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (error || locked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader className="text-center pb-3">
            <ShieldAlert className="h-12 w-12 text-red-600 mx-auto mb-3" />
            <CardTitle className="text-xl">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription className="text-center">
                {error?.error || 'Unknown error'}
              </AlertDescription>
            </Alert>
            
            {error?.revoked && (
              <Alert variant="destructive">
                <AlertDescription>
                  This emergency access has been revoked by the owner.
                </AlertDescription>
              </Alert>
            )}
            
            {error?.expired && (
              <Alert variant="warning">
                <AlertDescription>
                  The emergency access period has ended.
                </AlertDescription>
              </Alert>
            )}
            
            {error?.used && (
              <Alert variant="warning">
                <AlertDescription>
                  This token has already been used. Emergency tokens are single-use for security.
                </AlertDescription>
              </Alert>
            )}
            
            <Button
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!data) {
    return null;
  }
  
  const profile = data.profile;
  
  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-5xl mx-auto space-y-4">
        
        {/* Emergency Access Alert Banner */}
        <Alert variant="destructive" className="border-red-300">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>Emergency Access – Read-only & Time-limited</AlertTitle>
          <AlertDescription>
            This session expires in <span className="font-semibold tabular-nums">{formatTime(timeRemaining)}</span>. 
            All access is logged and monitored.
          </AlertDescription>
        </Alert>
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Patient Information Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-600" />
                <CardTitle className="text-base">Patient Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Full Name</dt>
                <dd className="mt-1 text-base font-semibold text-gray-900">{profile.displayName}</dd>
              </div>
              {profile.age && (
                <>
                  <Separator />
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Age</dt>
                    <dd className="mt-1 text-base font-semibold text-gray-900">{profile.age} years</dd>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Blood Group Card */}
          <Card className="border-red-200 bg-red-50/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Droplet className="h-5 w-5 text-red-600" />
                <CardTitle className="text-base">Blood Group</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600 tabular-nums">{profile.bloodGroup}</span>
                <Badge variant="destructive" className="text-xs">Critical Info</Badge>
              </div>
            </CardContent>
          </Card>
          
          {/* Allergies Card */}
          <Card className="border-amber-200 bg-amber-50/30 lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-base">Known Allergies</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {profile.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.allergies.map((allergy, idx) => (
                    <Badge key={idx} className="bg-amber-100 text-amber-900 border-amber-300 px-3 py-1.5 text-sm font-medium">
                      {allergy}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No known allergies recorded</p>
              )}
            </CardContent>
          </Card>
          
          {/* Chronic Conditions Card */}
          {profile.chronicConditions.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-gray-600" />
                  <CardTitle className="text-base">Chronic Conditions</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {profile.chronicConditions.map((condition, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Activity className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{condition}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          
          {/* Emergency Notes Card */}
          {profile.emergencyNotes && (
            <Card className="lg:col-span-2 border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Emergency Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {profile.emergencyNotes}
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Emergency Contacts Card */}
          {profile.emergencyContacts.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-gray-600" />
                  <CardTitle className="text-base">Emergency Contacts</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.emergencyContacts.map((contact, idx) => (
                  <div key={idx}>
                    {idx > 0 && <Separator className="my-3" />}
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-900">{contact.name}</p>
                        <p className="text-xs text-gray-500">{contact.relationship}</p>
                      </div>
                      <a
                        href={`tel:${contact.phone}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <Phone className="h-4 w-4" />
                        {contact.phone}
                      </a>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
        </div>
        
        {/* Footer Notice */}
        <Card className="bg-gray-100 border-gray-300">
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Time remaining:</span>
                <span className="font-semibold text-gray-900 tabular-nums">{formatTime(timeRemaining)}</span>
              </div>
              <span className="text-xs text-gray-500">Access logged for security</span>
            </div>
          </CardContent>
        </Card>
        
      </div>
    </div>
  );
}
