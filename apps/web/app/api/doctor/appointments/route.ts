import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getCollection } from "@/lib/db";
import type { AppointmentDocument, DoctorDocument } from "@db/doctors";
import type { UserDocument } from "@db/users";
import type { ProfileDocument } from "@db/profiles";
import { ObjectId } from "mongodb";

// GET - Fetch appointments for the logged-in doctor
export async function GET(req: Request) {
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

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // Optional date filter
    const status = searchParams.get("status"); // Optional status filter

    // Build query
    const query: any = { doctorId: doctor._id };
    if (date) {
      query.date = date;
    }
    if (status) {
      query.status = status;
    }

    // Fetch appointments
    const appointments = await getCollection<AppointmentDocument>("appointments");
    const results = await appointments
      .find(query)
      .sort({ date: 1, appointmentTime: 1 })
      .toArray();

    console.log(`📋 Doctor ${doctor._id} fetching appointments: Found ${results.length} appointments with query:`, query);

    // Fetch fresh profile data for each patient to get current age/gender
    const patientObjectIds = results
      .filter((apt) => apt.patientId)
      .map((apt) => apt.patientId as ObjectId);

    // Fetch profile docs (userId stored as string)
    const userIdStrings = patientObjectIds.map((id) => id.toString());
    const profiles = await getCollection<ProfileDocument>("profiles");
    const patientProfiles = await profiles
      .find({ userId: { $in: userIdStrings } })
      .toArray();

    const profileMap = new Map<string, ProfileDocument>();
    patientProfiles.forEach((profile) => {
      profileMap.set(profile.userId.toString(), profile);
    });

    // Also fetch users to get gender/dob fallback
    const usersCol = await getCollection<UserDocument>("users");
    const usersForPatients = await usersCol
      .find({ _id: { $in: patientObjectIds } })
      .toArray();
    const userMap = new Map<string, UserDocument>();
    usersForPatients.forEach((u) => userMap.set(u._id.toString(), u));

    // Transform to match frontend format with fresh profile data
    const formattedAppointments = results.map((apt) => {
      const profile = apt.patientId ? profileMap.get(apt.patientId.toString()) : null;
      const user = apt.patientId ? userMap.get(apt.patientId.toString()) : null;

      // Calculate fresh age from profile.dateOfBirth or user.profile.dob
      let currentAge = apt.patientAge;
      const dob = profile?.dateOfBirth || user?.profile?.dob;
      if (dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        currentAge = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          currentAge--;
        }
      }

      // Get fresh gender from user.profile.gender
      let currentGender = apt.patientGender;
      const genderVal = user?.profile?.gender;
      if (genderVal) {
        if (genderVal === "male") currentGender = "Male";
        else if (genderVal === "female") currentGender = "Female";
        else if (genderVal === "other") currentGender = "Other";
      }

      return {
        id: apt._id.toString(),
        patientId: apt.patientId?.toString(),
        patientName: apt.patientName,
        age: currentAge,
        gender: currentGender,
        appointmentTime: apt.appointmentTime,
        date: apt.date,
        status: apt.status,
        reason: apt.reason,
        notes: apt.notes,
        diagnosis: apt.diagnosis,
        prescription: apt.prescription,
      };
    });

    return NextResponse.json({ appointments: formattedAppointments });
  } catch (err) {
    console.error("APPOINTMENTS_GET_ERROR", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Create a new appointment
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

    const body = await req.json();
    const {
      patientName,
      patientAge,
      patientGender,
      appointmentTime,
      date,
      duration = 30,
      reason,
      notes,
      patientId,
    } = body;

    // Validation
    if (!patientName || !patientAge || !patientGender || !appointmentTime || !date) {
      return NextResponse.json({ 
        error: "Missing required fields" 
      }, { status: 400 });
    }

    const appointments = await getCollection<AppointmentDocument>("appointments");
    const newAppointment: AppointmentDocument = {
      _id: new ObjectId(),
      doctorId: doctor._id,
      patientId: patientId ? new ObjectId(patientId) : undefined,
      patientName,
      patientAge: Number(patientAge),
      patientGender,
      appointmentTime,
      date,
      duration: Number(duration),
      status: "upcoming",
      reason,
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await appointments.insertOne(newAppointment);

    return NextResponse.json({ 
      success: true, 
      appointmentId: newAppointment._id.toString() 
    });
  } catch (err) {
    console.error("APPOINTMENTS_POST_ERROR", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
