import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getCollection } from "@/lib/db";
import type { DoctorDocument, DoctorProfile } from "@db/doctors";
import type { UserDocument } from "@db/users";
import { generateDoctorCode } from "@db/utils";
import { ObjectId } from "mongodb";

function toNullIfEmpty<T extends string | undefined | null>(v: T): T | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return (s.length ? (s as any) : null);
}

function normalizeGender(g: string | undefined | null): DoctorProfile["gender"] | null {
  if (!g) return null;
  const s = g.toLowerCase();
  if (s === "prefer not to say" || s === "prefer_not_to_say") return "prefer_not_to_say";
  if (s === "male") return "male";
  if (s === "female") return "female";
  if (s === "other") return "other";
  return null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log("[DOCTOR_PROFILE] Unauthorized - no session or email");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[DOCTOR_PROFILE] Fetching profile for: ${session.user.email}`);

    // Check if user has doctor role
    const users = await getCollection<UserDocument>("users");
    const user = await users.findOne({ email: session.user.email });
    
    if (!user) {
      console.log(`[DOCTOR_PROFILE] User not found: ${session.user.email}`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    if (!user?.roles?.includes("doctor")) {
      console.log(`[DOCTOR_PROFILE] User is not a doctor. Roles: ${user.roles?.join(", ") || "none"}`);
      return NextResponse.json({ error: "Not a doctor" }, { status: 403 });
    }

    const doctors = await getCollection<DoctorDocument>("doctors");
    const doctor = await doctors.findOne({ 
      $or: [
        { email: session.user.email },
        { userId: user._id }
      ]
    });

    console.log(`[DOCTOR_PROFILE] Doctor record ${doctor ? "found" : "not found"} for: ${session.user.email}`);

    // If doctor exists but doesn't have a code, generate one
    if (doctor && !doctor.doctorCode) {
      let doctorCode = generateDoctorCode();
      let normalizedCode = doctorCode.replace(/-/g, ''); // Store without hyphens
      let codeIsUnique = false;
      
      // Ensure code is truly unique
      while (!codeIsUnique) {
        const existingDoctor = await doctors.findOne({ doctorCode: normalizedCode });
        if (!existingDoctor) {
          codeIsUnique = true;
        } else {
          console.warn("Doctor code collision detected, regenerating...");
          doctorCode = generateDoctorCode();
          normalizedCode = doctorCode.replace(/-/g, '');
        }
      }

      // Update doctor with new code (stored without hyphens)
      await doctors.updateOne(
        { _id: doctor._id },
        { $set: { doctorCode: normalizedCode, updatedAt: new Date() } }
      );

      doctor.doctorCode = normalizedCode;
      console.log(`✅ Generated doctor code for existing doctor: ${normalizedCode}`);
    }

    const profile = doctor?.profile || null;
    const hasGoogleCalendar = !!doctor?.googleTokens;
    
    console.log(`[DOCTOR_PROFILE] Returning profile. Has code: ${!!doctor?.doctorCode}, Has Google: ${hasGoogleCalendar}`);
    
    return NextResponse.json({ 
      profile, 
      doctor,
      googleTokens: hasGoogleCalendar ? { connected: true } : null // Don't expose actual tokens
    });
  } catch (err) {
    console.error("[DOCTOR_PROFILE] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ 
      error: "Internal Server Error",
      details: process.env.NODE_ENV === "development" ? errorMessage : undefined
    }, { status: 500 });
  }
}

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

    const body = await req.json();
    const {
      phone,
      dob,
      gender,
      address,
      latitude,
      longitude,
      city,
      state,
      country,
      avatarUrl,
      avatarFileName,
    } = body ?? {};

    const doctors = await getCollection<DoctorDocument>("doctors");
    const existing = await doctors.findOne({ 
      $or: [
        { email: session.user.email },
        { userId: user._id }
      ]
    });

    const prevAvatar = existing?.profile?.profileImageUrl || undefined;
    const prevAvatarName = existing?.profile?.profileImageName || undefined;

    const profile: DoctorProfile = {
      phone: toNullIfEmpty(phone) as any,
      dob: dob ? new Date(dob) : undefined,
      gender: normalizeGender(gender) || undefined,
      profileImageUrl: (toNullIfEmpty(avatarUrl) as any) || prevAvatar,
      profileImageName: (toNullIfEmpty(avatarFileName) as any) || prevAvatarName,
      location: {
        hos: toNullIfEmpty(address) as any,
        city: toNullIfEmpty(city) as any,
        state: toNullIfEmpty(state) as any,
        country: toNullIfEmpty(country) || "India",
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
      },
    };

    if (existing) {
      // Update existing doctor profile
      await doctors.updateOne(
        { _id: existing._id },
        {
          $set: {
            profile,
            name: session.user.name || existing.name,
            status: "active",
            updatedAt: new Date(),
          },
        }
      );
    } else {
      // Create new doctor document with UNIQUE 16-character code
      let doctorCode = generateDoctorCode();
      let normalizedCode = doctorCode.replace(/-/g, ''); // Store without hyphens
      let codeIsUnique = false;
      
      // Ensure code is truly unique (retry if collision occurs)
      while (!codeIsUnique) {
        const existingDoctor = await doctors.findOne({ doctorCode: normalizedCode });
        if (!existingDoctor) {
          codeIsUnique = true;
        } else {
          console.warn("Doctor code collision detected, regenerating...");
          doctorCode = generateDoctorCode();
          normalizedCode = doctorCode.replace(/-/g, '');
        }
      }

      await doctors.insertOne({
        _id: new ObjectId(),
        doctorCode: normalizedCode, // CRITICAL: Store normalized code (no hyphens)
        userId: user._id,
        email: session.user.email,
        name: session.user.name || "",
        profile,
        role: "Doctor",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as DoctorDocument);
      
      console.log(`✅ New doctor created with code: ${normalizedCode}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DOCTOR_PROFILE_POST_ERROR", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
