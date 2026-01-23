import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCollection } from "@/lib/db";
import type { UserDocument } from "@db/users";

/**
 * POST /api/doctor/register
 * Grants doctor role to the current user
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await getCollection<UserDocument>("users");
    const user = await users.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already a doctor
    if (user.roles?.includes("doctor")) {
      return NextResponse.json({ success: true, message: "Already a doctor" });
    }

    // Add doctor role to user
    await users.updateOne(
      { _id: user._id },
      { 
        $addToSet: { roles: "doctor" },
        $set: { updatedAt: new Date() }
      }
    );

    return NextResponse.json({ 
      success: true, 
      message: "Doctor role granted successfully" 
    });
  } catch (err) {
    console.error("DOCTOR_REGISTER_ERROR", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
