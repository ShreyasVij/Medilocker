"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type InviteState = "loading" | "success" | "invalid" | "error";

export default function JoinFamilyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token");
  const [state, setState] = useState<InviteState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [familyName, setFamilyName] = useState("");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      setErrorMessage("No invite token provided");
      return;
    }

    async function joinFamily() {
      const res = await fetch("/api/family/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });

      const data = await res.json();

      if (!res.ok) {
        // Check if it's an expired/invalid token vs other error
        const errMsg = data.error || "Failed to join family";
        if (errMsg.toLowerCase().includes("expired") || 
            errMsg.toLowerCase().includes("invalid") ||
            errMsg.toLowerCase().includes("not found")) {
          setState("invalid");
        } else {
          setState("error");
        }
        setErrorMessage(errMsg);
        return;
      }

      // Extract family name if available
      if (data.familyName) {
        setFamilyName(data.familyName);
      }

      setState("success");

      // Redirect after success
      setTimeout(() => {
        router.push("/family");
      }, 2000);
    }

    joinFamily();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Loading State */}
        {state === "loading" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 mb-6 flex items-center justify-center">
                <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Processing Invite
              </h1>
              <p className="text-sm text-gray-600">
                Please wait while we verify your invitation...
              </p>
            </div>
          </div>
        )}

        {/* Success State */}
        {state === "success" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              {/* Success Icon */}
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Successfully Joined!
              </h1>
              {familyName && (
                <p className="text-sm text-gray-600 mb-4">
                  You are now a member of <span className="font-semibold text-gray-900">{familyName}</span>
                </p>
              )}
              <p className="text-sm text-gray-600 mb-6">
                You can now access shared medical records and collaborate with your family members.
              </p>

              {/* Success indicator */}
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Redirecting to family dashboard...
              </div>
            </div>
          </div>
        )}

        {/* Invalid/Expired State */}
        {state === "invalid" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              {/* Warning Icon */}
              <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Invite Link Not Valid
              </h1>
              <p className="text-sm text-gray-600 mb-4">
                This invite link is invalid or has expired.
              </p>
              <p className="text-xs text-gray-500 mb-6">
                Invite links expire after 10 minutes for security reasons.
              </p>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm"
                >
                  Go to Dashboard
                </button>
                <button
                  onClick={() => router.push("/family")}
                  className="w-full bg-white text-gray-700 font-medium py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                >
                  View Family Settings
                </button>
              </div>

              {/* Help Text */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">Need help?</span> Contact the family admin to request a new invite, or reach out to support if you believe this is a mistake.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              {/* Error Icon */}
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Something Went Wrong
              </h1>
              <p className="text-sm text-gray-600 mb-4">
                {errorMessage || "We encountered an issue processing your invite."}
              </p>
              <p className="text-xs text-gray-500 mb-6">
                Please try again or contact support if the problem persists.
              </p>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm"
                >
                  Try Again
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full bg-white text-gray-700 font-medium py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
