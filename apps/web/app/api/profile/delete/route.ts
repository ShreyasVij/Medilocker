import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCollection } from "@/lib/db";
import type { UserDocument } from "@db/users";
import { ObjectId } from "mongodb";

/**
 * DELETE /api/profile/delete
 * Permanently delete user profile and all associated data
 * 
 * This will delete:
 * - User account
 * - Profile data
 * - All uploaded documents
 * - OCR outputs
 * - Summaries
 * - Health scores
 * - Trends
 * - Timeline entries
 * - Vitals
 * - Insights
 * - Shares
 * - Sessions
 * - Audit logs
 * - Emergency tokens
 * - Appointments (as patient)
 * - Doctor-patient notes (as patient)
 */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user
    const users = await getCollection<UserDocument>("users");
    const user = await users.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = user._id;
    const userIdString = userId.toString();

    console.log(`🗑️ Starting profile deletion for user: ${userIdString}`);

    // Delete all user data across collections
    const deletionResults = {
      documents: 0,
      ocrOutputs: 0,
      summaries: 0,
      healthScores: 0,
      trends: 0,
      timeline: 0,
      userVitals: 0,
      insights: 0,
      shares: 0,
      sessions: 0,
      audits: 0,
      emergencyTokens: 0,
      emergencyAudit: 0,
      appointments: 0,
      doctorNotes: 0,
      profiles: 0,
      classifications: 0,
      labStructured: 0,
      userHealthSummary: 0,
      user: 0,
    };


    // 1. Delete documents
    const documents = await getCollection("documents");
    const documentsList = await documents.find({
      $or: [
        { ownerUserId: userIdString },
        { ownerUserId: userId }
      ]
    }).toArray();
    const documentIds = documentsList.map((doc: any) => doc.id);
    // Gather all storage keys for Supabase cleanup
    const storageKeys = [];
    for (const doc of documentsList) {
      if (doc?.storageKey) storageKeys.push(doc.storageKey);
    }
    // Remove all user files from Supabase Storage (best-effort)
    try {
      const { deleteStorageObjects } = await import("@/services/storageClient");
      await deleteStorageObjects({
        // Use default bucket (medilocker) or env
        keys: storageKeys
      });
    } catch (e) {
      console.error("Supabase storage cleanup failed", e);
    }
    // Now delete documents from DB
    const documentsResult = await documents.deleteMany({
      $or: [
        { ownerUserId: userIdString },
        { ownerUserId: userId }
      ]
    });
    deletionResults.documents = documentsResult.deletedCount;

    // 2. Delete OCR outputs (find document IDs first)
    if (documentIds.length > 0) {
      const ocrOutputs = await getCollection("ocrOutputs");
      const ocrResult = await ocrOutputs.deleteMany({
        documentId: { $in: documentIds }
      });
      deletionResults.ocrOutputs = ocrResult.deletedCount;
    }

    // 3. Delete summaries
    const summaries = await getCollection("summaries");
    const summariesResult = await summaries.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.summaries = summariesResult.deletedCount;

    // 4. Delete health scores
    const healthScores = await getCollection("healthScores");
    const healthScoresResult = await healthScores.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.healthScores = healthScoresResult.deletedCount;

    // 5. Delete trends
    const trends = await getCollection("trends");
    const trendsResult = await trends.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.trends = trendsResult.deletedCount;

    // 6. Delete timeline entries
    const timeline = await getCollection("timeline");
    const timelineResult = await timeline.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.timeline = timelineResult.deletedCount;

    // 7. Delete user vitals
    const userVitals = await getCollection("userVitals");
    const userVitalsResult = await userVitals.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.userVitals = userVitalsResult.deletedCount;

    // 8. Delete insights
    const insights = await getCollection("insights");
    const insightsResult = await insights.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.insights = insightsResult.deletedCount;

    // 9. Delete shares
    const shares = await getCollection("shares");
    const sharesResult = await shares.deleteMany({
      $or: [
        { ownerId: userIdString },
        { ownerId: userId }
      ]
    });
    deletionResults.shares = sharesResult.deletedCount;

    // 10. Delete sessions
    const sessions = await getCollection("sessions");
    const sessionsResult = await sessions.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.sessions = sessionsResult.deletedCount;

    // 11. Delete audit logs
    const audits = await getCollection("audits");
    const auditsResult = await audits.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.audits = auditsResult.deletedCount;

    // 12. Delete emergency tokens
    const emergencyTokens = await getCollection("emergencyTokens");
    const emergencyTokensResult = await emergencyTokens.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.emergencyTokens = emergencyTokensResult.deletedCount;

    // 13. Delete emergency audit logs
    const emergencyAudit = await getCollection("emergencyAudit");
    const emergencyAuditResult = await emergencyAudit.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.emergencyAudit = emergencyAuditResult.deletedCount;

    // 14. Delete appointments (as patient)
    const appointments = await getCollection("appointments");
    const appointmentsResult = await appointments.deleteMany({
      $or: [
        { patientId: userIdString },
        { patientId: userId }
      ]
    });
    deletionResults.appointments = appointmentsResult.deletedCount;

    // 15. Delete doctor-patient notes (as patient)
    const doctorPatientNotes = await getCollection("doctorPatientNotes");
    const doctorNotesResult = await doctorPatientNotes.deleteMany({
      $or: [
        { patientId: userIdString },
        { patientId: userId }
      ]
    });
    deletionResults.doctorNotes = doctorNotesResult.deletedCount;

    // 16. Delete profiles
    const profiles = await getCollection("profiles");
    const profilesResult = await profiles.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.profiles = profilesResult.deletedCount;

    // 17. Delete classifications
    const classifications = await getCollection("classifications");
    const classificationsResult = await classifications.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.classifications = classificationsResult.deletedCount;

    // 18. Delete lab structured data
    const labStructured = await getCollection("labStructured");
    const labStructuredResult = await labStructured.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.labStructured = labStructuredResult.deletedCount;

    // 19. Delete user health summary
    const userHealthSummary = await getCollection("userHealthSummary");
    const userHealthSummaryResult = await userHealthSummary.deleteMany({
      $or: [
        { userId: userIdString },
        { userId: userId }
      ]
    });
    deletionResults.userHealthSummary = userHealthSummaryResult.deletedCount;

    // 20. Finally, delete the user account itself
    const userResult = await users.deleteOne({ _id: userId });
    deletionResults.user = userResult.deletedCount;

    console.log(`✅ Profile deletion completed for user: ${userIdString}`, deletionResults);

    return NextResponse.json({
      success: true,
      message: "Profile and all associated data deleted successfully",
      deletionResults
    });
  } catch (err) {
    console.error("PROFILE_DELETE_ERROR", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
