// GET - Allow status update via email link (for Accept/Deny)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const appointmentId = searchParams.get("appointmentId");
    const status = searchParams.get("status");

    if (!appointmentId || !status) {
      return new Response("Missing appointmentId or status", { status: 400 });
    }
    if (status !== "approved" && status !== "rejected") {
      return new Response("Invalid status", { status: 400 });
    }
    if (!ObjectId.isValid(appointmentId)) {
      return new Response("Invalid appointmentId", { status: 400 });
    }

    const appointments = await getCollection<AppointmentDocument>("appointments");
    const appointment = await appointments.findOne({ _id: new ObjectId(appointmentId) });
    if (!appointment) {
      return new Response("Appointment not found", { status: 404 });
    }
    if (appointment.status !== "pending") {
      return new Response(`Cannot update appointment with status: ${appointment.status}. Only pending appointments can be approved/rejected.`, { status: 400 });
    }

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };
    if (status === "approved") {
      updateData.approvedAt = new Date();
    } else {
      updateData.rejectedAt = new Date();
    }
    await appointments.updateOne({ _id: new ObjectId(appointmentId) }, { $set: updateData });

    // Send notification email to patient (same as POST logic)
    let patientEmail: string | null = null;
    if (appointment.patientEmail) {
      patientEmail = appointment.patientEmail;
    } else if (appointment.patientId) {
      const users = await getCollection<UserDocument>("users");
      const patient = await users.findOne({ _id: appointment.patientId });
      patientEmail = patient?.email || null;
    }
    if (patientEmail) {
      try {
        const doctorName = appointment.doctorName || "Doctor";
        const emailParams = {
          patientName: appointment.patientName,
          doctorName,
          date: new Date(appointment.date).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          time: appointment.appointmentTime,
        };
        const emailTemplate = status === "approved"
          ? getApprovedEmailTemplate(emailParams)
          : getRejectedEmailTemplate(emailParams);
        await sendMail({
          to: patientEmail,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        });
      } catch (emailError) {
        // Don't fail the request if email fails
      }
    }
    return new Response(
      `<html><body style='font-family:sans-serif;text-align:center;padding:40px;'><h2>Appointment ${status === "approved" ? "Accepted" : "Rejected"}</h2><p>The appointment has been ${status}.</p></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    return new Response("Internal Server Error", { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCollection } from "@/lib/db";
import { sendMail } from "@/lib/server/mail";
import { getApprovedEmailTemplate } from "@/lib/server/emails/appointment-approved";
import { getRejectedEmailTemplate } from "@/lib/server/emails/appointment-rejected";
import { createOAuth2Client, createCalendarEvent, refreshTokensIfNeeded } from "@/lib/server/googleCalendar";
import type { AppointmentDocument, DoctorDocument } from "@db/doctors";
import type { UserDocument } from "@db/users";
import { ObjectId } from "mongodb";

/**
 * POST /api/appointments/update-status
 * Approve or reject a pending appointment
 * 
 * Request Body:
 * {
 *   appointmentId: string,
 *   status: "approved" | "rejected"
 * }
 * 
 * Response:
 * - 200: Appointment status updated successfully
 * - 400: Invalid input
 * - 401: Unauthorized
 * - 403: Not authorized to update this appointment
 * - 404: Appointment not found
 */
export async function POST(req: Request) {
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

    // Parse request body
    const body = await req.json();
    const { appointmentId, status } = body;

    // Validation
    if (!appointmentId || !status) {
      return NextResponse.json(
        { error: "Missing required fields: appointmentId, status" },
        { status: 400 }
      );
    }

    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json(
        { error: "Invalid status. Must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(appointmentId)) {
      return NextResponse.json({ error: "Invalid appointment ID" }, { status: 400 });
    }

    // Get the appointment
    const appointments = await getCollection<AppointmentDocument>("appointments");
    const appointment = await appointments.findOne({
      _id: new ObjectId(appointmentId),
      doctorId: doctor._id, // Ensure doctor owns this appointment
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found or you don't have permission to update it" },
        { status: 404 }
      );
    }

    // Check if appointment is in pending state
    if (appointment.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot update appointment with status: ${appointment.status}. Only pending appointments can be approved/rejected.` },
        { status: 400 }
      );
    }

    // Prepare update object
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "approved") {
      updateData.approvedAt = new Date();
      
      // Try to create Google Calendar event (non-blocking)
      if (doctor.googleTokens && !appointment.syncedToGoogle) {
        try {
          const oauth2Client = createOAuth2Client(doctor.googleTokens);
          
          // Refresh tokens if needed
          const refreshedTokens = await refreshTokensIfNeeded(oauth2Client);
          
          // Update tokens in database if refreshed
          if (refreshedTokens.access_token !== doctor.googleTokens.access_token) {
            await doctors.updateOne(
              { _id: doctor._id },
              {
                $set: {
                  "googleTokens.access_token": refreshedTokens.access_token,
                  "googleTokens.expiry_date": refreshedTokens.expiry_date,
                  updatedAt: new Date(),
                },
              }
            );
          }

          // Create calendar event
          const googleEventId = await createCalendarEvent({
            oauth2Client,
            patientName: appointment.patientName,
            date: appointment.date,
            time: appointment.appointmentTime,
            duration: appointment.duration || 30,
            reason: appointment.reason,
          });

          // Update appointment with Google event info
          updateData.googleEventId = googleEventId;
          updateData.syncedToGoogle = true;

          console.log(`📅 Google Calendar event created: ${googleEventId}`);
        } catch (calendarError) {
          console.error("Failed to create Google Calendar event:", calendarError);
          // Don't block appointment approval if calendar sync fails
          updateData.syncedToGoogle = false;
        }
      }
    } else {
      updateData.rejectedAt = new Date();
    }

    // Update appointment in database
    await appointments.updateOne(
      { _id: new ObjectId(appointmentId) },
      { $set: updateData }
    );

    console.log(`✅ Appointment ${appointmentId} ${status} by doctor ${doctor._id}`);

    // Get patient email for notification
    let patientEmail: string | null = null;
    
    if (appointment.patientEmail) {
      patientEmail = appointment.patientEmail;
    } else if (appointment.patientId) {
      const patient = await users.findOne({ _id: appointment.patientId });
      patientEmail = patient?.email || null;
    }

    // Send email notification
    if (patientEmail) {
      try {
        const emailParams = {
          patientName: appointment.patientName,
          doctorName: doctor.name,
          date: new Date(appointment.date).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          time: appointment.appointmentTime,
        };

        const emailTemplate = status === "approved" 
          ? getApprovedEmailTemplate(emailParams)
          : getRejectedEmailTemplate(emailParams);

        await sendMail({
          to: patientEmail,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        });

        console.log(`📧 Email sent to ${patientEmail} for appointment ${status}`);
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
        // Don't fail the request if email fails
      }
    } else {
      console.warn(`⚠️ No patient email found for appointment ${appointmentId}`);
    }

    return NextResponse.json({
      success: true,
      message: `Appointment ${status} successfully`,
      appointment: {
        id: appointment._id.toString(),
        status,
        ...(status === "approved" ? { approvedAt: updateData.approvedAt } : { rejectedAt: updateData.rejectedAt }),
      },
    });

  } catch (err) {
    console.error("APPOINTMENT_UPDATE_STATUS_ERROR", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
