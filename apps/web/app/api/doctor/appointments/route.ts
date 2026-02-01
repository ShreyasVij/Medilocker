import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getCollection } from "@/lib/db";
import type { AppointmentDocument, DoctorDocument } from "@db/doctors";
import type { UserDocument } from "@db/users";
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
    const userIds = results
      .filter(apt => apt.patientId)
      .map(apt => apt.patientId);
    
    const profiles = await getCollection("profiles");
    const patientProfiles = await profiles.find({
      userId: { $in: userIds }
    }).toArray();

    // Create a map for quick lookup
    const profileMap = new Map();
    patientProfiles.forEach((profile: any) => {
      profileMap.set(profile.userId.toString(), profile);
    });

    // Transform to match frontend format with fresh profile data
    const formattedAppointments = results.map((apt) => {
      const profile = apt.patientId ? profileMap.get(apt.patientId.toString()) : null;
      
      // Calculate fresh age from profile DOB
      let currentAge = apt.patientAge;
      if (profile?.dob) {
        const birthDate = new Date(profile.dob);
        const today = new Date();
        currentAge = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          currentAge--;
        }
      }

      // Get fresh gender from profile
      let currentGender = apt.patientGender;
      if (profile?.gender) {
        const gender = profile.gender.toLowerCase();
        if (gender === "male") currentGender = "Male";
        else if (gender === "female") currentGender = "Female";
        else if (gender === "other") currentGender = "Other";
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
