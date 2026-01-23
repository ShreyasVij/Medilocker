import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import type { DoctorDocument } from "@db/doctors";

/**
 * POST /api/admin/migrate-doctor-codes
 * Migrate existing doctor codes to remove hyphens
 * Run this once to fix any existing doctors with hyphenated codes
 */
export async function POST(req: Request) {
  try {
    // Simple auth check - you can enhance this
    const authHeader = req.headers.get("x-admin-token");
    if (authHeader !== process.env.ADMIN_INIT_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const doctors = await getCollection<DoctorDocument>("doctors");
    
    // Find all doctors with hyphenated codes
    const doctorsWithHyphens = await doctors.find({
      doctorCode: { $regex: /-/ }
    }).toArray();

    let updated = 0;
    for (const doctor of doctorsWithHyphens) {
      const normalizedCode = doctor.doctorCode.replace(/-/g, '');
      await doctors.updateOne(
        { _id: doctor._id },
        { $set: { doctorCode: normalizedCode } }
      );
      updated++;
      console.log(`✅ Migrated doctor ${doctor.email}: ${doctor.doctorCode} → ${normalizedCode}`);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Migrated ${updated} doctor codes`,
      updated 
    });
  } catch (err) {
    console.error("DOCTOR_CODE_MIGRATION_ERROR", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
