import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCollection } from "@/lib/db";
import type { DoctorDocument } from "@db/doctors";
import type { UserDocument } from "@db/users";
import type { DocumentDocument } from "@db/documents";
import { ObjectId } from "mongodb";

// GET - Fetch all documents for a specific patient
export async function GET(
  req: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has doctor role
    const users = await getCollection<UserDocument>("users");
    const user = await users.findOne({ email: session.user.email });
    
    if (!user?.roles?.includes("doctor")) {
      return NextResponse.json({ error: "Not a doctor" }, { status: 403 });
    }

    // Find doctor document
    const doctors = await getCollection<DoctorDocument>("doctors");
    const doctor = await doctors.findOne({ 
      $or: [
        { email: session.user.email },
        { userId: user._id }
      ]
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
    }

    // Await params in Next.js 15+
    const { patientId } = await params;

    // Validate patient ID
    if (!ObjectId.isValid(patientId)) {
      return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
    }

    const patientObjectId = new ObjectId(patientId);

    // 1. Check User (Primary Check)
    const patientUser = await users.findOne({ _id: patientObjectId });
    if (!patientUser) {
      return NextResponse.json({ error: "Patient user account not found" }, { status: 404 });
    }

    // 2. Fetch Profile (Robust Check)
    // Check if userId is stored as an ObjectId OR as a String to prevent "Not Found" errors
    const profiles = await getCollection("profiles");
    const patientProfile = await profiles.findOne({ 
      $or: [
        { userId: patientObjectId },       // Check as ObjectId
        { userId: patientId }              // Check as String
      ]
    });

    // 3. Fetch Documents (Robust Check)
    // Documents usually store ownerUserId as a String, but check both just in case
    const documents = await getCollection<DocumentDocument>("documents");
    const patientDocuments = await documents
      .find({ 
        $or: [
          { ownerUserId: patientId },                // Check as String (Standard)
          { ownerUserId: patientObjectId }           // Check as ObjectId (Just in case)
        ],
        status: "active" // Only show active documents
      })
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`📄 Doctor ${doctor._id} fetching documents for patient ${patientId}: Found ${patientDocuments.length} documents`);

    // Helper function to generate document title
    const generateDocumentTitle = (doc: DocumentDocument) => {
      // Prefer AI-generated/metadata title when present
      if (doc.metadata?.title) return doc.metadata.title;

      // Minimal fallback: doc type + created month/year
      const docTypeName = doc.docType.charAt(0).toUpperCase() + doc.docType.slice(1);
      const date = new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      return `${docTypeName} - ${date}`;
    };

    // Format response
    const formattedDocuments = patientDocuments.map(doc => {
      return {
        id: doc.id,
        docType: doc.docType,
        title: generateDocumentTitle(doc),
        storageKey: doc.storageKey,
        versionId: doc.versionId,
        tags: doc.tags || [],
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        ocrAvailable: doc.ocrAvailable || false,
        processingStatus: doc.processingStatus,
        metadata: doc.metadata
      };
    });

    return NextResponse.json({
      patient: {
        id: patientObjectId.toString(),
        name: patientUser?.name || "Unknown",
        email: patientUser?.email,
        profile: {
          ...patientProfile,
          ...(patientUser?.profile || {}),
          // Merge profile data from both user.profile and profiles collection
          dob: patientProfile?.dateOfBirth || (patientUser as any)?.profile?.dob,
          bloodGroup: patientProfile?.bloodGroup || (patientUser as any)?.profile?.medical?.bloodGroup,
          medical: (patientUser as any)?.profile?.medical || {
            allergies: patientProfile?.allergies?.join(', '),
            conditions: patientProfile?.conditions?.join(', ')
          }
        }
      },
      documents: formattedDocuments,
      totalCount: formattedDocuments.length
    });
  } catch (err) {
    console.error("DOCTOR_PATIENT_DOCUMENTS_GET_ERROR", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
