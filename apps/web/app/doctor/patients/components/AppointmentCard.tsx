"use client";

import { Appointment } from "../data";
import { Clock, User2 } from "lucide-react";

interface AppointmentCardProps {
  appointment: Appointment;
  onMarkComplete?: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

export default function AppointmentCard({
  appointment,
  onMarkComplete,
  onViewDetails,
}: AppointmentCardProps) {
  const statusStyles = {
    upcoming: "bg-blue-50 text-blue-700 border-blue-200",
    ongoing: "bg-yellow-50 text-yellow-700 border-yellow-200",
    completed: "bg-green-50 text-green-700 border-green-200",
  };

  const statusLabels = {
    upcoming: "Upcoming",
    ongoing: "Ongoing",
    completed: "Completed",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <User2 className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{appointment.patientName}</h4>
            <p className="text-sm text-gray-500">
              {appointment.age} years, {appointment.gender}
            </p>
          </div>
        </div>
        <span
          className={`
            px-2.5 py-1 rounded-full text-xs font-medium border
            ${statusStyles[appointment.status]}
          `}
        >
          {statusLabels[appointment.status]}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
        <Clock className="h-4 w-4" />
        <span>{appointment.appointmentTime}</span>
      </div>

      {appointment.reason && (
        <p className="text-sm text-gray-600 mb-3">{appointment.reason}</p>
      )}

      <div className="flex gap-2">
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(appointment.id)}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
          >
            View Details
          </button>
        )}
        {appointment.status !== "completed" && onMarkComplete && (
          <button
            onClick={() => onMarkComplete(appointment.id)}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
          >
            Mark Complete
          </button>
        )}
      </div>
    </div>
  );
}
