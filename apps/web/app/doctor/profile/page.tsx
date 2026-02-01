"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import LocationPinMap from "@/components/LocationPinMap";

export default function ProfilePage() {
  const { data: session, status } = useSession();

  const [mounted, setMounted] = useState(false);
  
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    bloodGroup: "",
    allergies: "",
    conditions: "",
    medications: "",
    emergencyName: "",
    emergencyPhone: "",
    relationship: "",
    address:"",
    latitude: 0,
    longitude: 0,
    city: "",
    state: "",
    country: "India",
    profileImage: null as File | null,
    profileImageName: "",
    profileImagePreviewUrl: "",
    role:"Doctor"
  });

  const [showLocationMap, setShowLocationMap] = useState(false);
  const [bannerColor, setBannerColor] = useState('bg-white');
  const [userMetadata, setUserMetadata] = useState({
    verified: true,
    joinedDate: new Date().toLocaleDateString(),
    status: 'Active'
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPreviewUrl, setConfirmPreviewUrl] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (session?.user) {
      setForm((prev) => ({
        ...prev,
        name: session.user.name || "",
        email: session.user.email || "",
      }));
    }
  }, [session]);

  // Hydrate form from saved profile on load
  useEffect(() => {
    async function loadProfile() {
      try {
        // First, ensure user has doctor role
        const registerRes = await fetch("/api/doctor/register", { method: "POST" });
        if (!registerRes.ok) {
          console.warn("Failed to register as doctor");
        }

        // Load doctor profile from doctor-specific API
        const res = await fetch("/api/doctor/profile", { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        const p = data?.profile;
        if (!p) return;

        setForm((prev) => ({
          ...prev,
          phone: p.phone ?? "",
          dob: p.dob ? new Date(p.dob).toISOString().slice(0, 10) : "",
          gender: genderEnumToLabel(p.gender),
          profileImageName: p.profileImageName ?? "",
          address: p.location?.hos ?? "",
          latitude: p.location?.latitude ?? 0,
          longitude: p.location?.longitude ?? 0,
          city: p.location?.city ?? "",
          state: p.location?.state ?? "",
          country: p.location?.country ?? prev.country,
        }));
      } catch {
        // noop: leave form as-is if fetch fails
      }
    }
    if (status === "authenticated") {
      loadProfile();
    }
  }, [status]);

  // Extract dominant color from image
  const extractDominantColor = (imageUrl: string) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let r = 0, g = 0, b = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      
      const pixelCount = data.length / 4;
      r = Math.floor(r / pixelCount);
      g = Math.floor(g / pixelCount);
      b = Math.floor(b / pixelCount);
      
      // Create a lighter and darker version for gradient
      const lighterR = Math.min(255, r + 40);
      const lighterG = Math.min(255, g + 40);
      const lighterB = Math.min(255, b + 40);
      
      const darkerR = Math.max(0, r - 40);
      const darkerG = Math.max(0, g - 40);
      const darkerB = Math.max(0, b - 40);
      
      setBannerColor(`linear-gradient(to right, rgb(${lighterR}, ${lighterG}, ${lighterB}), rgb(${darkerR}, ${darkerG}, ${darkerB}))`);    };
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="text-lg text-gray-600">Loading...</div>
          </div>
        </div>
      </div>
    );
  }


  function genderEnumToLabel(g?: string | null): string {
    switch ((g || "").toLowerCase()) {
      case "male":
        return "Male";
      case "female":
        return "Female";
      case "other":
        return "Other";
      case "prefer_not_to_say":
        return "Prefer not to say";
      default:
        return "";
    }
  }

  const handleDeleteProfile = async () => {
    try {
      setDeleting(true);
      const res = await fetch("/api/doctor/profile/delete", { method: "DELETE" });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete profile");
        return;
      }

      alert("Your doctor profile and all associated data have been permanently deleted. You will now be signed out.");
      // Sign out and redirect to home
      window.location.href = "/auth";
    } catch (error) {
      console.error("Failed to delete profile:", error);
      alert("An error occurred while deleting your profile. Please try again.");
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleChange = (e: any) => {
    const { name, value, files } = e.target;

    if (name === "profileImage") {
      const file = files?.[0] || null;
      setForm((prev) => ({
        ...prev,
        profileImage: file,
        profileImageName: file?.name || "",
      }));
      // Trigger immediate confirm modal with preview
      if (file) {
        try {
          const objUrl = URL.createObjectURL(file);
          setConfirmPreviewUrl(objUrl);
          setConfirmOpen(true);
          // Extract color from new image
          extractDominantColor(objUrl);
        } catch {}
      } else {
        // If no file selected, cleanup any stale preview or modal
        if (confirmPreviewUrl) {
          try { URL.revokeObjectURL(confirmPreviewUrl); } catch {}
          setConfirmPreviewUrl("");
        }
        setConfirmOpen(false);
        setBannerColor('bg-white');
      }
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLocationSelect = (location: {
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    setForm((prev) => ({
      ...prev,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
    }));
  };

  const handleSave = async () => {
    // If a new image is selected, ask for confirmation first
    if (form.profileImage) {
      const objUrl = URL.createObjectURL(form.profileImage);
      setConfirmPreviewUrl(objUrl);
      setConfirmOpen(true);
      return;
    }

    return saveProfileConfirmed();
  };

  const saveProfileConfirmed = async () => {
    let avatarUrl: string | undefined = undefined;
    let avatarFileName: string | undefined = form.profileImage?.name || form.profileImageName || undefined;
    try {
      if (form.profileImage) {
        const fd = new FormData();
        fd.append("file", form.profileImage);
        const up = await fetch("/api/profile/avatar", { method: "POST", body: fd });
        if (up.ok) {
          const data = await up.json();
          avatarUrl = data?.url || undefined;
          avatarFileName = form.profileImage?.name || avatarFileName;
          setForm((prev) => ({ ...prev, profileImagePreviewUrl: avatarUrl || prev.profileImagePreviewUrl }));
          // Notify navbar to refresh avatar
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("profile:updated"));
          }
          // For avatar-only update, we don't require a full profile save
          alert("Profile picture updated");
          setForm((prev) => ({ ...prev, profileImage: null }));
          // Clean up modal state
          if (confirmPreviewUrl) {
            try { URL.revokeObjectURL(confirmPreviewUrl); } catch {}
            setConfirmPreviewUrl("");
          }
          setConfirmOpen(false);
          return;
        } else {
          let errMsg = "Failed to upload profile picture";
          try { const e = await up.json(); errMsg = e?.error || errMsg; } catch {}
          alert(errMsg);
          return; // stop save if upload failed
        }
      }

      const res = await fetch("/api/doctor/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          profileImage: undefined, // don't send File in JSON
          avatarUrl,
          avatarFileName,
        }),
      });

      if (res.ok) {
        alert("Profile saved");
        setForm((prev) => ({ ...prev, profileImage: null }));
        // Ensure navbar reflects latest
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("profile:updated"));
        }
      } else {
        alert("Failed to save profile");
      }
    } catch (e) {
      alert("Unexpected error saving profile");
    }
      // Clean up any temporary preview URL we created when modal used
      if (confirmPreviewUrl) {
        try { URL.revokeObjectURL(confirmPreviewUrl); } catch {}
        setConfirmPreviewUrl("");
      }
      setConfirmOpen(false);
  };



  if (status === "loading") {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6 text-sm text-gray-500">
        Loading profile...
      </div>
    );
  }



  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Doctor Profile</h1>
            <p className="text-gray-600 mt-1">Manage your doctor profile, verification, and account settings.</p>
          </div>

          {!session ? (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
              You're not signed in.{" "}
              <Link href="/auth" className="font-medium underline">
                Go to login
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT COLUMN - DOCTOR SUMMARY CARD */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Banner */}
                  <div 
                    className="h-24"
                    style={{ background: bannerColor.includes('gradient') ? bannerColor : 'white' }}
                  ></div>
                  
                  {/* Doctor Info */}
                  <div className="px-6 pb-6">
                    {/* Avatar */}
                    <div className="flex justify-center -mt-12 mb-4">
                      <div className="relative">
                        {form.profileImagePreviewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={form.profileImagePreviewUrl} 
                            alt="Profile" 
                            className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-lg" 
                          />
                        ) : (
                          <div className="h-24 w-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center">
                            <span className="text-4xl font-semibold text-gray-400">
                              {form.name ? form.name.charAt(0).toUpperCase() : "D"}
                            </span>
                          </div>
                        )}
                        <label 
                          htmlFor="doctorProfileImageUpload" 
                          className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md cursor-pointer hover:bg-gray-50 transition-colors"
                          title="Edit Profile"
                        >
                          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          <input
                            id="doctorProfileImageUpload"
                            type="file"
                            name="profileImage"
                            accept="image/*"
                            onChange={handleChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Name & Email */}
                    <div className="text-center mb-4">
                      <h2 className="text-xl font-bold text-gray-900">{form.name || "Doctor"}</h2>
                      <p className="text-sm text-gray-600 mt-1">{form.email}</p>
                    </div>

                    {/* Badges */}
                    <div className="flex gap-2 justify-center mb-6">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        Doctor
                      </span>
                      {userMetadata.verified && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Verified
                        </span>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-200 mb-4"></div>

                    {/* Metadata */}
                    <div className="space-y-3">
                      <div className="flex items-center text-sm">
                        <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-gray-500 flex-1">Joined</span>
                        <span className="font-medium text-gray-700">{userMetadata.joinedDate || "..."}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-gray-500 flex-1">Status</span>
                        <span className="inline-flex items-center">
                          <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                          <span className="font-medium text-green-700">{userMetadata.status}</span>
                        </span>
                      </div>
                      {form.address && (
                        <div className="flex items-center text-sm">
                          <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="text-gray-500 flex-1">Clinic/Hospital</span>
                          <span className="font-medium text-gray-700">{form.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN - INFORMATION CARDS */}
              <div className="lg:col-span-2 space-y-6">
                {/* Personal Information Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center mb-6">
                    <svg className="w-5 h-5 text-gray-700 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-6">Update your personal details and contact information.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label="Full Name" name="name" value={form.name} onChange={handleChange} />
                    <Input label="Email Address" name="email" value={form.email} onChange={handleChange} />
                    <Input label="Phone Number" name="phone" value={form.phone} onChange={handleChange} />
                    <Input label="Date of Birth" type="date" name="dob" value={form.dob} onChange={handleChange} />
                    <Select
                      label="Gender"
                      name="gender"
                      value={form.gender}
                      onChange={handleChange}
                      options={["Male", "Female", "Other", "Prefer not to say"]}
                    />
                  </div>
                </div>

            {/* LOCATION */}
            <Section title="Work Location">
              <div className="col-span-1 sm:col-span-2 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Clinic/Hospital Address
                  </label>
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="e.g., 123 Main Street, Suite 100, Chandigarh"
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                               focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Or use the map below to pinpoint your location</p>
                </div>

                {!showLocationMap && (
                  <button
                    type="button"
                    onClick={() => setShowLocationMap(true)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition"
                  >
                    📍 Pinpoint Location on Map
                  </button>
                )}

                {showLocationMap && (
                  <div className="space-y-3">
                    <LocationPinMap
                      onLocationSelect={handleLocationSelect}
                      initialLat={form.latitude || undefined}
                      initialLng={form.longitude || undefined}
                      initialAddress={form.address || undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLocationMap(false)}
                      className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium transition"
                    >
                      Hide Map
                    </button>
                  </div>
                )}

                {form.latitude !== 0 && form.longitude !== 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 text-xs text-green-800">
                    ✓ Location pinned: ({form.latitude.toFixed(6)}, {form.longitude.toFixed(6)})
                  </div>
                )}
              </div>
            </Section>

                {/* Account Information Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center mb-6">
                    <svg className="w-5 h-5 text-gray-700 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-6">View your account role and settings.</p>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <Input
                      label="Primary Role"
                      value={(session.user as any)?.roles?.[0] || "Doctor"}
                      readOnly
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    Save Profile
                  </button>
                </div>

                {/* Delete Profile Section */}
                <div className="bg-red-50 rounded-xl border border-red-200 p-6">
                  <div className="flex items-center mb-4">
                    <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
                  </div>
                  <p className="text-sm text-red-700 mb-4">
                    Permanently delete your doctor account and all associated data. This action cannot be undone.
                  </p>
                  <button
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    Delete Doctor Profile Permanently
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm modal for profile image upload */}
      <ConfirmModal
        open={confirmOpen}
        title="Confirm Profile Picture"
        description="Upload this image as your profile picture?"
        imageUrl={confirmPreviewUrl || undefined}
        fileName={form.profileImage?.name || form.profileImageName || ""}
        confirmText="Upload & Save"
        cancelText="Cancel"
        onConfirm={() => {
          saveProfileConfirmed();
        }}
        onCancel={() => {
          if (confirmPreviewUrl) {
            try { URL.revokeObjectURL(confirmPreviewUrl); } catch {}
            setConfirmPreviewUrl("");
          }
          setConfirmOpen(false);
        }}
      />
      
      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-red-700 mb-3">Delete Doctor Profile Permanently?</h3>
            <p className="text-sm text-gray-700 mb-4">
              This will permanently delete:
            </p>
            <ul className="text-sm text-gray-600 mb-4 list-disc list-inside space-y-1">
              <li>Your doctor account and profile</li>
              <li>All appointments with patients</li>
              <li>All doctor-patient notes</li>
              <li>Doctor files and documents</li>
              <li>Sessions and audit logs</li>
              <li>All other associated data</li>
            </ul>
            <p className="text-sm font-semibold text-red-600 mb-6">
              ⚠️ This action cannot be undone!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProfile}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ================= REUSABLE COMPONENTS ================= */

const Section = ({ title, children }: any) => (
  <div className="space-y-4">
    <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {children}
    </div>
  </div>
);

const Input = ({ label, ...props }: any) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <input
      {...props}
      className="rounded-md border border-gray-300 px-3 py-2 text-sm
                 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500
                 disabled:bg-gray-100 disabled:text-gray-600"
    />
  </div>
);

const Select = ({ label, options, ...props }: any) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <select
      {...props}
      className="rounded-md border border-gray-300 px-3 py-2 text-sm
                 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Select</option>
      {options.map((opt: string) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </div>
);
