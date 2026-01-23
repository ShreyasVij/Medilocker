import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import type { UserHealthSummary } from "@/../../packages/db/userHealthSummary";
import type { OcrOutputDocument } from "@/../../packages/db/ocrOutputs";
import { callHealthSummaryPrompt } from "@/services/aiClient";
import { randomUUID } from 'crypto';
import { getIdentity } from "@/lib/auth";

export async function GET() {
  try {
    const { actorId } = await getIdentity();
    
    if (!actorId || actorId === 'anon') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = actorId;

    // Fetch existing health summary
    const summaryCol = await getCollection<UserHealthSummary>("userHealthSummary");
    const summary = await summaryCol.findOne({ userId });

    // Determine if any processing is currently happening for this user.
    // Only treat jobs/docs as "processing" if they are recent to avoid stale records.
    const docsCol = await getCollection("documents");
    const jobsCol = await getCollection("jobs");
    const RECENT_MS = 1000 * 60 * 10; // 10 minutes
    const recentThreshold = new Date(Date.now() - RECENT_MS);

    // If any *recent* document is still being processed (ingest pipeline), consider processing true
    const docProcessing = await docsCol.findOne({
      ownerUserId: userId,
      processingStatus: { $ne: 'done' },
      updatedAt: { $gte: recentThreshold }
    });

    // If any *recent* job for this user is pending/running, consider processing true
    const jobProcessing = await jobsCol.findOne({
      type: { $in: ['ingest','health-summary'] },
      status: { $in: ['pending','running'] },
      createdAt: { $gte: recentThreshold },
      $or: [ { 'payload.ownerUserId': userId }, { 'payload.ownerId': userId }, { 'payload.profileId': userId }, { 'payload.userId': userId } ]
    });

    const processing = Boolean(docProcessing) || Boolean(jobProcessing);

    // Count active + archived documents to decide whether a stored summary should be shown.
    const activeArchivedCount = await docsCol.countDocuments({ ownerUserId: userId, status: { $in: ['active', 'archived'] } });

    // If there are no active or archived documents, remove any stored summary and return empty
    // so the UI does not show stale summaries after deletion.
    if (activeArchivedCount === 0) {
      try {
        if (summary) {
          const summaryColDel = await getCollection<UserHealthSummary>('userHealthSummary');
          await summaryColDel.deleteOne({ userId } as any);
        }
      } catch (e) {
        // non-fatal
      }
      return NextResponse.json({
        summary: null,
        processing: false,
        message: 'No documents available for analysis.'
      });
    }

    if (!summary) {
      return NextResponse.json({
        summary: {
          summary: '',
          sections: [],
          generatedAt: null,
          documentCount: 0,
          lastDocumentDate: null
        },
        processing,
        message: "No health summary available yet. Upload documents to generate one."
      });
    }

    // Defensive: always provide summary and sections fields
    return NextResponse.json({
      summary: {
        ...summary,
        summary: summary.summary || '',
        sections: Array.isArray(summary.sections) ? summary.sections : [],
      },
      processing
    });
  } catch (error: any) {
    console.error("Error fetching health summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch health summary", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const { actorId } = await getIdentity();
    
    if (!actorId || actorId === 'anon') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = actorId;

    // Get all documents for this user (only active)
    const docsCol = await getCollection("documents");
    const documents = await docsCol
      .find({ 
        ownerUserId: userId,
        status: "active"
      })
      .sort({ createdAt: -1 })
      .toArray();

    if (documents.length === 0) {
      return NextResponse.json({
        summary: null,
        message: "No documents available for analysis."
      });
    }

    // Get OCR text for all documents using userId
    const ocrCol = await getCollection<OcrOutputDocument>("ocrOutputs");
    let ocrRecords = await ocrCol.find({ userId }).toArray();
    console.log('[HEALTH_SUMMARY] Query by userId:', userId, 'found:', ocrRecords.length);
    if (ocrRecords.length === 0) {
      // Fallback: try ownerId
      ocrRecords = await ocrCol.find({ ownerId: userId }).toArray();
      console.log('[HEALTH_SUMMARY] Fallback query by ownerId:', userId, 'found:', ocrRecords.length);
    }
    if (ocrRecords.length === 0) {
      // Fallback: try all documents for this user
      const docIds = documents.map((doc: any) => doc.id);
      ocrRecords = await ocrCol.find({ documentId: { $in: docIds } }).toArray();
      console.log('[HEALTH_SUMMARY] Fallback query by documentId in user docs, found:', ocrRecords.length);
    }
    if (ocrRecords.length > 0) {
      console.log('[HEALTH_SUMMARY] Sample OCR text length:', ocrRecords[0].text?.length);
    }
    const ocrTexts: string[] = ocrRecords.map(r => r.text).filter(Boolean);

    if (ocrTexts.length === 0) {
      return NextResponse.json({
        summary: null,
        message: "No OCR text available for analysis."
      });
    }

    // Track the most recent document date from documents
    let lastDocDate: Date | null = null;
    for (const doc of documents) {
      const docData = doc as any;
      if (!lastDocDate || docData.createdAt > lastDocDate) {
        lastDocDate = docData.createdAt;
      }
    }

    // Create a job entry so clients can detect that summary generation is in progress
    const jobsCol = await getCollection('jobs');
    const jobId = randomUUID();
    const jobDoc = {
      id: jobId,
      type: 'health-summary',
      status: 'running',
      attempts: 0,
      priority: 10,
      payload: { userId },
      createdAt: new Date(),
      updatedAt: new Date()
    } as any;
    await jobsCol.insertOne(jobDoc);

    // Compose documentsData for AI summary prompt
    const documentsData = documents.map((doc: any) => ({
      id: doc.id,
      docType: doc.docType,
      createdAt: doc.createdAt,
      vitals: Array.isArray(doc.metadata?.vitals) ? doc.metadata.vitals : [],
      labs: doc.metadata?.labs || [],
      diagnosis: doc.metadata?.diagnosis || '',
      medications: doc.metadata?.medications || [],
      summary: doc.metadata?.summary || '',
    }));
    let aiResult: any = {};
    try {
      aiResult = await callHealthSummaryPrompt({ documentsData, ocrTexts });
    } catch (e) {
      // mark job failed
      try { await jobsCol.updateOne({ id: jobId }, { $set: { status: 'failed', updatedAt: new Date(), error: String(e?.message || e) } }); } catch {}
      throw e;
    }

    // Store in database
    const summaryCol = await getCollection<UserHealthSummary>("userHealthSummary");
    const summaryData: UserHealthSummary = {
      id: userId,
      userId,
      summary: aiResult.summary || '',
      sections: Array.isArray(aiResult.sections) ? aiResult.sections : [],
      generatedAt: new Date(),
      documentCount: documents.length,
      lastDocumentDate: lastDocDate
    };

    await summaryCol.updateOne(
      { userId },
      { $set: summaryData },
      { upsert: true }
    );

    // Mark job completed
    try {
      await jobsCol.updateOne({ id: jobId }, { $set: { status: 'completed', completedAt: new Date(), updatedAt: new Date() } });
    } catch {}

    return NextResponse.json({ 
      summary: summaryData,
      message: "Health summary generated successfully"
    });
  } catch (error: any) {
    console.error("Error generating health summary:", error);
    return NextResponse.json(
      { error: "Failed to generate health summary", details: error.message },
      { status: 500 }
    );
  }
}
