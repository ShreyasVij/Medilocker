import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "@/lib/models/User";
import { getFamiliesCollection } from "@/lib/Family";
import { getCollection } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { EmergencyToken } from "@/../../packages/db/emergencyTokens";
import type { ProfileDocument } from "@/../../packages/db/profiles";

/**
 * DELETE /api/family
 * Delete the entire family (owner only)
 * - Only family owner can delete the family
 * - Removes all members from family
 * - Revokes all emergency tokens for all members
 * - Logs action in audit trail
 * - Deletes the family document
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Check if user is the family owner
  if (currentUser.familyRole !== "owner") {
    await logAudit(req, {
      actorId: currentUser._id.toString(),
      action: "admin.action" as any,
      target: currentUser.familyId,
      targetType: "system",
      result: "failure",
      metadata: { reason: "Not family owner", action: "delete_family" },
    });
    return NextResponse.json(
      { error: "Only the family owner can delete the family" },
      { status: 403 }
    );
  }

  // Get the family
  const family = await families.findOne({
    _id: new ObjectId(currentUser.familyId),
  });

  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  try {
    const memberIds = family.members.map((id) => id.toString());

    // 1. Get all member profiles to revoke emergency tokens
    const profilesCol = await getCollection<ProfileDocument>("profiles");
    const emergencyTokensCol = await getCollection<EmergencyToken>("emergencyTokens");

    let totalRevokedTokens = 0;
    for (const memberId of memberIds) {
      const memberProfiles = await profilesCol
        .find({ userId: memberId })
        .toArray();

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
        totalRevokedTokens += result.modifiedCount;
      }
    }

    // 2. Remove family information from all members
    await users.updateMany(
      { _id: { $in: family.members } },
      {
        $set: {
          familyId: null,
          familyRole: null,
          updatedAt: new Date(),
        },
      }
    );

    // 3. Delete the family document
    await families.deleteOne({ _id: family._id });

    // 4. Log the action
    await logAudit(req, {
      actorId: currentUser._id.toString(),
      action: "admin.action" as any,
      target: family._id.toString(),
      targetType: "system",
      result: "success",
      metadata: {
        action: "delete_family",
        memberCount: memberIds.length,
        revokedTokenCount: totalRevokedTokens,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Family deleted successfully",
      removedMembers: memberIds.length,
      revokedTokenCount: totalRevokedTokens,
    });
  } catch (error) {
    console.error("Error deleting family:", error);

    await logAudit(req, {
      actorId: currentUser._id.toString(),
      action: "admin.action" as any,
      target: family._id.toString(),
      targetType: "system",
      result: "failure",
      metadata: {
        action: "delete_family",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json(
      { error: "Failed to delete family" },
      { status: 500 }
    );
  }
}
