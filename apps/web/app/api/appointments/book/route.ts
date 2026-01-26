import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCollection } from "@/lib/db";
import type { AppointmentDocument, DoctorDocument, DoctorFileDocument } from "@db/doctors";
import type { UserDocument } from "@db/users";
import type { DocumentDocument } from "@db/documents";
import type { ProfileDocument } from "@db/profiles";
import { ObjectId } from "mongodb";

/**
 * POST /api/appointments/book
 * Book an appointment with a doctor
 * 
 * CRITICAL: Automatically transfers all patient medical files to doctor
 * 
 * Request Body:
 * {
 *   doctorId: string,
 *   date: string (YYYY-MM-DD),
 *   time: string (HH:MM AM/PM),
 *   reason?: string
 * }
 * 
 * Response:
 * - 201: Appointment booked successfully
 * - 400: Invalid input or double booking
 * - 401: Unauthorized
 * - 404: Doctor not found
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get patient user
    const users = await getCollection<UserDocument>("users");
    const patient = await users.findOne({ email: session.user.email });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const body = await req.json();
    const { doctorId, date, time, reason } = body;

    // Validation
    if (!doctorId || !date || !time) {
      return NextResponse.json(
        { error: "Missing required fields: doctorId, date, time" },
        { status: 400 }
      );
    }

    // Validate doctor exists
    if (!ObjectId.isValid(doctorId)) {
      return NextResponse.json({ error: "Invalid doctor ID" }, { status: 400 });
    }

    const doctors = await getCollection<DoctorDocument>("doctors");
    const doctor = await doctors.findOne({
      _id: new ObjectId(doctorId),
      status: "active",
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Get patient profile for additional info
    const profiles = await getCollection<ProfileDocument>("profiles");
    const patientProfile = await profiles.findOne({ userId: patient._id.toString() } as any);

    // Check for double booking using unique index
    // MongoDB will throw error if appointment already exists for same doctor + date + time
    const appointments = await getCollection<AppointmentDocument>("appointments");

    try {
      // Calculate age from profile if available
      let patientAge: number | undefined;
      const dobSource = patientProfile?.dateOfBirth || patient.profile?.dob;
      if (dobSource) {
        const birthDate = new Date(dobSource);
        const today = new Date();
        patientAge = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          patientAge--;
        }
      }

      // Get gender from profile - try both user.profile and profiles collection
      let patientGender: "Male" | "Female" | "Other" | undefined;
      const genderSource = (patientProfile as any)?.gender || patient.profile?.gender;
      if (genderSource) {
        const gender = genderSource.toLowerCase();
        if (gender === "male") patientGender = "Male";
        else if (gender === "female") patientGender = "Female";
        else if (gender === "other") patientGender = "Other";
      }

      // Create appointment
      const newAppointment: AppointmentDocument = {
        _id: new ObjectId(),
        doctorId: doctor._id,
        patientId: patient._id,
        patientName: patient.name || session.user.name || "Anonymous",
        patientEmail: patient.email, // Save patient email for notifications
        patientAge: patientAge || 0, // 0 indicates not provided
        patientGender: patientGender || "Other",
        appointmentTime: time,
        date,
        duration: 30, // Default 30 minutes
        status: "pending", // New appointments start as pending
        reason: reason || "General consultation",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await appointments.insertOne(newAppointment);

      console.log(`✅ Appointment created: ID=${newAppointment._id}, DoctorID=${doctor._id}, PatientID=${patient._id}, Date=${date}, Time=${time}`);

      // CRITICAL: Transfer all patient medical files to doctor
      await transferPatientFilesToDoctor(
        patient._id,
        doctor._id,
        newAppointment._id
      );

      return NextResponse.json({
        success: true,
        appointmentId: newAppointment._id.toString(),
        message: "Appointment booked successfully. Your medical files have been shared with the doctor.",
      }, { status: 201 });

    } catch (error: any) {
      // Check for duplicate key error (double booking)
      if (error.code === 11000) {
        return NextResponse.json(
          { error: "This time slot is already booked. Please choose a different time." },
          { status: 400 }
        );
      }
      throw error; // Re-throw other errors
    }

  } catch (err) {
    console.error("APPOINTMENT_BOOKING_ERROR", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Transfer all patient medical files to doctor's collection
 * CRITICAL LOGIC: Copies files, doesn't move them
 */
async function transferPatientFilesToDoctor(
  patientId: ObjectId,
  doctorId: ObjectId,
  appointmentId: ObjectId
): Promise<void> {
  try {
    // Fetch all patient documents
    const documents = await getCollection<DocumentDocument>("documents");
    const patientFiles = await documents.find({
      userId: patientId,
      // Only transfer active, non-deleted documents
      status: { $ne: "deleted" },
    }).toArray();

    if (patientFiles.length === 0) {
      console.log("No files to transfer for patient:", patientId);
      return;
    }

    // Prepare doctor file documents
    const doctorFiles = await getCollection<DoctorFileDocument>("doctorFiles");
    const filesToTransfer: DoctorFileDocument[] = patientFiles.map((file: any) => ({
      _id: new ObjectId(),
      appointmentId,
      doctorId,
      patientId,
      originalFileId: file._id,
      fileName: file.fileName || "Unnamed Document",
      fileType: file.documentType || "other",
      mimeType: file.mimeType || "",
      storageUrl: file.storageUrl || "",
      fileSize: file.fileSize || 0,
      uploadedAt: file.uploadedAt || file.createdAt || new Date(),
      transferredAt: new Date(),
      createdAt: new Date(),
    }));


    if (filesToTransfer.length > 0) {
      await doctorFiles.insertMany(filesToTransfer);
      console.log(`✅ Transferred ${filesToTransfer.length} files to doctor for appointment ${appointmentId}`);
    }

  } catch (error) {
    console.error("FILE_TRANSFER_ERROR", error);
    throw new Error("Failed to transfer patient files");
  }
}
