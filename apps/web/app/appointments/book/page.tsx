"use client";

import { useState } from "react";
import { Search, Calendar, Clock, MapPin, Award, Navigation } from "lucide-react";
import HospitalMap from "@/components/HospitalMap";
import { Hospital } from "@/services/hospitalService";

interface DoctorInfo {
  id: string;
  name: string;
  email: string;
  specialization: string;
  hospital: string;
  city?: string;
  state?: string;
  country: string;
  profileImageUrl?: string;
}

export default function BookAppointmentPage() {
  const [doctorCode, setDoctorCode] = useState("");
  const [doctor, setDoctor] = useState<DoctorInfo | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  
  // Booking form state
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [reason, setReason] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  
  // Hospital map state
  const [selectedHospital, setSelectedHospital] = useState<(Hospital & { distance?: number }) | null>(null);
  const [showMap, setShowMap] = useState(false);

  const handleSearchDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDoctor(null);
    setBookingSuccess(false);

    if (!doctorCode.trim()) {
      setError("Please enter a doctor code");
      return;
    }

    setSearching(true);

    try {
      const res = await fetch("/api/doctor/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: doctorCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to search doctor");
        return;
      }

      setDoctor(data.doctor);
    } catch (err) {
      setError("Failed to search doctor. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBooking(true);

    if (!appointmentDate || !appointmentTime) {
      setError("Please select both date and time");
      setBooking(false);
      return;
    }

    try {
      const res = await fetch("/api/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: doctor!.id,
          date: appointmentDate,
          time: appointmentTime,
          reason: reason || "General consultation",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to book appointment");
        return;
      }

      setBookingSuccess(true);
      // Reset booking form
      setAppointmentDate("");
      setAppointmentTime("");
      setReason("");
    } catch (err) {
      setError("Failed to book appointment. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  // Generate time slots
  const timeSlots = [
    "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
    "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
    "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Book an Appointment
          </h1>
          <p className="text-gray-600 text-sm mb-6">
            Enter your doctor's unique 16-character code to get started
          </p>

          {/* Doctor Search Form */}
          <form onSubmit={handleSearchDoctor} className="mb-6">
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Enter 16-character doctor code (e.g., ABCD-EFGH-IJKL-MNOP)"
                  value={doctorCode}
                  onChange={(e) => setDoctorCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={19} // 16 chars + 3 hyphens
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Search className="h-5 w-5" />
                {searching ? "Searching..." : "Search"}
              </button>
            </div>
          </form>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {bookingSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              <p className="font-semibold">✅ Appointment booked successfully!</p>
              <p className="text-sm mt-1">
                Your medical files have been shared with Dr. {doctor?.name}. You'll receive a confirmation shortly.
              </p>
            </div>
          )}

          {/* Doctor Profile Card */}
          {doctor && (
            <div className="border border-gray-200 rounded-lg p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-start gap-4 mb-6">
                {doctor.profileImageUrl ? (
                  <img
                    src={doctor.profileImageUrl}
                    alt={doctor.name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                    {doctor.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">{doctor.name}</h2>
                  <div className="flex items-center gap-2 text-gray-600 mt-1">
                    <Award className="h-4 w-4" />
                    <span className="font-medium">{doctor.specialization}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 mt-1">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {doctor.hospital}
                      {doctor.city && `, ${doctor.city}`}
                      {doctor.state && `, ${doctor.state}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Book Your Appointment
                </h3>
                
                <form onSubmit={handleBookAppointment} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="inline h-4 w-4 mr-1" />
                        Select Date
                      </label>
                      <input
                        type="date"
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Clock className="inline h-4 w-4 mr-1" />
                        Select Time
                      </label>
                      <select
                        value={appointmentTime}
                        onChange={(e) => setAppointmentTime(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Choose a time</option>
                        {timeSlots.map((slot) => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for Visit (Optional)
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Describe your symptoms or reason for consultation"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={booking}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                  >
                    {booking ? "Booking..." : "Confirm Appointment"}
                  </button>
                </form>

                <p className="text-xs text-gray-500 mt-4">
                  ℹ️ Your medical records will be automatically shared with the doctor upon booking.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Hospital & Clinic Finder Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Navigation className="h-5 w-5 text-blue-600" />
                Find Nearby Hospitals & Clinics
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Locate healthcare facilities near you in Chandigarh
              </p>
            </div>
            <button
              onClick={() => setShowMap(!showMap)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              {showMap ? "Hide Map" : "Show Map"}
            </button>
          </div>

          {selectedHospital && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-gray-900">{selectedHospital.name}</h3>
              <p className="text-sm text-gray-600 mt-1">
                <MapPin className="inline h-4 w-4 mr-1" />
                {selectedHospital.location}
              </p>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-gray-600">
                  Type: {selectedHospital.type === 'hospital' ? '🏥 Hospital' : '⚕️ Clinic'}
                </span>
                {selectedHospital.distance && (
                  <span className="text-blue-600 font-medium">
                    {selectedHospital.distance.toFixed(2)} km away
                  </span>
                )}
              </div>
              {selectedHospital.specialties && (
                <p className="text-sm text-gray-500 mt-2">
                  Specialties: {selectedHospital.specialties.join(', ')}
                </p>
              )}
            </div>
          )}

          {showMap && (
            <div className="h-[500px] rounded-lg overflow-hidden border border-gray-200">
              <HospitalMap
                showNearbyOnly={true}
                radiusKm={10}
                onHospitalSelect={setSelectedHospital}
              />
            </div>
          )}

          {!showMap && (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Click "Show Map" to find hospitals and clinics near you</p>
              <p className="text-sm text-gray-500 mt-1">Uses your GPS location to show nearby facilities</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
