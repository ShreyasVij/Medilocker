import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCollection } from "@/lib/db";
import type { DoctorDocument } from "@db/doctors";
import { validateDoctorCode, normalizeDoctorCode } from "@db/utils";

/**
 * POST /api/doctor/search
 * Search for a doctor using their unique 16-character code
 * 
 * Request Body:
 * {
 *   code: string (16 alphanumeric characters)
 * }
 * 
 * Response:
 * - 200: Doctor found with profile details
 * - 400: Invalid code format
 * - 404: Doctor not found
 * - 401: Unauthorized
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { code } = body;

    // Validate code format
    if (!validateDoctorCode(code)) {
      return NextResponse.json(
        { error: "Invalid doctor code. Must be exactly 16 alphanumeric characters." },
        { status: 400 }
      );
    }

    // Normalize code (remove hyphens, uppercase)
    const normalizedCode = normalizeDoctorCode(code);

    // Search for doctor by code
    const doctors = await getCollection<DoctorDocument>("doctors");
    const doctor = await doctors.findOne({
      doctorCode: normalizedCode,
      $or: [
        { status: "active" },
        { status: { $exists: false } } // Support doctors created before status field was added
      ]
    });

    if (!doctor) {
      return NextResponse.json(
        { error: "Doctor not found or inactive. Please verify the code." },
        { status: 404 }
      );
    }

    // Return doctor profile (sanitized - no sensitive data)
    return NextResponse.json({
      success: true,
      doctor: {
        id: doctor._id.toString(),
        name: doctor.name,
        email: doctor.email, // For display only
        specialization: doctor.profile?.specialization || "General Practice",
        hospital: doctor.profile?.location?.hos || "Not specified",
        city: doctor.profile?.location?.city,
        state: doctor.profile?.location?.state,
        country: doctor.profile?.location?.country || "India",
        profileImageUrl: doctor.profile?.profileImageUrl,
      },
    });
  } catch (err) {
    console.error("DOCTOR_SEARCH_ERROR", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
