import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCollection } from "@/lib/db";
import type { UserDocument } from "@db/users";
import type { DoctorDocument } from "@db/doctors";

/**
 * DELETE /api/doctor/profile/delete
 * Permanently delete doctor profile and all associated data
 * 
 * This will delete:
 * - Doctor account from doctors collection
 * - User account from users collection
 * - All appointments where doctor is the provider
 * - All doctor-patient notes
 * - Doctor files
 * - Sessions
 * - Audit logs
 */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user
    const users = await getCollection<UserDocument>("users");
    const user = await users.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.roles?.includes("doctor")) {
      return NextResponse.json({ error: "Not a doctor" }, { status: 403 });
    }

    // Find doctor document
    const doctors = await getCollection<DoctorDocument>("doctors");
    const doctor = await doctors.findOne({
      $or: [
        { email: session.user.email },
        { userId: user._id }
      ]
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
    }

    const userId = user._id;
    const doctorId = doctor._id;
    const userIdString = userId.toString();
    const doctorIdString = doctorId.toString();

    console.log(`🗑️ Starting doctor profile deletion for user: ${userIdString}, doctor: ${doctorIdString}`);

    const deletionResults = {
      appointments: 0,
      doctorNotes: 0,
      doctorFiles: 0,
      sessions: 0,
      audits: 0,
      doctor: 0,
      user: 0,
    };

    // 1. Delete all appointments where this doctor is the provider
    const appointments = await getCollection("appointments");
    const appointmentsResult = await appointments.deleteMany({
      $or: [
        { doctorId: doctorIdString },
        { doctorId: doctorId }
      ]
    });
    deletionResults.appointments = appointmentsResult.deletedCount;

    // 2. Delete all doctor-patient notes (as doctor)
    const doctorPatientNotes = await getCollection("doctorPatientNotes");
    const doctorNotesResult = await doctorPatientNotes.deleteMany({
      $or: [
        { doctorId: doctorIdString },
        { doctorId: doctorId }
      ]
    });
    deletionResults.doctorNotes = doctorNotesResult.deletedCount;

    // 3. Delete doctor files (if collection exists)
    const doctorFiles = await getCollection("doctorFiles");
    const doctorFilesResult = await doctorFiles.deleteMany({
      $or: [
        { doctorId: doctorIdString },
        { doctorId: doctorId }
      ]
    });
    deletionResults.doctorFiles = doctorFilesResult.deletedCount;

    // 4. Delete sessions
    const sessions = await getCollection("sessions");
    const sessionsResult = await sessions.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.sessions = sessionsResult.deletedCount;

    // 5. Delete audit logs
    const audits = await getCollection("audits");
    const auditsResult = await audits.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.audits = auditsResult.deletedCount;

    // 6. Delete doctor document
    const doctorResult = await doctors.deleteOne({ _id: doctorId });
    deletionResults.doctor = doctorResult.deletedCount;

    // 7. Finally, delete the user account itself
    const userResult = await users.deleteOne({ _id: userId });
    deletionResults.user = userResult.deletedCount;

    console.log(`✅ Doctor profile deletion completed for user: ${userIdString}`, deletionResults);

    return NextResponse.json({
      success: true,
      message: "Doctor profile and all associated data deleted successfully",
      deletionResults
    });
  } catch (err) {
    console.error("DOCTOR_PROFILE_DELETE_ERROR", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
