"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Copy, CheckCircle, AlertCircle } from "lucide-react";

export default function DoctorCodeDisplay() {
  const { data: session } = useSession();
  const [doctorCode, setDoctorCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDoctorCode() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/doctor/profile");
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage = errorData.error || "Failed to fetch doctor profile";
          const errorDetails = errorData.details ? ` - ${errorData.details}` : "";
          console.error(`Doctor profile error (${res.status}):`, errorMessage, errorDetails);
          throw new Error(`${errorMessage}${errorDetails}`);
        }
        
        const data = await res.json();
        console.log("Doctor profile data:", data); // Debug log
        
        if (data.doctor?.doctorCode) {
          setDoctorCode(data.doctor.doctorCode);
        } else {
          setError("Doctor code not found. Please save your profile to generate one.");
        }
      } catch (err) {
        console.error("Failed to fetch doctor code:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to load doctor code";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchDoctorCode();
    }
  }, [session]);

  const handleCopy = () => {
    if (doctorCode) {
      navigator.clipboard.writeText(doctorCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
          <span className="text-sm">Loading doctor code...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-yellow-800">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      </div>
    );
  }

  if (!doctorCode) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Your Unique Doctor Code
          </h3>
          <p className="text-xs text-gray-500 mb-2">
            Share this code with patients to book appointments
          </p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-mono font-bold text-blue-600 tracking-wider">
              {doctorCode}
            </span>
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-blue-100 rounded-md transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <Copy className="h-5 w-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
