import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import type { DoctorDocument } from "@db/doctors";

/**
 * GET /api/doctors/with-locations
 * Get all doctors from our database that have location data
 */
export async function GET() {
  try {
    const doctors = await getCollection<DoctorDocument>("doctors");

    // Get all active doctors with location data
    const allDoctors = await doctors
      .find({
        "profile.location.hos": { $exists: true, $ne: null },
        $or: [
          { status: "active" },
          { status: { $exists: false } },
        ],
      })
      .toArray();

    // Map to location data format
    const doctorLocations = allDoctors
      .filter(doc => doc.doctorCode && doc.profile?.location) // Only doctors with codes and locations
      .map((doc) => ({
        id: doc._id.toString(),
        name: doc.name,
        doctorCode: doc.doctorCode,
        specialization: doc.profile?.specialization || "General Practice",
        profileImageUrl: doc.profile?.profileImageUrl,
        location: {
          hos: doc.profile.location.hos,
          city: doc.profile.location.city,
          state: doc.profile.location.state,
          country: doc.profile.location.country || "India",
          latitude: doc.profile.location.latitude,
          longitude: doc.profile.location.longitude,
        },
      }));

    console.log(`[DOCTORS_WITH_LOCATIONS] Found ${doctorLocations.length} doctors`);

    return NextResponse.json({
      success: true,
      doctors: doctorLocations,
    });
  } catch (err) {
    console.error("[DOCTORS_WITH_LOCATIONS_ERROR]", err);
    return NextResponse.json(
      { error: "Failed to fetch doctors" },
      { status: 500 }
    );
  }
}
