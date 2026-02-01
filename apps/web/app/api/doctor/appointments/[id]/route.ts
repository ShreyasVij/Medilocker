import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getCollection } from "@/lib/db";
import { createOAuth2Client, deleteCalendarEvent } from "@/lib/server/googleCalendar";
import type { AppointmentDocument, DoctorDocument, DoctorFileDocument } from "@db/doctors";
import type { UserDocument } from "@db/users";
import { ObjectId } from "mongodb";

// PATCH - Update appointment (status, notes, etc.)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has doctor role
    const users = await getCollection<UserDocument>("users");
    const user = await users.findOne({ email: session.user.email });
    
    if (!user?.roles?.includes("doctor")) {
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

    const { id } = await params;
    const appointmentId = id;
    if (!ObjectId.isValid(appointmentId)) {
      return NextResponse.json({ error: "Invalid appointment ID" }, { status: 400 });
    }

    const body = await req.json();
    const { status, notes, diagnosis, prescription } = body;

    const appointments = await getCollection<AppointmentDocument>("appointments");
    
    // Verify appointment belongs to this doctor
    const appointment = await appointments.findOne({
      _id: new ObjectId(appointmentId),
      doctorId: doctor._id,
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Build update object
    const updateFields: any = {
      updatedAt: new Date(),
    };

    if (status) {
      updateFields.status = status;
      if (status === "completed") {
        updateFields.completedAt = new Date();
      }
      if (status === "cancelled") {
        updateFields.cancelledAt = new Date();
        
        // Delete Google Calendar event if appointment was synced
        if (appointment.googleEventId && appointment.syncedToGoogle && doctor.googleTokens) {
          try {
            const oauth2Client = createOAuth2Client(doctor.googleTokens);
            await deleteCalendarEvent(oauth2Client, appointment.googleEventId);
            console.log(`📅 Deleted Google Calendar event: ${appointment.googleEventId}`);
          } catch (calendarError) {
            console.error("Failed to delete Google Calendar event:", calendarError);
            // Don't block cancellation if calendar deletion fails
          }
        }
      }
    }

    if (notes !== undefined) updateFields.notes = notes;
    if (diagnosis !== undefined) updateFields.diagnosis = diagnosis;
    if (prescription !== undefined) updateFields.prescription = prescription;

    await appointments.updateOne(
      { _id: new ObjectId(appointmentId) },
      { $set: updateFields }
    );

    // CRITICAL: Delete doctor files when appointment is completed
    if (status === "completed") {
      await deleteAppointmentFiles(new ObjectId(appointmentId), doctor._id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("APPOINTMENT_PATCH_ERROR", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE - Cancel/delete appointment
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has doctor role
    const users = await getCollection<UserDocument>("users");
    const user = await users.findOne({ email: session.user.email });
    
    if (!user?.roles?.includes("doctor")) {
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

    const { id } = await params;
    const appointmentId = id;
    if (!ObjectId.isValid(appointmentId)) {
      return NextResponse.json({ error: "Invalid appointment ID" }, { status: 400 });
    }

    const appointments = await getCollection<AppointmentDocument>("appointments");
    
    // Get appointment before deletion to access Google event ID
    const appointment = await appointments.findOne({
      _id: new ObjectId(appointmentId),
      doctorId: doctor._id,
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Delete Google Calendar event if appointment was synced
    if (appointment.googleEventId && appointment.syncedToGoogle && doctor.googleTokens) {
      try {
        const oauth2Client = createOAuth2Client(doctor.googleTokens);
        await deleteCalendarEvent(oauth2Client, appointment.googleEventId);
        console.log(`📅 Deleted Google Calendar event: ${appointment.googleEventId}`);
      } catch (calendarError) {
        console.error("Failed to delete Google Calendar event:", calendarError);
        // Don't block deletion if calendar deletion fails
      }
    }
    
    // Delete appointment
    const result = await appointments.deleteOne({
      _id: new ObjectId(appointmentId),
      doctorId: doctor._id,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("APPOINTMENT_DELETE_ERROR", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Delete all doctor files associated with an appointment
 * CRITICAL: Called when appointment is marked as completed
 * Patient's original files remain untouched
 */
async function deleteAppointmentFiles(
  appointmentId: ObjectId,
  doctorId: ObjectId
): Promise<void> {
  try {
    const doctorFiles = await getCollection<DoctorFileDocument>("doctorFiles");
    
    const result = await doctorFiles.deleteMany({
      appointmentId,
      doctorId, // Extra safety: only delete files for this doctor
    });

    console.log(`✅ Deleted ${result.deletedCount} doctor files for appointment ${appointmentId}`);
  } catch (error) {
    console.error("FILE_DELETION_ERROR", error);
    // Don't throw - we still want appointment to be marked complete even if file deletion fails
  }
}
