import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCollection } from "@/lib/db";
import type { UserDocument, UserProfile } from "@db/users";

function toNullIfEmpty<T extends string | undefined | null>(v: T): T | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return (s.length ? (s as any) : null);
}

function normalizeGender(g: string | undefined | null): UserProfile["gender"] | null {
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await getCollection<UserDocument>("users");
    const user = await users.findOne({ email: session.user.email });
    const profile = user?.profile || null;
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("PROFILE_GET_ERROR", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      phone,
      dob,
      gender,
      bloodGroup,
      allergies,
      conditions,
      medications,
      emergencyName,
      emergencyPhone,
      relationship,
      city,
      state,
      country,
      avatarUrl,
      avatarFileName,
    } = body ?? {};

    const users = await getCollection<UserDocument>("users");
    const existing = await users.findOne({ email: session.user.email });
    const prevAvatar = existing?.profile?.profileImageUrl || undefined;
    const prevAvatarName = existing?.profile?.profileImageName || undefined;

    const profile: UserProfile = {
      phone: toNullIfEmpty(phone) as any,
      dob: dob ? new Date(dob) : null,
      gender: normalizeGender(gender) || undefined,
      profileImageUrl: (toNullIfEmpty(avatarUrl) as any) || prevAvatar,
      profileImageName: (toNullIfEmpty(avatarFileName) as any) || prevAvatarName,
      medical: {
        bloodGroup: toNullIfEmpty(bloodGroup) as any,
        allergies: toNullIfEmpty(allergies) as any,
        conditions: toNullIfEmpty(conditions) as any,
        medications: toNullIfEmpty(medications) as any,
      },
      emergency: {
        name: toNullIfEmpty(emergencyName) as any,
        phone: toNullIfEmpty(emergencyPhone) as any,
        relationship: toNullIfEmpty(relationship) as any,
      },
      location: {
        city: toNullIfEmpty(city) as any,
        state: toNullIfEmpty(state) as any,
        country: toNullIfEmpty(country) || "India",
      },
    };

    await users.updateOne(
      { email: session.user.email },
      {
        $set: {
          profile,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PROFILE_POST_ERROR", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
