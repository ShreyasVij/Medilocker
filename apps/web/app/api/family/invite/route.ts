import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "crypto";
import { ObjectId } from "mongodb";

import { getUsersCollection } from "@/lib/models/User";
import { getFamiliesCollection } from "@/lib//Family";
import { getFamilyInvitesCollection } from "@/lib//FamilyInvite";
import { sendMail } from "@/lib/server/mail";

export async function POST(req: Request) {
  const { email } = await req.json();
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await getUsersCollection();
  const families = await getFamiliesCollection();
  const invites = await getFamilyInvitesCollection();

  const owner = await users.findOne({ email: session.user.email });
  if (!owner || owner.familyRole !== "owner") {
    return NextResponse.json({ error: "Only owner can invite" }, { status: 403 });
  }

  const family = await families.findOne({
    _id: new ObjectId(owner.familyId!)
  });

  if (!family || family.members.length >= 5) {
    return NextResponse.json({ error: "Family full" }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString("hex");

  const inviterName = owner?.name || "A MediLocker member";

  await invites.insertOne({
    _id: new ObjectId(),
    familyId: family._id,
    email,
    token,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    used: false,
    createdAt: new Date()
  });

  const joinLink = `${process.env.NEXT_PUBLIC_APP_URL}/family/join?token=${token}`;
  await sendMail({
    to: email,
    subject: "You're Invited to Join a MediLocker Family",
    fromName: inviterName,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #eaeaea;">
      
      <h2 style="color: #2F80ED; margin-bottom: 16px;">Welcome to MediLocker 👋</h2>

      <p style="font-size: 14px; color: #333;">
        <strong>Invited by: ${inviterName}</strong>
      </p>

      <p style="font-size: 14px; color: #333;">
        You’ve been invited to join a <strong>MediLocker Family</strong>. MediLocker helps families securely store, manage, and access medical documents anytime, anywhere.
      </p>

      <p style="font-size: 14px; color: #333;">
        By joining this family, you’ll be able to:
      </p>

      <ul style="font-size: 14px; color: #333; padding-left: 20px;">
        <li>Access shared medical records securely</li>
        <li>Upload and manage health documents</li>
        <li>View reports anytime during emergencies</li>
        <li>Stay connected with your family’s health data</li>
      </ul>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${joinLink}" 
           style="background-color: #2F80ED; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">
          Join Family
        </a>
      </div>

      <p style="font-size: 13px; color: #666;">
        ⏳ This invitation link will expire in <strong>10 minutes</strong> for security reasons.
      </p>

      <p style="font-size: 13px; color: #666;">
        If you weren’t expecting this invitation, you can safely ignore this email. No action will be taken.
      </p>

      <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />

      <p style="font-size: 12px; color: #999; text-align: center;">
        © ${new Date().getFullYear()} MediLocker. All rights reserved.<br />
        This is an automated message, please do not reply.
      </p>

    </div>
  `
  });


  return NextResponse.json({ success: true });
}
