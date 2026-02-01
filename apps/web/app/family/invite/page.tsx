"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function InviteFamilyPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sendInvite() {
    if (!email.trim()) {
      setStatus("error");
      setMessage("Please enter an email address");
      return;
    }

    setStatus("loading");
    setMessage("");

    const res = await fetch("/api/family/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {

    }

    if (!res.ok) {
      setStatus("error");
      setMessage(data?.error || `Failed to send invite. Please try again.`);
      return;
    }

    setStatus("success");
    setMessage("Invitation sent successfully! They will receive an email shortly.");
    setEmail("");
  }

  const isLoading = status === "loading";

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <Link 
          href="/family"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
          Back to Family
        </Link>
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Invite Family Member
          </h1>
          <p className="text-sm text-gray-600">
            Invite a family member to securely access shared medical records
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="space-y-6">
            {/* Email Input Section */}
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="member@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 disabled:bg-gray-50 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isLoading) {
                    sendInvite();
                  }
                }}
              />
              <p className="mt-2 text-xs text-gray-500">
                Invitation link expires in 10 minutes
              </p>
            </div>

            {/* Send Invite Button */}
            <button
              onClick={sendInvite}
              disabled={isLoading || !email.trim()}
              className="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 shadow-sm"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending Invite...
                </span>
              ) : (
                "Send Invite"
              )}
            </button>

            {/* Status Messages */}
            {status === "success" && message && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-green-800">{message}</p>
                </div>
              </div>
            )}

            {status === "error" && message && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-red-800">{message}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Family members will receive an email with instructions to join your health records group
          </p>
        </div>
      </div>
    </div>
  );
}
