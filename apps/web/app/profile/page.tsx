"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import ConfirmModal from "../../components/ui/ConfirmModal";

export default function ProfilePage() {
  const { data: session, status } = useSession();

  /* ================= FORM STATE ================= */

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
    city: "",
    state: "",
    country: "India",
    profileImage: null as File | null,
    profileImageName: "",
    profileImagePreviewUrl: "",
    role:"User"
  });

  const [userMetadata, setUserMetadata] = useState({
    joinedDate: "",
    status: "Active",
    verified: false
  });

  const [bannerColor, setBannerColor] = useState("bg-white");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPreviewUrl, setConfirmPreviewUrl] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);


  useEffect(() => {
    if (session?.user) {
      setForm((prev) => ({
        ...prev,
        name: session.user.name || "",
        email: session.user.email || "",
      }));
    }
  }, [session]);

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
      
      setBannerColor(`linear-gradient(to right, rgb(${lighterR}, ${lighterG}, ${lighterB}), rgb(${darkerR}, ${darkerG}, ${darkerB}))`);
    };
  };

  // Map backend enum to UI label
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
      const res = await fetch("/api/profile/delete", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete profile");
        return;
      }
      alert("Your profile and all associated data have been permanently deleted. You will now be signed out.");
      // Sign out and redirect to home, clearing auth/session
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      console.error("Failed to delete profile:", error);
      alert("An error occurred while deleting your profile. Please try again.");
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  // Hydrate form from saved profile on load
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile", { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        const p = data?.profile;
        const user = data?.user;
        
        if (p) {
          setForm((prev) => ({
            ...prev,
            phone: p.phone ?? "",
            dob: p.dob ? new Date(p.dob).toISOString().slice(0, 10) : "",
            gender: genderEnumToLabel(p.gender),
            profileImageName: p.profileImageName ?? "",
            profileImagePreviewUrl: p.profileImageUrl ?? "",
            bloodGroup: p.medical?.bloodGroup ?? "",
            allergies: p.medical?.allergies ?? "",
            conditions: p.medical?.conditions ?? "",
            medications: p.medical?.medications ?? "",
            emergencyName: p.emergency?.name ?? "",
            emergencyPhone: p.emergency?.phone ?? "",
            relationship: p.emergency?.relationship ?? "",
            city: p.location?.city ?? "",
            state: p.location?.state ?? "",
            country: p.location?.country ?? prev.country,
          }));
          
          // Extract color from existing profile image
          if (p.profileImageUrl) {
            extractDominantColor(p.profileImageUrl);
          } else {
            setBannerColor('bg-white');
          }
        }

        if (user) {
          setUserMetadata({
            joinedDate: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            }) : "",
            status: user.status === "active" ? "Active" : user.status || "Active",
            verified: !!user.googleSub
          });
        }
      } catch {
        // noop: leave form as-is if fetch fails
      }
    }
    if (status === "authenticated") {
      loadProfile();
    }
  }, [status]);



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

      const res = await fetch("/api/profile", {
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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600 mt-1">Manage your profile, verification, and account settings.</p>
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
            {/* LEFT COLUMN - USER SUMMARY CARD */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Banner */}
                <div 
                  className="h-24"
                  style={{ background: bannerColor.includes('gradient') ? bannerColor : 'white' }}
                ></div>
                
                {/* User Info */}
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
                            {form.name ? form.name.charAt(0).toUpperCase() : "U"}
                          </span>
                        </div>
                      )}
                      <label 
                        htmlFor="profileImageUpload" 
                        className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md cursor-pointer hover:bg-gray-50 transition-colors"
                        title="Edit Profile"
                      >
                        <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <input
                          id="profileImageUpload"
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
                    <h2 className="text-xl font-bold text-gray-900">{form.name || "User"}</h2>
                    <p className="text-sm text-gray-600 mt-1">{form.email}</p>
                  </div>

                  {/* Badges */}
                  <div className="flex gap-2 justify-center mb-6">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {(session.user as any)?.roles?.[0]?.charAt(0).toUpperCase() + (session.user as any)?.roles?.[0]?.slice(1) || "User"}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-200 mb-4"></div>

                  {/* Metadata (User ID removed) */}
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
                  <ModernInput label="Full Name" name="name" value={form.name} onChange={handleChange} />
                  <ModernInput label="Email Address" name="email" value={form.email} onChange={handleChange} />
                  <ModernInput label="Phone Number" name="phone" value={form.phone} onChange={handleChange} />
                  <ModernInput label="Date of Birth" type="date" name="dob" value={form.dob} onChange={handleChange} />
                  <ModernSelect
                    label="Gender"
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    options={["Male", "Female", "Other", "Prefer not to say"]}
                  />
                  <ModernSelect
                    label="Blood Group"
                    name="bloodGroup"
                    value={form.bloodGroup}
                    onChange={handleChange}
                    options={["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]}
                  />
                </div>
              </div>

              {/* Medical Information Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center mb-6">
                  <svg className="w-5 h-5 text-gray-700 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Medical Information</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6">Manage your health information and medical history.</p>
                
                <div className="space-y-6">
                  <ModernTextarea label="Allergies" name="allergies" value={form.allergies} onChange={handleChange} placeholder="List any allergies..." />
                  <ModernTextarea label="Chronic Conditions" name="conditions" value={form.conditions} onChange={handleChange} placeholder="List any chronic conditions..." />
                  <ModernTextarea label="Current Medications" name="medications" value={form.medications} onChange={handleChange} placeholder="List current medications..." />
                </div>
              </div>

              {/* Emergency Contact Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center mb-6">
                  <svg className="w-5 h-5 text-gray-700 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Emergency Contact</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6">Provide emergency contact details for urgent situations.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ModernInput label="Contact Name" name="emergencyName" value={form.emergencyName} onChange={handleChange} />
                  <ModernInput label="Contact Phone" name="emergencyPhone" value={form.emergencyPhone} onChange={handleChange} />
                  <ModernInput label="Relationship" name="relationship" value={form.relationship} onChange={handleChange} className="md:col-span-2" />
                </div>
              </div>

              {/* Location Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center mb-6">
                  <svg className="w-5 h-5 text-gray-700 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Location</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6">Update your location information.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <ModernInput label="City" name="city" value={form.city} onChange={handleChange} />
                  <ModernInput label="State" name="state" value={form.state} onChange={handleChange} />
                  <ModernInput label="Country" name="country" value={form.country} onChange={handleChange} />
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Save Profile
              </button>

              {/* Delete Profile Section */}
              <div className="bg-red-50 rounded-xl border border-red-200 p-6">
                <h3 className="text-sm font-semibold text-red-700 mb-2">Danger Zone</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <button
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="w-full bg-red-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Profile Permanently
                </button>
              </div>
            </div>
          </div>
        )}
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
            <h3 className="text-lg font-semibold text-red-700 mb-3">Delete Profile Permanently?</h3>
            <p className="text-sm text-gray-700 mb-4">
              This will permanently delete:
            </p>
            <ul className="text-sm text-gray-600 mb-4 list-disc list-inside space-y-1">
              <li>Your user account and profile</li>
              <li>All uploaded documents</li>
              <li>All OCR data and summaries</li>
              <li>Health scores and trends</li>
              <li>Timeline entries and vitals</li>
              <li>All appointments</li>
              <li>Emergency tokens and settings</li>
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
    </div>
  );
}

/* ================= MODERN STYLED COMPONENTS ================= */

const ModernInput = ({ label, icon, className = "", ...props }: any) => (
  <div className={`flex flex-col gap-2 ${className}`}>
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {icon}
        </div>
      )}
      <input
        {...props}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                   focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20
                   disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
                   transition-colors ${icon ? "pl-11" : ""}`}
      />
    </div>
  </div>
);

const ModernSelect = ({ label, options, className = "", ...props }: any) => (
  <div className={`flex flex-col gap-2 ${className}`}>
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <select
      {...props}
      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20
                 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
                 transition-colors bg-white"
    >
      <option value="" disabled>Select</option>
      {options.map((opt: string) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </div>
);

const ModernTextarea = ({ label, className = "", ...props }: any) => (
  <div className={`flex flex-col gap-2 ${className}`}>
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <textarea
      {...props}
      rows={3}
      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20
                 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
                 transition-colors resize-none"
    />
  </div>
);
