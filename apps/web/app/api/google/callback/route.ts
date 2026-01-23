import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import type { DoctorDocument } from "@db/doctors";
import type { UserDocument } from "@db/users";
import { google } from "googleapis";

/**
 * GET /api/google/callback
 * Handles OAuth callback from Google
 * Exchanges code for tokens and stores in doctor document
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // Doctor's email
    const error = searchParams.get("error");

    // Handle user denial
    if (error) {
      console.log("User denied Google Calendar access:", error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/doctor?calendar_error=denied`
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing authorization code or state" },
        { status: 400 }
      );
    }

    const doctorEmail = state;

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/google/callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Failed to get tokens from Google");
    }

    // Find user
    const users = await getCollection<UserDocument>("users");
    const user = await users.findOne({ email: doctorEmail });

    if (!user?.roles?.includes("doctor")) {
      return NextResponse.json({ error: "Not a doctor" }, { status: 403 });
    }

    // Find and update doctor document with tokens
    const doctors = await getCollection<DoctorDocument>("doctors");
    const result = await doctors.updateOne(
      {
        $or: [
          { email: doctorEmail },
          { userId: user._id }
        ]
      },
      {
        $set: {
          googleTokens: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date || 0,
          },
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Doctor profile not found" },
        { status: 404 }
      );
    }

    console.log(`✅ Google Calendar connected for doctor: ${doctorEmail}`);

    // Redirect back to doctor dashboard
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/doctor?calendar_connected=true`
    );
  } catch (err) {
    console.error("GOOGLE_CALLBACK_ERROR", err);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/doctor?calendar_error=failed`
    );
  }
}
