"use client";

import { useState } from "react";
import { Appointment } from "../data";
import { Clock, User2, Check, X } from "lucide-react";

interface UpcomingListProps {
  title: string;
  appointments: Appointment[];
  onViewDetails?: (id: string) => void;
  onMarkComplete?: (id: string) => void;
}

export default function UpcomingList({ title, appointments, onViewDetails, onMarkComplete }: UpcomingListProps) {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [localAppointments, setLocalAppointments] = useState(appointments);

  const statusStyles = {
    pending: "bg-yellow-50 text-yellow-700",
    upcoming: "bg-blue-50 text-blue-700",
    ongoing: "bg-yellow-50 text-yellow-700",
    completed: "bg-green-50 text-green-700",
    approved: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
  };

  const handleStatusUpdate = async (appointmentId: string, status: "approved" | "rejected") => {
    setLoadingStates((prev) => ({ ...prev, [appointmentId]: true }));

    try {
      const response = await fetch("/api/appointments/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, status }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to update appointment status");
        return;
      }

      // Optimistically update UI
      setLocalAppointments((prev) =>
        prev.map((apt) =>
          apt.id === appointmentId ? { ...apt, status: status as any } : apt
        )
      );

      // Show success message
      const message = status === "approved" 
        ? "Appointment approved successfully! Email sent to patient."
        : "Appointment rejected. Email sent to patient.";
      
      // You can replace this with a toast notification
      alert(message);

    } catch (error) {
      console.error("Failed to update appointment:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setLoadingStates((prev) => ({ ...prev, [appointmentId]: false }));
    }
  };

  // Update when prop changes
  if (appointments.length !== localAppointments.length) {
    setLocalAppointments(appointments);
  }

  if (localAppointments.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">{title}</h3>
        <p className="text-sm text-gray-500 text-center py-8">No appointments</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-base font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="space-y-3">
        {localAppointments.map((appointment) => {
          const isLoading = loadingStates[appointment.id];
          const isPending = appointment.status === "pending";
          const isApproved = appointment.status === "approved";
          const isRejected = appointment.status === "rejected";

          return (
            <div
              key={appointment.id}
              className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <User2 className="h-4 w-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-gray-900 truncate">
                    {appointment.patientName}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {appointment.age && appointment.age > 0 ? `${appointment.age} years` : "Age N/A"}, {appointment.gender || "N/A"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{appointment.appointmentTime}</span>
                </div>
                <span
                  className={`
                    px-2 py-0.5 rounded-full text-xs font-medium
                    ${statusStyles[appointment.status as keyof typeof statusStyles] || statusStyles.upcoming}
                  `}
                >
                  {isPending && "Pending"}
                  {isApproved && "Approved"}
                  {isRejected && "Rejected"}
                  {appointment.status === "upcoming" && "Upcoming"}
                  {appointment.status === "ongoing" && "Ongoing"}
                  {appointment.status === "completed" && "Done"}
                </span>
              </div>

              {/* Action Buttons - Only show for pending appointments */}
              {isPending && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleStatusUpdate(appointment.id, "approved")}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    {isLoading ? "Processing..." : "Approve"}
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(appointment.id, "rejected")}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <X className="h-4 w-4" />
                    {isLoading ? "Processing..." : "Deny"}
                  </button>
                </div>
              )}
              
              {/* View Details and Mark Complete buttons for approved/ongoing appointments */}
              {(isApproved || appointment.status === "upcoming" || appointment.status === "ongoing") && (
                <div className="flex gap-2 mt-3">
                  {onViewDetails && (
                    <button
                      onClick={() => onViewDetails(appointment.id)}
                      className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      View Details
                    </button>
                  )}
                  {onMarkComplete && appointment.status !== "completed" && (
                    <button
                      onClick={() => onMarkComplete(appointment.id)}
                      className="flex-1 px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
