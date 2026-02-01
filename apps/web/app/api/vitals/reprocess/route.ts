import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Buffer } from "buffer";
import { authOptions } from "@/lib/authOptions";
import { getCollection } from "@/lib/db";
import { processAndStoreVitals, regenerateHealthSummary } from "@/lib/vitalsProcessor";
import { callExtract } from "@/services/aiClient";
import { createDownloadUrl } from "@/services/storageClient";
import type { OcrOutputDocument } from "@/../../packages/db/index";
import { reprocessLogger } from "@/lib/server/logger";
import type { ProfileDocument } from "@/../../packages/db/profiles";
import type { DocumentDocument } from "@/../../packages/db/documents";
import { getIdentity } from "@/lib/auth";

// Accepts optional profileId and status query params for flexibility
export async function POST(request: NextRequest) {
  reprocessLogger.info('Starting document reprocessing');
  try {
    const { actorId, role } = await getIdentity();
    
    if (!actorId || actorId === 'anon') {
      reprocessLogger.warn('Unauthorized - no session');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = actorId;
    console.error('[REPROCESS SESSION]', { 
      userId, 
      expectedUserId: '696f61823d4c0e60894036b0'
    });
    reprocessLogger.info('User authenticated', { userId, role });

    // --- Refactored document query logic to match dashboard/documents API ---
    const docsCol = await getCollection<DocumentDocument>("documents");
    const profilesCol = await getCollection<ProfileDocument>("profiles");
    // Accept profileId and status from query params, fallback to default
    const url = request?.nextUrl;
    let profileId = url?.searchParams.get('profileId') || 'default-profile';
    let statusFilter = url?.searchParams.get('status') || 'active,archived';  // Changed to process both active and archived
    // If statusFilter is a comma-separated list, split it
    let statusList: string[] = [];
    if (statusFilter.includes(',')) {
      statusList = statusFilter.split(',').map(s => s.trim());
    } else {
      statusList = [statusFilter];
    }
    // Resolve/auto-create a profile for the actor if a placeholder was provided
    if (profileId === 'default-profile' || !profileId) {
      reprocessLogger.info('Looking up profile', { userId });
      const existing = await profilesCol.findOne({ userId } as any);
      if (existing) {
        profileId = existing.id;
        reprocessLogger.info('Found existing profile', { profileId, existingKeys: Object.keys(existing) });
      } else {
        const now = new Date();
        const newProfile: ProfileDocument = {
          id: crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).slice(2)),
          userId,
          type: 'self',
          displayName: 'Self',
          allergies: [],
          conditions: [],
          guardians: [],
          vitalIdentifiers: {},
          createdAt: now,
          updatedAt: now,
        } as any;
        await profilesCol.insertOne(newProfile as any);
        profileId = newProfile.id;
        reprocessLogger.info('Created new profile', { profileId });
      }
    }
    reprocessLogger.debug('Resolved profileId and status', { userId, profileId, statusList });
    
    // Check what documents exist first
    const allDocs = await docsCol.find({}).limit(10).toArray();
    reprocessLogger.info('Sample documents in DB', { 
      count: allDocs.length, 
      samples: allDocs.map((d: any) => ({ 
        id: d.id, 
        profileId: d.profileId, 
        ownerUserId: d.ownerUserId,
        status: d.status 
      })) 
    });
    
    // Permission check could be added here if needed
    // Query documents by profileId/status OR ownerUserId/status (robust matching)
    // ownerUserId should match the user's id (string) in MongoDB
    let documents = await docsCol
      .find({
        $or: [
          { profileId, status: { $in: statusList } },
          { ownerUserId: userId, status: { $in: statusList } }
        ]
      } as any)
      .sort({ createdAt: -1 })
      .toArray();
    reprocessLogger.debug('Query result', { count: documents.length, profileId, statusList, ownerUserId: userId });
    if (documents.length === 0) {
      console.error('[REPROCESS] No documents found!');
      console.error('[REPROCESS] Search criteria:', { profileId, statusList, ownerUserId: userId });
      console.error('[REPROCESS] All docs in DB:', allDocs.map((d: any) => ({ 
        id: d.id, 
        profileId: d.profileId, 
        ownerUserId: d.ownerUserId,
        status: d.status 
      })));
      reprocessLogger.warn('No documents to process', { profileId, statusList, ownerUserId: userId });
      return NextResponse.json({
        message: "No documents found to process",
        totalDocuments: 0,
        documentsProcessed: 0,
        vitalsUpdated: 0,
        debug: {
          searchedProfileId: profileId,
          searchedUserId: userId,
          searchedStatuses: statusList,
          samplesInDB: allDocs.map((d: any) => ({ 
            profileId: d.profileId, 
            ownerUserId: d.ownerUserId,
            status: d.status 
          }))
        }
      });
    }
    
    // Log document details for debugging
    for (const doc of documents) {
      const docData = doc as any;
      reprocessLogger.debug('Document details', { 
        id: docData.id, 
        versionId: docData.versionId,
        hasMetadata: !!docData.metadata,
        hasVitals: !!(docData.metadata?.vitals),
        processingStatus: docData.processingStatus,
        ocrAvailable: docData.ocrAvailable
      });
    }

    let processedCount = 0;
    let vitalsUpdated = 0;
    const errors: string[] = [];

    console.log('[REPROCESS] About to process documents', { count: documents.length });
    
    // Process each document for vitals
    for (const doc of documents) {
      try {
        const docData = doc as any;
        console.log('[REPROCESS] Processing document', { documentId: docData.id, versionId: docData.versionId });
        reprocessLogger.info('Processing document', { documentId: docData.id });
        const metadata = docData.metadata || {};
        let vitals = metadata.vitals;

        reprocessLogger.debug('Document vitals check', { 
          documentId: docData.id, 
          hasVitals: Array.isArray(vitals) && vitals.length > 0,
          vitalsCount: Array.isArray(vitals) ? vitals.length : 0
        });

        // ALWAYS ensure OCR text exists for health summary generation
        const ocrCol = await getCollection<OcrOutputDocument>('ocrOutputs');
        const ocrId = `${docData.id}:${docData.versionId}`;
        
        // Check if OCR already exists
        let existingOcr = await ocrCol.findOne({ id: ocrId } as any);
        console.log('[REPROCESS] OCR check', { documentId: docData.id, exists: !!existingOcr, hasText: !!(existingOcr?.text) });
        
        // If OCR doesn't exist or has no text, extract it
        if (!existingOcr || !existingOcr.text) {
          console.log('[REPROCESS] Extracting OCR for document', { documentId: docData.id });
          let ocrText = '';
          
          try {
            if (!docData.storageKey) {
              console.error('[REPROCESS] Missing storageKey', { documentId: docData.id });
              errors.push(`Document ${docData.id}: Missing storageKey`);
              continue;
            }
            
            const signedUrl = await createDownloadUrl({ storageKey: docData.storageKey, expiresIn: 900 });
            const res = await fetch(signedUrl);
            if (!res.ok) {
              throw new Error(`fetch failed: ${res.status}`);
            }
            const buf = Buffer.from(await res.arrayBuffer());
            const base64 = buf.toString('base64');
            const extractRes = await callExtract({
              fileName: docData.storageKey.split('/').pop() || `${docData.id}.bin`,
              contentBase64: base64
            });
            
            console.log('[REPROCESS] AI response keys', { documentId: docData.id, keys: extractRes ? Object.keys(extractRes) : [] });
            ocrText = extractRes?.data?.raw_text || extractRes?.raw_text || extractRes?.text || extractRes?.ocr_text || '';
            console.log('[REPROCESS] Extraction complete', { documentId: docData.id, textLength: ocrText.length, hasRawText: !!extractRes?.data?.raw_text });
            
            // Store OCR text
            await ocrCol.updateOne(
              { id: ocrId } as any,
              {
                $set: {
                  id: ocrId,
                  documentId: docData.id,
                  versionId: docData.versionId,
                  text: ocrText,
                  engine: 'ai-extract',
                  confidence: 0.9,
                  userId: docData.ownerUserId,
                  updatedAt: new Date()
                },
                $setOnInsert: { createdAt: new Date() }
              } as any,
              { upsert: true } as any
            );
            console.log('[REPROCESS] OCR stored', { documentId: docData.id, textLength: ocrText.length });
            
            // If no vitals exist, extract them from the result
            const extractedData = extractRes?.data || extractRes;
            if ((!Array.isArray(vitals) || vitals.length === 0) && extractedData && Array.isArray(extractedData.vitals) && extractedData.vitals.length > 0) {
              vitals = extractedData.vitals;
              reprocessLogger.info('Vitals extracted, updating metadata', {
                documentId: docData.id,
                vitalsCount: vitals.length
              });
              // Update document with extracted metadata
              await docsCol.updateOne(
                { id: docData.id } as any,
                {
                  $set: {
                    'metadata.vitals': vitals,
                    'metadata.patient_name': extractedData.patient_name || metadata.patient_name,
                    'metadata.dob': extractedData.dob || metadata.dob,
                    'metadata.report_date': extractedData.report_date || metadata.report_date,
                    'metadata.doctor_name': extractedData.doctor_name || metadata.doctor_name,
                    'metadata.diagnosis': extractedData.diagnosis || metadata.diagnosis,
                    'metadata.medications': extractedData.medications || metadata.medications || [],
                    'metadata.classification': extractedData.classification || metadata.classification,
                    processingStatus: 'completed',
                    ocrAvailable: true,
                    updatedAt: new Date()
                  }
                }
              );
            }
          } catch (extractErr: any) {
            console.error('[REPROCESS] Extraction failed', { documentId: docData.id, error: extractErr.message });
            reprocessLogger.error('Extraction failed', {
              documentId: docData.id,
              error: extractErr.message
            });
            errors.push(`Document ${docData.id}: Failed to extract - ${extractErr.message}`);
            continue;
          }
        }

        // Skip if still no vitals after extraction attempt
        if (!Array.isArray(vitals) || vitals.length === 0) {
          console.log('[REPROCESS] No vitals available', { documentId: docData.id });
          reprocessLogger.warn('No vitals available, skipping vitals processing', { documentId: docData.id });
          processedCount++;
          continue;
        }

        // Parse document date
        let documentDate: Date | null = null;
        if (metadata.report_date) {
          try {
            documentDate = new Date(metadata.report_date);
            if (isNaN(documentDate.getTime())) {
              documentDate = docData.createdAt || new Date();
            }
          } catch {
            documentDate = docData.createdAt || new Date();
          }
        } else {
          documentDate = docData.createdAt || new Date();
        }

        // Process vitals for this document
        reprocessLogger.info('Processing vitals', { 
          documentId: docData.id, 
          vitalsCount: vitals.length 
        });
        await processAndStoreVitals({
          userId,
          documentId: docData.id,
          vitals,
          documentDate,
          documentSource: metadata.classification || 'Medical Document'
        });

        processedCount++;
        vitalsUpdated += vitals.length;
        reprocessLogger.info('Document processed successfully', { documentId: docData.id });
      } catch (err: any) {
        reprocessLogger.error('Document processing failed', { 
          documentId: (doc as any).id, 
          error: err.message 
        });
        errors.push(`Document ${(doc as any).id}: ${err.message}`);
      }
    }

    // Regenerate health summary after processing all documents
    reprocessLogger.info('Regenerating health summary', { userId });
    try {
      await regenerateHealthSummary(userId);
      reprocessLogger.info('Health summary regenerated successfully');
    } catch (err: any) {
      reprocessLogger.error('Health summary regeneration failed', { error: err.message });
      errors.push(`Health summary: ${err.message}`);
    }

    const result = {
      success: true,
      message: "Documents reprocessed successfully",
      totalDocuments: documents.length,
      documentsProcessed: processedCount,
      vitalsUpdated,
      errors: errors.length > 0 ? errors : undefined
    };
    
    reprocessLogger.info('Reprocessing completed', result);
    return NextResponse.json(result);

  } catch (error: any) {
    reprocessLogger.error('Fatal error', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: "Failed to reprocess documents", details: error.message },
      { status: 500 }
    );
  }
}
