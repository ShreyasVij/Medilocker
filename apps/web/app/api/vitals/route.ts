
import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import type { VitalReading } from "@/../../packages/db/userVitals";
import { normalizeVital } from "@/lib/vitalsProcessor";
import type { DocumentDocument } from "@/../../packages/db/documents";
import { getIdentity } from "@/lib/auth";

export async function GET() {
  try {
    const { actorId } = await getIdentity();
    if (!actorId || actorId === 'anon') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = actorId;

    // First, try to return stored AI-enriched vitals from `userVitals` (these include
    // `explanation` and `advice` fields). If none exist, fall back to extracting
    // vitals from document metadata as before.
    const vitalsCol = await getCollection<VitalReading>("userVitals");
    const storedVitals = await vitalsCol
      .find({ userId })
      .sort({ vitalCategory: 1, documentDate: -1 })
      .toArray();

    if (storedVitals && storedVitals.length > 0) {
      // Deduplicate by normalized type only: only keep the latest vital for each type
      const latestByType = new Map();
      for (const v of storedVitals) {
        const { type, normalizedLabel } = normalizeVital(v.label || v.vitalType || '');
        const key = v.vitalType || type || normalizedLabel;
        if (!key) continue;
        const existing = latestByType.get(key);
        // Always ensure advice is present if available
        const advice = v.advice || (v.aiResult && v.aiResult.advice) || '';
        if (!existing || (existing.documentDate && v.documentDate > existing.documentDate)) {
          v.explanation = v.explanation || 'No explanation available.';
          v.advice = advice;
          latestByType.set(key, v);
        }
      }
      const dedupedVitals = Array.from(latestByType.values());
      const groupedVitals: Record<string, VitalReading[]> = {};
      for (const v of dedupedVitals) {
        const category = v.vitalCategory || "Other";
        if (!groupedVitals[category]) groupedVitals[category] = [];
        groupedVitals[category].push(v);
      }
      return NextResponse.json({
        vitals: dedupedVitals,
        groupedVitals,
        totalCount: dedupedVitals.length,
      });
    }

    // No stored userVitals found — fallback to document metadata aggregation
    const docsCol = await getCollection("documents");
    const documents = await docsCol
      .find({ ownerUserId: userId, status: "active" })
      .sort({ createdAt: -1 })
      .toArray();

    // Aggregate vitals from document metadata, log all found
    const vitalsMap: Map<string, VitalReading> = new Map();
    const debugVitals: any[] = [];
    for (const docRaw of documents) {
      const doc = docRaw as unknown as DocumentDocument;
      const metadata = doc.metadata || {};
      const vitalsArr = Array.isArray((metadata as any).vitals) ? (metadata as any).vitals : [];
      const documentDate = doc.createdAt;
      const documentId = doc.id;
      const documentSource = doc.docType || "unknown";
      for (const vital of vitalsArr) {
        debugVitals.push({
          documentId,
          label: vital.label,
          value: vital.value,
          unit: vital.unit,
        });
        if (!vital.label || vital.value === undefined || vital.value === null || vital.value === "") continue;
        const { type, category, normalizedLabel } = normalizeVital(vital.label);
        // Only keep the latest reading for each vital type
        const key = type;
        const existing = vitalsMap.get(key);
        if (!existing || (existing.documentDate && documentDate > existing.documentDate)) {
          vitalsMap.set(key, {
            id: `${userId}_${type}`,
            userId,
            vitalType: type,
            vitalCategory: category,
            label: normalizedLabel,
            value: vital.value,
            unit: vital.unit || null,
            documentId,
            documentDate,
            source: documentSource,
            explanation: vital.explanation || "",
            status: vital.status || undefined,
            createdAt: documentDate,
            updatedAt: documentDate,
          });
        }
      }
    }

    // Always include all raw vitals from metadata for fallback display
    const allRawVitals: any[] = [];
    for (const docRaw of documents) {
      const doc = docRaw as unknown as DocumentDocument;
      const metadata = doc.metadata || {};
      const vitalsArr = Array.isArray((metadata as any).vitals) ? (metadata as any).vitals : [];
      const documentDate = doc.createdAt;
      const documentId = doc.id;
      const documentSource = doc.docType || "unknown";
      for (const vital of vitalsArr) {
        allRawVitals.push({
          id: `${userId}_${documentId}_${vital.label}`,
          userId,
          label: vital.label,
          value: vital.value,
          unit: vital.unit || null,
          documentId,
          documentDate,
          source: documentSource,
          explanation: vital.explanation || "",
          status: vital.status || undefined,
          vitalCategory: undefined,
        });
      }
    }

    // If no normalized vitals, fallback to all raw vitals (deduped by canonical key)
    let vitals = Array.from(vitalsMap.values());
    if (vitals.length === 0 && allRawVitals.length > 0) {
      const latestByType = new Map();
      for (const v of allRawVitals) {
        const { type, normalizedLabel } = normalizeVital(v.label || v.vitalType || '');
        const key = v.vitalType || type || normalizedLabel;
        if (!key) continue;
        const existing = latestByType.get(key);
        if (!existing || (existing.documentDate && v.documentDate > existing.documentDate)) {
          v.explanation = v.explanation || 'No explanation available.';
          v.advice = v.advice || '';
          latestByType.set(key, v);
        }
      }
      vitals = Array.from(latestByType.values());
    }
    const groupedVitals: Record<string, any[]> = {};
    vitals.forEach((vital) => {
      const category = vital.vitalCategory || "Other";
      if (!groupedVitals[category]) groupedVitals[category] = [];
      groupedVitals[category].push(vital);
    });

    return NextResponse.json({
      vitals,
      groupedVitals,
      totalCount: vitals.length,
      debugVitals,
      allRawVitals
    });
  } catch (error: any) {
    console.error("Error fetching vitals:", error);
    return NextResponse.json(
      { error: "Failed to fetch vitals", details: error.message },
      { status: 500 }
    );
  }
}
