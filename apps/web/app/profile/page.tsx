"use client";

import { useSession } from "next-auth/react";
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

  // Hydrate form from saved profile on load
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile", { method: "GET" });
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
        } catch {}
      } else {
        // If no file selected, cleanup any stale preview or modal
        if (confirmPreviewUrl) {
          try { URL.revokeObjectURL(confirmPreviewUrl); } catch {}
          setConfirmPreviewUrl("");
        }
        setConfirmOpen(false);
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
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <h1 className="mb-4 text-xl font-semibold text-gray-800">
        Profile Settings
      </h1>

      {!session ? (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
          You're not signed in.{" "}
          <Link href="/auth" className="font-medium underline">
            Go to login
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="space-y-6 p-4">

            {/* BASIC INFO */}
            <Section title="Basic Information">
              <Input label="Name" name="name" value={form.name} onChange={handleChange} />
              <Input label="Email" name="email" value={form.email} onChange={handleChange} />
              <Input label="Phone Number" name="phone" value={form.phone} onChange={handleChange} />
              <Input label="Date of Birth" type="date" name="dob" value={form.dob} onChange={handleChange} />
              <Input
                label="Add Profile Picture"
                type="file"
                name="profileImage"
                accept="image/*"
                onChange={handleChange}
              />
              {/* Remove static filename label; show preview only after successful upload */}
              {form.profileImagePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.profileImagePreviewUrl} alt="Profile" className="h-10 w-10 rounded-full object-cover border" />
              ) : null}
              <Select
                label="Gender"
                name="gender"
                value={form.gender}
                onChange={handleChange}
                options={["Male", "Female", "Other", "Prefer not to say"]}
              />
            </Section>

            {/* MEDICAL */}
            <Section title="Medical Information">
              <Select
                label="Blood Group"
                name="bloodGroup"
                value={form.bloodGroup}
                onChange={handleChange}
                options={["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]}
              />
              <Input label="Allergies" name="allergies" value={form.allergies} onChange={handleChange} />
              <Input label="Chronic Conditions" name="conditions" value={form.conditions} onChange={handleChange} />
              <Input label="Current Medications" name="medications" value={form.medications} onChange={handleChange} />
            </Section>

            {/* EMERGENCY */}
            <Section title="Emergency Contact">
              <Input label="Contact Name" name="emergencyName" value={form.emergencyName} onChange={handleChange} />
              <Input label="Contact Phone" name="emergencyPhone" value={form.emergencyPhone} onChange={handleChange} />
              <Input label="Relationship" name="relationship" value={form.relationship} onChange={handleChange} />
            </Section>

            {/* LOCATION */}
            <Section title="Location">
              <Input label="City" name="city" value={form.city} onChange={handleChange} />
              <Input label="State" name="state" value={form.state} onChange={handleChange} />
              <Input label="Country" name="country" value={form.country} onChange={handleChange} />
            </Section>

            {/* ACCOUNT */}
            <Section title="Account">
              <Input
                label="Primary Role"
                value={(session.user as any)?.roles?.[0] || "patient"}
                readOnly
              />
            </Section>

            <button
              onClick={handleSave}
              className="w-full rounded-md bg-blue-600 py-2 text-white font-medium hover:bg-blue-700"
            >
              Save Profile
            </button>

            {/* Delete Profile Section */}
            <div className="mt-8 pt-8 border-t border-red-200">
              <h2 className="text-sm font-semibold text-red-700 mb-2">Danger Zone</h2>
              <p className="text-sm text-gray-600 mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="w-full rounded-md bg-red-600 py-2 text-white font-medium hover:bg-red-700 transition-colors"
              >
                Delete Profile Permanently
              </button>
            </div>

            <p className="text-sm text-gray-500">
              Additional settings will appear here.
            </p>

          </div>
        </div>
      )}
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
