/**
 * Appointment Service
 * Handles all appointment-related API calls
 */

export interface Appointment {
  id: string;
  patientName: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  appointmentTime: string;
  date: string;
  status: "pending" | "approved" | "rejected" | "upcoming" | "ongoing" | "completed";
  reason?: string;
  notes?: string;
  diagnosis?: string;
  prescription?: string;
}

export interface CreateAppointmentData {
  patientName: string;
  patientAge: number;
  patientGender: "Male" | "Female" | "Other";
  appointmentTime: string;
  date: string;
  duration?: number;
  reason?: string;
  notes?: string;
  patientId?: string;
}

export const appointmentService = {
  /**
   * Fetch all appointments for the logged-in doctor
   */
  async fetchAppointments(date?: string, status?: string): Promise<Appointment[]> {
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    if (status) params.append("status", status);

    const url = `/api/doctor/appointments${params.toString() ? `?${params}` : ""}`;
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error("Failed to fetch appointments");
    }
    
    const data = await res.json();
    return data.appointments || [];
  },

  /**
   * Create a new appointment
   */
  async createAppointment(appointmentData: CreateAppointmentData): Promise<string> {
    const res = await fetch("/api/doctor/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(appointmentData),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create appointment");
    }

    const data = await res.json();
    return data.appointmentId;
  },

  /**
   * Update appointment status or details
   */
  async updateAppointment(
    id: string,
    updates: {
      status?: "upcoming" | "ongoing" | "completed" | "cancelled";
      notes?: string;
      diagnosis?: string;
      prescription?: string;
    }
  ): Promise<void> {
    const res = await fetch(`/api/doctor/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      throw new Error("Failed to update appointment");
    }
  },

  /**
   * Delete/cancel an appointment
   */
  async deleteAppointment(id: string): Promise<void> {
    const res = await fetch(`/api/doctor/appointments/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error("Failed to delete appointment");
    }
  },

  /**
   * Mark appointment as completed
   */
  async markComplete(id: string): Promise<void> {
    return this.updateAppointment(id, { status: "completed" });
  },

  /**
   * Mark appointment as ongoing
   */
  async markOngoing(id: string): Promise<void> {
    return this.updateAppointment(id, { status: "ongoing" });
  },
};
