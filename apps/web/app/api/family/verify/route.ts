import { NextResponse } from "next/server";
import { getFamilyInvitesCollection } from "@/lib/FamilyInvite";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token missing" }, { status: 400 });
  }

  const invites = await getFamilyInvitesCollection();

  const invite = await invites.findOne({
    token,
    used: false,
    expiresAt: { $gt: new Date() }
  });

  if (!invite) {
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
  }

  return NextResponse.json({ email: invite.email });
}
