import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ObjectId } from "mongodb";

import { getUsersCollection } from "@/lib/models/User";
import { getFamiliesCollection } from "@/lib/Family";
import { getFamilyInvitesCollection } from "@/lib/FamilyInvite";

export async function POST(req: Request) {
  const { token } = await req.json();
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await getUsersCollection();
  const families = await getFamiliesCollection();
  const invites = await getFamilyInvitesCollection();

  const user = await users.findOne({ email: session.user.email });
  if (!user || user.familyId) {
    return NextResponse.json({ error: "Invalid user state" }, { status: 400 });
  }

  const invite = await invites.findOne({
    token,
    used: false,
    expiresAt: { $gt: new Date() }
  });

  if (!invite || invite.email !== user.email) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 403 });
  }

  const family = await families.findOne({ _id: invite.familyId });
  if (!family || family.members.length >= 5) {
    return NextResponse.json({ error: "Family full" }, { status: 400 });
  }

  // Atomic updates
  await families.updateOne(
    { _id: family._id },
    { $push: { members: user._id } }
  );

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        familyId: family._id.toString(),
        familyRole: "member"
      }
    }
  );

  await invites.updateOne(
    { _id: invite._id },
    { $set: { used: true } }
  );

  return NextResponse.json({ success: true });
}
