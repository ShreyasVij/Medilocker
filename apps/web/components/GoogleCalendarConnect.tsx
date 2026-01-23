"use client";

import { useEffect, useState } from "react";
import { Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function GoogleCalendarConnect() {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check connection status from doctor profile
    async function checkConnection() {
      try {
        const res = await fetch("/api/doctor/profile");
        if (res.ok) {
          const data = await res.json();
          setIsConnected(!!data.profile?.googleTokens);
        }
      } catch (error) {
        console.error("Failed to check Google Calendar status:", error);
      } finally {
        setLoading(false);
      }
    }

    checkConnection();

    // Handle callback messages
    const calendarConnected = searchParams.get("calendar_connected");
    const calendarError = searchParams.get("calendar_error");

    if (calendarConnected === "true") {
      setIsConnected(true);
      // Clear URL params
      window.history.replaceState({}, "", "/doctor");
    }

    if (calendarError) {
      alert(`Google Calendar connection failed: ${calendarError}`);
      window.history.replaceState({}, "", "/doctor");
    }
  }, [searchParams]);

  const handleConnect = () => {
    window.location.href = "/api/google/connect";
  };

  if (loading) {
    return null;
  }

  // Don't show anything if already connected
  if (isConnected) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Google Calendar</h3>
            <p className="text-sm text-gray-600">
              Connect to sync appointments to your calendar
            </p>
          </div>
        </div>

        <button
          onClick={handleConnect}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Connect Calendar
        </button>
      </div>
    </div>
  );
}
