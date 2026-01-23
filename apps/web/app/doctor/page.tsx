"use client";

import { useState, useEffect } from "react";
import Calendar from "./patients/components/Calendar";
import AppointmentCard from "./patients/components/AppointmentCard";
import UpcomingList from "./patients/components/UpcomingList";
import DoctorCodeDisplay from "@/components/DoctorCodeDisplay";
import GoogleCalendarConnect from "@/components/GoogleCalendarConnect";

interface Appointment {
  id: string;
  patientId?: string;
  patientName: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  appointmentTime: string;
  date: string;
  status: "pending" | "approved" | "rejected" | "upcoming" | "ongoing" | "completed";
  reason?: string;
  notes?: string;
}

export default function DoctorPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch appointments from backend
  useEffect(() => {
    async function fetchAppointments() {
      try {
        setLoading(true);
        const res = await fetch("/api/doctor/appointments");
        if (res.ok) {
          const data = await res.json();
          setAppointments(data.appointments || []);
        }
      } catch (error) {
        console.error("Failed to fetch appointments:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchAppointments();
  }, []);

  // Format date without timezone conversion to avoid day shifts
  const selectedDateString = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

  console.log('Selected date:', selectedDateString);
  console.log('All appointments:', appointments.map(a => ({ date: a.date, time: a.appointmentTime, name: a.patientName })));

  // Appointments for the selected date only (for schedule view)
  const todayAppointments = appointments.filter(
    (apt) => apt.date === selectedDateString
  );

  console.log('Filtered appointments for selected date:', todayAppointments.length);

  // ALL upcoming appointments across all dates (for sidebar) - include pending, approved, upcoming, and ongoing
  const allUpcomingAppointments = appointments.filter(
    (apt) => apt.status === "pending" || apt.status === "approved" || apt.status === "upcoming" || apt.status === "ongoing"
  );

  // Completed appointments only for selected date
  const completedAppointments = todayAppointments.filter(
    (apt) => apt.status === "completed"
  );

  const handleMarkComplete = async (id: string) => {
    try {
      const res = await fetch(`/api/doctor/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      if (res.ok) {
        setAppointments((prev) =>
          prev.map((apt) =>
            apt.id === id ? { ...apt, status: "completed" as const } : apt
          )
        );
      }
    } catch (error) {
      console.error("Failed to mark appointment as complete:", error);
    }
  };

  const handleViewDetails = (id: string) => {
    // Find the appointment to get the patientId
    const appointment = appointments.find(apt => apt.id === id);
    if (appointment?.patientId) {
      // Navigate to patient details page
      window.location.href = `/doctor/patient/${appointment.patientId}`;
    } else {
      console.error("Patient ID not found for appointment:", id);
      alert("Unable to view patient details. Patient information not available.");
    }
  };

  const timeSlots = [
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "01:00 PM",
    "02:00 PM",
    "03:00 PM",
    "04:00 PM",
    "05:00 PM",
    "06:00 PM",
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Patients</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your appointments and patient schedule
          </p>
        </div>

        {/* Doctor Code Display */}
        <DoctorCodeDisplay />

        {/* Google Calendar Integration */}
        <GoogleCalendarConnect />

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading appointments...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Section - Calendar & Appointments */}
            <div className="lg:col-span-2 space-y-6">
              {/* Calendar */}
              <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />

              {/* Time Slots & Appointments */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h2 className="text-base font-semibold text-gray-800 mb-4">
                  Schedule for {selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h2>

                {todayAppointments.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No appointments scheduled for this day</p>
                  </div>
                ) : (
                <div className="space-y-4">
                  {timeSlots.map((slot) => {
                    // Match appointments that start within this hour slot
                    // e.g., 09:00 AM slot should match 09:00 AM, 09:15 AM, 09:30 AM, 09:45 AM
                    const slotHour = slot; // e.g., "09:00 AM"
                    const slotAppointments = todayAppointments.filter((apt) => {
                      // Extract hour from slot and appointment time
                      const slotTime = slot.split(':')[0]; // "09"
                      const aptTime = apt.appointmentTime.split(':')[0]; // "09" from "09:30 AM"
                      const slotPeriod = slot.includes('AM') ? 'AM' : 'PM';
                      const aptPeriod = apt.appointmentTime.includes('AM') ? 'AM' : 'PM';
                      
                      return slotTime === aptTime && slotPeriod === aptPeriod;
                    });

                    return (
                      <div key={slot} className="flex gap-4">
                        <div className="w-24 flex-shrink-0 pt-2">
                          <span className="text-sm font-medium text-gray-600">
                            {slot}
                          </span>
                        </div>
                        <div className="flex-1">
                          {slotAppointments.length > 0 ? (
                            <div className="space-y-3">
                              {slotAppointments.map((apt) => (
                                <AppointmentCard
                                  key={apt.id}
                                  appointment={apt}
                                  onMarkComplete={handleMarkComplete}
                                  onViewDetails={handleViewDetails}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center">
                              <span className="text-xs text-gray-400">
                                No appointments
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Section - Lists */}
          <div className="space-y-6">
            <UpcomingList
              title="Upcoming Patients"
              appointments={allUpcomingAppointments}
              onViewDetails={handleViewDetails}
              onMarkComplete={handleMarkComplete}
            />
            <UpcomingList
              title="Patients Done Today"
              appointments={completedAppointments}
              onViewDetails={handleViewDetails}
            />
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
