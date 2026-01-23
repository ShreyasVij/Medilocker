import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "@/lib/models/User";
import { getFamiliesCollection } from "@/lib/Family";
import { getCollection } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { DocumentDocument } from "@/../../packages/db/documents";
import type { ProfileDocument } from "@/../../packages/db/profiles";
import type { DocumentVersionDocument } from "@/../../packages/db/documentVersions";

/**
 * GET /api/family/members/[memberId]/documents
 * Fetch all documents for a specific family member
 * - RBAC enforcement: only family members in same family can access
 * - Prevents access to removed members (no longer in family)
 * - Prevents guessing IDs (validates family membership)
 * - Supports emergency mode (future implementation)
 * - Returns documents sorted by date, with filtering and search support
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
  const { searchParams } = req.nextUrl;

  // Parse query parameters
  const searchQuery = searchParams.get("search") || "";
  const docTypeFilter = searchParams.get("type") as DocumentDocument["docType"] | null;
  const statusFilter = (searchParams.get("status") || "active") as DocumentDocument["status"];
  const sortBy = searchParams.get("sortBy") || "date"; // date, type, name
  const sortOrder = searchParams.get("sortOrder") || "desc"; // asc, desc

  // Validate memberId
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

  // Check if current user is part of a family
  if (!currentUser.familyId) {
    await logAudit(req, {
      actorId: currentUser._id.toString(),
      action: "document.download" as any,
      target: memberId,
      targetType: "user",
      result: "failure",
      metadata: { reason: "Not part of a family", action: "view_member_documents" },
    });
    return NextResponse.json(
      { error: "You are not part of a family" },
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

  // Verify current user is in the family
  const isCurrentUserInFamily = family.members.some(
    (m) => m.toString() === currentUser._id.toString()
  );

  if (!isCurrentUserInFamily) {
    await logAudit(req, {
      actorId: currentUser._id.toString(),
      action: "document.download" as any,
      target: memberId,
      targetType: "user",
      result: "failure",
      metadata: { reason: "Not in family", action: "view_member_documents" },
    });
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Verify target member is in the family (prevents access to removed members or guessed IDs)
  const isMemberInFamily = family.members.some(
    (m) => m.toString() === memberId
  );

  if (!isMemberInFamily) {
    await logAudit(req, {
      actorId: currentUser._id.toString(),
      action: "document.download" as any,
      target: memberId,
      targetType: "user",
      result: "failure",
      metadata: {
        reason: "Member not in family or removed",
        action: "view_member_documents",
      },
    });
    return NextResponse.json(
      { error: "Member not found or has been removed from family" },
      { status: 404 }
    );
  }

  // Get target member details
  const targetMember = await users.findOne({ _id: new ObjectId(memberId) });
  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  try {
    // Get all profiles for the target member
    const profilesCol = await getCollection<ProfileDocument>("profiles");
    const memberProfiles = await profilesCol
      .find({ userId: memberId })
      .toArray();

    if (memberProfiles.length === 0) {
      return NextResponse.json({
        member: {
          id: targetMember._id.toString(),
          name: targetMember.name,
          email: targetMember.email,
          familyRole: targetMember.familyRole,
        },
        documents: [],
        totalCount: 0,
      });
    }

    // Get profile IDs
    const profileIds = memberProfiles.map((p) => p.id);

    // Build query for documents
    const documentsCol = await getCollection<DocumentDocument>("documents");
    const query: any = {
      profileId: { $in: profileIds },
      status: statusFilter,
    };

    // Add document type filter if specified
    if (docTypeFilter) {
      query.docType = docTypeFilter;
    }

    // Add search filter (search in metadata or tags)
    if (searchQuery) {
      query.$or = [
        { "metadata.patient_name": { $regex: searchQuery, $options: "i" } },
        { "metadata.doctor_name": { $regex: searchQuery, $options: "i" } },
        { "metadata.diagnosis": { $regex: searchQuery, $options: "i" } },
        { tags: { $regex: searchQuery, $options: "i" } },
      ];
    }

    // Determine sort order
    let sortOptions: any = {};
    if (sortBy === "date") {
      sortOptions.createdAt = sortOrder === "asc" ? 1 : -1;
    } else if (sortBy === "type") {
      sortOptions.docType = sortOrder === "asc" ? 1 : -1;
      sortOptions.createdAt = -1; // Secondary sort by date
    }

    // Fetch documents
    const documents = await documentsCol
      .find(query)
      .sort(sortOptions)
      .limit(100)
      .toArray();

    // Enrich documents with additional data (summaries, versions)
    const summariesCol = await getCollection<any>("summaries");
    const versionsCol = await getCollection<DocumentVersionDocument>("documentVersions");
    const ocrCol = await getCollection<any>("ocrOutputs");

    const enrichedDocuments = await Promise.all(
      documents.map(async (doc: any) => {
        const [summary, version, ocr] = await Promise.all([
          summariesCol.findOne({ documentId: doc.id, type: "doc" }),
          versionsCol.findOne({ id: doc.versionId, documentId: doc.id }),
          ocrCol.findOne({ id: `${doc.id}:${doc.versionId}` }),
        ]);

        const meta = doc.metadata || {};
        const summaryContent = summary?.content || meta.summary;

        // Create preview text
        let summaryPreview: string | undefined;
        if (summaryContent && typeof summaryContent === "object") {
          const firstFinding =
            Array.isArray(summaryContent.key_findings) &&
            summaryContent.key_findings[0]
              ? String(summaryContent.key_findings[0])
              : "";
          const inDepth =
            typeof summaryContent.in_depth_summary === "string"
              ? summaryContent.in_depth_summary
              : "";
          const base = firstFinding || inDepth;
          summaryPreview = base
            ? base.length > 160
              ? base.slice(0, 160) + "…"
              : base
            : undefined;
        } else if (typeof summaryContent === "string") {
          summaryPreview = summaryContent;
        }

        return {
          id: doc.id,
          profileId: doc.profileId,
          docType: doc.docType,
          storageKey: doc.storageKey,
          versionId: doc.versionId,
          mimeType: version?.mimeType,
          status: doc.status,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          summary: summaryPreview,
          summaryFull: summaryContent,
          metadata: {
            patientName: meta.patient_name,
            doctorName: meta.doctor_name,
            diagnosis: meta.diagnosis,
            reportDate: meta.report_date,
            dob: meta.dob,
          },
          tags: doc.tags || [],
        };
      })
    );

    // Log successful access
    await logAudit(req, {
      actorId: currentUser._id.toString(),
      action: "document.download" as any,
      target: memberId,
      targetType: "user",
      result: "success",
      metadata: {
        action: "view_member_documents",
        documentCount: enrichedDocuments.length,
        searchQuery: searchQuery || undefined,
        docTypeFilter: docTypeFilter || undefined,
      },
    });

    return NextResponse.json({
      member: {
        id: targetMember._id.toString(),
        name: targetMember.name,
        email: targetMember.email,
        familyRole: targetMember.familyRole,
        profile: targetMember.profile,
      },
      documents: enrichedDocuments,
      totalCount: enrichedDocuments.length,
      filters: {
        search: searchQuery,
        type: docTypeFilter,
        status: statusFilter,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    console.error("Error fetching member documents:", error);

    await logAudit(req, {
      actorId: currentUser._id.toString(),
      action: "document.download" as any,
      target: memberId,
      targetType: "user",
      result: "failure",
      metadata: {
        action: "view_member_documents",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
