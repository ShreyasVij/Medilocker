/**
 * Doctor Service
 * Handles all doctor-related API calls
 */

export interface DoctorProfile {
  phone?: string;
  dob?: string;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  profileImageUrl?: string;
  profileImageName?: string;
  location?: {
    hos?: string; // Hospital name
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface UpdateDoctorProfileData {
  phone?: string;
  dob?: string;
  gender?: string;
  hos?: string;
  city?: string;
  state?: string;
  country?: string;
  avatarUrl?: string;
  avatarFileName?: string;
}

export const doctorService = {
  /**
   * Fetch doctor profile
   */
  async fetchProfile(): Promise<{ profile: DoctorProfile | null; doctor: any }> {
    const res = await fetch("/api/doctor/profile");
    
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error("Not authorized as a doctor");
      }
      throw new Error("Failed to fetch doctor profile");
    }
    
    return await res.json();
  },

  /**
   * Update doctor profile
   */
  async updateProfile(profileData: UpdateDoctorProfileData): Promise<void> {
    const res = await fetch("/api/doctor/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileData),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update profile");
    }
  },

  /**
   * Upload profile avatar
   */
  async uploadAvatar(file: File): Promise<{ url: string; fileName: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/profile/avatar", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to upload avatar");
    }

    return await res.json();
  },
};
