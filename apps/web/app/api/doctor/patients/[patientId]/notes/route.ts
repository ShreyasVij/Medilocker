import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCollection } from "@/lib/db";
import type { DoctorDocument } from "@db/doctors";
import type { UserDocument } from "@db/users";
import { ObjectId } from "mongodb";

interface DoctorPatientNote {
  _id?: ObjectId;
  doctorId: ObjectId;
  patientId: ObjectId;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

// GET - Fetch doctor's notes for this patient
export async function GET(
  req: Request,
  { params }: { params: Promise<{ patientId: string }> }
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

    const { patientId } = await params;

    if (!ObjectId.isValid(patientId)) {
      return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
    }

    const patientObjectId = new ObjectId(patientId);

    // Fetch notes
    const notes = await getCollection<DoctorPatientNote>("doctorPatientNotes");
    const noteDoc = await notes.findOne({
      doctorId: doctor._id,
      patientId: patientObjectId
    });

    return NextResponse.json({
      notes: noteDoc?.notes || "",
      lastUpdated: noteDoc?.updatedAt || null
    });
  } catch (err) {
    console.error("DOCTOR_PATIENT_NOTES_GET_ERROR", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Save doctor's notes for this patient
export async function POST(
  req: Request,
  { params }: { params: Promise<{ patientId: string }> }
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

    const { patientId } = await params;

    if (!ObjectId.isValid(patientId)) {
      return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
    }

    const patientObjectId = new ObjectId(patientId);

    const body = await req.json();
    const { notes: notesContent } = body;

    if (typeof notesContent !== 'string') {
      return NextResponse.json({ error: "Notes must be a string" }, { status: 400 });
    }

    // Upsert notes
    const notes = await getCollection<DoctorPatientNote>("doctorPatientNotes");
    const now = new Date();
    
    await notes.updateOne(
      {
        doctorId: doctor._id,
        patientId: patientObjectId
      },
      {
        $set: {
          notes: notesContent,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ 
      success: true,
      message: "Notes saved successfully" 
    });
  } catch (err) {
    console.error("DOCTOR_PATIENT_NOTES_POST_ERROR", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
