import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUsersCollection } from "@/lib/models/User";
import { getFamiliesCollection } from "@/lib/Family";
import { getCollection } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { createDownloadUrl, createDownloadUrlsForPrefix, listFiles } from "@/services/storageClient";
import type { DocumentDocument } from "@/../../packages/db/documents";
import type { ProfileDocument } from "@/../../packages/db/profiles";
import type { DocumentVersionDocument } from "@/../../packages/db/documentVersions";

function buildSummaryPreview(summaryFull: any): string | undefined {
  if (!summaryFull) return undefined;
  if (typeof summaryFull === "object") {
    const firstFinding = Array.isArray(summaryFull.key_findings) && summaryFull.key_findings[0]
      ? String(summaryFull.key_findings[0])
      : "";
    const inDepth = typeof summaryFull.in_depth_summary === "string" ? summaryFull.in_depth_summary : "";
    const base = firstFinding || inDepth;
    return base ? (base.length > 160 ? base.slice(0, 160) + "..." : base) : undefined;
  }
  if (typeof summaryFull === "string") return summaryFull;
  return undefined;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  if (!documentId) {
    return NextResponse.json({ error: "Document id is required" }, { status: 400 });
  }

  const users = await getUsersCollection();
  const families = await getFamiliesCollection();

  const currentUser = await users.findOne({ email: session.user.email });
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!currentUser.familyId) {
    await logAudit(req, {
      actorId: currentUser._id.toString(),
      action: "document.download",
      target: documentId,
      targetType: "document",
      result: "failure",
      metadata: { reason: "not in family" },
    });
    return NextResponse.json({ error: "You are not part of a family" }, { status: 403 });
  }

  const family = await families.findOne({ _id: new ObjectId(currentUser.familyId) });
  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  const documentsCol = await getCollection<DocumentDocument>("documents");
  const doc = await documentsCol.findOne({ id: documentId } as any);
  if (!doc || doc.status === "deleted") {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const profilesCol = await getCollection<ProfileDocument>("profiles");
  const profile = await profilesCol.findOne({ id: doc.profileId } as any);
  const ownerUserId = doc.ownerUserId || profile?.userId;

  if (!ownerUserId) {
    return NextResponse.json({ error: "Document owner missing" }, { status: 400 });
  }

  const belongsToFamily = family.members.some((m: any) => m.toString() === ownerUserId);
  if (!belongsToFamily) {
    await logAudit(req, {
      actorId: currentUser._id.toString(),
      action: "document.download",
      target: documentId,
      targetType: "document",
      result: "failure",
      metadata: { reason: "target not in family" },
    });
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const versionsCol = await getCollection<DocumentVersionDocument>("documentVersions");
  const summariesCol = await getCollection<any>("summaries");
  const ocrCol = await getCollection<any>("ocrOutputs");

  const [version, summaryById, summaryByDocId, ocr] = await Promise.all([
    versionsCol.findOne({ id: doc.versionId, documentId: doc.id } as any),
    summariesCol.findOne({ id: doc.id, type: "doc" } as any),
    summariesCol.findOne({ documentId: doc.id, type: "doc" } as any),
    ocrCol.findOne({ id: `${doc.id}:${doc.versionId}` } as any),
  ]);

  const summaryFull = (summaryByDocId || summaryById)?.content ?? doc.metadata?.summary ?? null;
  const summary = buildSummaryPreview(summaryFull);

  let downloadUrl: string | null = null;
  let downloadUrls: string[] | null = null;
  try {
    downloadUrl = await createDownloadUrl({ storageKey: doc.storageKey, expiresIn: 900 });
  } catch {
    try {
      const children = await listFiles({ prefix: doc.storageKey });
      if (children && children.length > 0) {
        downloadUrls = await createDownloadUrlsForPrefix({ prefix: doc.storageKey, expiresIn: 900 });
      }
    } catch {}
  }

  await logAudit(req, {
    actorId: currentUser._id.toString(),
    action: "document.download",
    target: doc.id,
    targetType: "document",
    resourceId: doc.id,
    result: "success",
    metadata: {
      familyId: currentUser.familyId,
      ownerUserId,
    },
  });

  return NextResponse.json(
    {
      document: {
        id: doc.id,
        profileId: doc.profileId,
        docType: doc.docType,
        status: doc.status,
        processingStatus: doc.processingStatus,
        storageKey: doc.storageKey,
        versionId: doc.versionId,
        mimeType: version?.mimeType,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        summary,
        summaryFull,
        metadata: {
          patientName: doc.metadata?.patient_name,
          doctorName:
            doc.metadata?.doctor_name || (typeof ocr?.doctorName === "string" ? ocr.doctorName : undefined),
          diagnosis: doc.metadata?.diagnosis,
          reportDate: doc.metadata?.report_date,
          dob: doc.metadata?.dob,
        },
        tags: doc.tags || [],
      },
      owner: { id: ownerUserId },
      download: { url: downloadUrl, urls: downloadUrls },
    },
    { status: 200 }
  );
}
