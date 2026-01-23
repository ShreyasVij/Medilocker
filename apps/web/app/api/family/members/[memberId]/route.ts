import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "@/lib/models/User";
import { getFamiliesCollection } from "@/lib/Family";
import { getCollection } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { EmergencyToken } from "@/../../packages/db/emergencyTokens";
import type { ProfileDocument } from "@/../../packages/db/profiles";

/**
 * DELETE /api/family/members/[memberId]
 * Remove a family member (soft unlink, not hard delete)
 * - Only primary account holder (owner) can remove members
 * - Cannot remove self
 * - Revokes all emergency access tokens for removed member
 * - Logs action in audit trail
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { memberId } = await params;

  // Validate memberId format
  if (!ObjectId.isValid(memberId)) {
    return NextResponse.json({ error: "Invalid member ID" }, { status: 400 });
  }

  const users = await getUsersCollection();
  const families = await getFamiliesCollection();

  // Get current user
  const currentUser = await users.findOne({ email: session.user.email });
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if user has a family
  if (!currentUser.familyId) {
    return NextResponse.json({ error: "Not part of a family" }, { status: 400 });
  }

  // Check if user is the family owner (only owner can remove members)
  if (currentUser.familyRole !== "owner") {
    await logAudit(req, {
      actorId: currentUser._id.toString(),
      action: "access.revoke" as any,
      target: memberId,
      targetType: "user",
      result: "failure",
      metadata: { reason: "Not family owner", action: "remove_family_member" },
    });
    return NextResponse.json(
      { error: "Only the family owner can remove members" },
      { status: 403 }
    );
  }

  // Prevent removing self
  if (currentUser._id.toString() === memberId) {
    return NextResponse.json(
      { error: "Cannot remove yourself from the family" },
      { status: 400 }
    );
  }

  // Get the family
  const family = await families.findOne({
    _id: new ObjectId(currentUser.familyId),
  });

  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  // Get member to be removed
  const memberToRemove = await users.findOne({
    _id: new ObjectId(memberId),
  });

  if (!memberToRemove) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Verify member is in the family
  const isMemberInFamily = family.members.some(
    (m) => m.toString() === memberId
  );

  if (!isMemberInFamily) {
    return NextResponse.json(
      { error: "Member is not part of this family" },
      { status: 400 }
    );
  }

  try {
    // 1. Remove member from family.members array
    await families.updateOne(
      { _id: family._id },
      { $pull: { members: new ObjectId(memberId) } }
    );

    // 2. Clear family information from user
    await users.updateOne(
      { _id: new ObjectId(memberId) },
      {
        $set: {
          familyId: null,
          familyRole: null,
          updatedAt: new Date(),
        },
      }
    );

    // 3. Revoke all emergency access tokens for the removed member's profiles
    const profilesCol = await getCollection<ProfileDocument>("profiles");
    const emergencyTokensCol = await getCollection<EmergencyToken>("emergencyTokens");

    // Find all profiles owned by the removed member
    const memberProfiles = await profilesCol
      .find({ userId: memberId })
      .toArray();

    let revokedTokenCount = 0;
    for (const profile of memberProfiles) {
      const result = await emergencyTokensCol.updateMany(
        {
          profileId: profile.id as any, // profile.id is a string UUID, not ObjectId
          used: false,
          revoked: false,
          expiresAt: { $gt: new Date() },
        },
        {
          $set: {
            revoked: true,
            revokedAt: new Date(),
            revokedBy: currentUser._id,
          },
        }
      );
      revokedTokenCount += result.modifiedCount;
    }

    // 4. Log the action in audit trail
    await logAudit(req, {
      actorId: currentUser._id.toString(),
      action: "access.revoke" as any,
      target: memberId,
      targetType: "user",
      result: "success",
      metadata: {
        action: "remove_family_member",
        familyId: currentUser.familyId,
        removedMemberEmail: memberToRemove.email,
        removedMemberName: memberToRemove.name,
        revokedTokenCount,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Member removed successfully",
      revokedTokenCount,
    });
  } catch (error) {
    console.error("Error removing family member:", error);

    // Log failure
    await logAudit(req, {
      actorId: currentUser._id.toString(),
      action: "access.revoke" as any,
      target: memberId,
      targetType: "user",
      result: "failure",
      metadata: {
        action: "remove_family_member",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/family/members/[memberId]
 * Get details of a specific family member
 * - Only accessible by family members
 * - Returns basic user info (no sensitive data)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { memberId } = await params;

  if (!ObjectId.isValid(memberId)) {
    return NextResponse.json({ error: "Invalid member ID" }, { status: 400 });
  }

  const users = await getUsersCollection();
  const families = await getFamiliesCollection();

  const currentUser = await users.findOne({ email: session.user.email });
  if (!currentUser || !currentUser.familyId) {
    return NextResponse.json({ error: "Not part of a family" }, { status: 400 });
  }

  const family = await families.findOne({
    _id: new ObjectId(currentUser.familyId),
  });

  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  // Verify both current user and target member are in the same family
  const isMemberInFamily = family.members.some(
    (m) => m.toString() === memberId
  );
  const isCurrentUserInFamily = family.members.some(
    (m) => m.toString() === currentUser._id.toString()
  );

  if (!isMemberInFamily || !isCurrentUserInFamily) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const member = await users.findOne({ _id: new ObjectId(memberId) });
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Return safe user data (exclude sensitive fields)
  return NextResponse.json({
    id: member._id.toString(),
    name: member.name,
    email: member.email,
    familyRole: member.familyRole,
    profile: member.profile,
    createdAt: member.createdAt,
  });
}
