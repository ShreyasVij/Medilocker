"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  FileText, 
  Download, 
  Eye, 
  Calendar, 
  User, 
  Mail,
  Phone,
  MapPin,
  ArrowLeft,
  FileImage,
  Activity,
  Pill,
  Stethoscope
} from "lucide-react";

interface PatientProfile {
  dob?: string;
  gender?: string;
  phone?: string;
  bloodGroup?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  medical?: {
    bloodGroup?: string;
    allergies?: string;
    conditions?: string;
    medications?: string;
  };
}

interface Patient {
  id: string;
  name: string;
  email: string;
  profile?: PatientProfile;
}

interface Document {
  id: string;
  docType: "prescription" | "lab" | "scan" | "discharge" | "other";
  storageKey: string;
  versionId: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  ocrAvailable: boolean;
  processingStatus?: "pending" | "processing" | "completed" | "failed";
  metadata?: any;
  ocrData?: any;
}

interface PatientData {
  patient: Patient;
  documents: Document[];
  totalCount: number;
}

export default function PatientDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.patientId as string;

  const [data, setData] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string>("all");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerUrls, setViewerUrls] = useState<string[] | null>(null);
  const [viewerDoc, setViewerDoc] = useState<Document | null>(null);
  const [doctorNotes, setDoctorNotes] = useState<string>("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    async function fetchPatientDocuments() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/doctor/patients/${patientId}/documents`);
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to fetch patient documents");
        }

        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error("Failed to fetch patient documents:", err);
        setError(err instanceof Error ? err.message : "Failed to load patient data");
      } finally {
        setLoading(false);
      }
    }

    async function fetchDoctorNotes() {
      try {
        setNotesLoading(true);
        const res = await fetch(`/api/doctor/patients/${patientId}/notes`);
        if (res.ok) {
          const data = await res.json();
          setDoctorNotes(data.notes || "");
        }
      } catch (err) {
        console.error("Failed to fetch doctor notes:", err);
      } finally {
        setNotesLoading(false);
      }
    }

    if (patientId) {
      fetchPatientDocuments();
      fetchDoctorNotes();
    }
  }, [patientId]);

  const getDocTypeIcon = (type: string) => {
    switch (type) {
      case "prescription":
        return <Pill className="h-5 w-5" />;
      case "lab":
        return <Activity className="h-5 w-5" />;
      case "scan":
        return <FileImage className="h-5 w-5" />;
      case "discharge":
        return <Stethoscope className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getDocTypeColor = (type: string) => {
    switch (type) {
      case "prescription":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "lab":
        return "bg-green-50 text-green-700 border-green-200";
      case "scan":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "discharge":
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const filteredDocuments = data?.documents.filter(doc => 
    selectedDocType === "all" || doc.docType === selectedDocType
  ) || [];

  const docTypeCounts = {
    all: data?.documents.length || 0,
    prescription: data?.documents.filter(d => d.docType === "prescription").length || 0,
    lab: data?.documents.filter(d => d.docType === "lab").length || 0,
    scan: data?.documents.filter(d => d.docType === "scan").length || 0,
    discharge: data?.documents.filter(d => d.docType === "discharge").length || 0,
    other: data?.documents.filter(d => d.docType === "other").length || 0,
  };

  const calculateAge = (dob: string | undefined) => {
    if (!dob) return "N/A";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleSaveNotes = async () => {
    try {
      setNotesSaving(true);
      setNotesSaved(false);
      const res = await fetch(`/api/doctor/patients/${patientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: doctorNotes })
      });

      if (!res.ok) {
        throw new Error("Failed to save notes");
      }

      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save notes:", err);
      setError(err instanceof Error ? err.message : "Failed to save notes");
      setTimeout(() => setError(null), 3000);
    } finally {
      setNotesSaving(false);
    }
  };

  const handleViewDocument = async (doc: Document) => {
    try {
      setViewerDoc(doc);
      const res = await fetch(`/api/documents/download?storageKey=${encodeURIComponent(doc.storageKey)}`);
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : { error: await res.text().catch(() => "") };
      
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to get document URL');
      }

      const urls = Array.isArray(data?.urls) ? data.urls : null;
      setViewerUrls(urls);
      setViewerUrl(data?.url || (urls && urls[0]) || null);
      setViewerOpen(true);
    } catch (err) {
      console.error("Failed to view document:", err);
      setError(err instanceof Error ? err.message : 'Failed to open document');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDownloadDocument = async (doc: Document) => {
    try {
      // First get the signed URL
      const res = await fetch(`/api/documents/download?storageKey=${encodeURIComponent(doc.storageKey)}`);
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : { error: await res.text().catch(() => "") };
      
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to get download URL');
      }

      const downloadUrl = data?.url;
      if (!downloadUrl) {
        throw new Error('No download URL received');
      }

      // Fetch the actual file content as a blob
      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) {
        throw new Error('Failed to fetch file');
      }

      const blob = await fileRes.blob();
      const fileName = doc.storageKey.split('/').pop() || `document_${doc.id}`;
      
      // Try to use File System Access API for choosing download location (modern browsers)
      if ('showSaveFilePicker' in window) {
        try {
          // Determine file extension
          const fileExtension = fileName.includes('.') ? fileName.split('.').pop() : 'pdf';
          
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [{
              description: 'Document',
              accept: {
                'application/pdf': ['.pdf'],
                'image/png': ['.png'],
                'image/jpeg': ['.jpg', '.jpeg'],
                'image/jpg': ['.jpg'],
              },
            }],
          });
          
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return; // Success - file saved to chosen location
        } catch (err: any) {
          // User cancelled the picker or browser doesn't support it
          if (err.name === 'AbortError') {
            return; // User cancelled, don't show error
          }
          console.log('File System Access API failed, falling back to standard download');
        }
      }
      
      // Fallback: Standard download (uses browser's default download location)
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to download document:", err);
      setError(err instanceof Error ? err.message : 'Failed to download document');
      setTimeout(() => setError(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading patient documents...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Data</h2>
            <p className="text-red-600 mb-4">{error || "Failed to load patient information"}</p>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Patients
          </button>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{data.patient.name}</h1>
                  <div className="mt-2 space-y-1">
                    {data.patient.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="h-4 w-4" />
                        {data.patient.email}
                      </div>
                    )}
                    {data.patient.profile?.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4" />
                        {data.patient.profile.phone}
                      </div>
                    )}
                    {data.patient.profile?.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4" />
                        {[
                          data.patient.profile.location.city,
                          data.patient.profile.location.state,
                          data.patient.profile.location.country
                        ].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm text-gray-600">Age</div>
                <div className="text-2xl font-bold text-gray-900">
                  {calculateAge(data.patient.profile?.dob)}
                </div>
                {data.patient.profile?.gender && (
                  <div className="text-sm text-gray-600 mt-1 capitalize">
                    {data.patient.profile.gender}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Patient Details (1/3) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Patient Info Summary */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Patient Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Blood Group</p>
                  <p className="text-sm font-medium text-gray-900">
                    {data.patient.profile?.medical?.bloodGroup || data.patient.profile?.bloodGroup || "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date of Birth</p>
                  <p className="text-sm font-medium text-gray-900">
                    {data.patient.profile?.dob 
                      ? new Date(data.patient.profile.dob).toLocaleDateString()
                      : "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Documents</p>
                  <p className="text-sm font-medium text-gray-900">{data.totalCount}</p>
                </div>
              </div>
            </div>

            {/* Chronic Conditions */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Chronic Conditions</h3>
              <div className="space-y-2">
                {(() => {
                  const conditions = data.patient.profile?.medical?.conditions;
                  if (!conditions) return <p className="text-sm text-gray-500">No chronic conditions recorded</p>;
                  
                  const conditionsList = Array.isArray(conditions) 
                    ? conditions 
                    : conditions.split(',').map(c => c.trim()).filter(Boolean);
                  
                  return conditionsList.length > 0 ? (
                    conditionsList.map((condition: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="h-2 w-2 rounded-full bg-red-500"></div>
                        {condition}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No chronic conditions recorded</p>
                  );
                })()}
              </div>
            </div>

            {/* Allergies */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Allergies</h3>
              <div className="space-y-2">
                {(() => {
                  const allergies = data.patient.profile?.medical?.allergies;
                  if (!allergies) return <p className="text-sm text-gray-500">No allergies recorded</p>;
                  
                  const allergiesList = Array.isArray(allergies) 
                    ? allergies 
                    : allergies.split(',').map(a => a.trim()).filter(Boolean);
                  
                  return allergiesList.length > 0 ? (
                    allergiesList.map((allergy: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                        {allergy}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No allergies recorded</p>
                  );
                })()}
              </div>
            </div>

            {/* Current Medications */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Current Medications</h3>
              <div className="space-y-2">
                {(() => {
                  const medications = data.patient.profile?.medical?.medications;
                  if (!medications) return <p className="text-sm text-gray-500">No current medications recorded</p>;
                  
                  const medicationsList = Array.isArray(medications) 
                    ? medications 
                    : medications.split(',').map(m => m.trim()).filter(Boolean);
                  
                  return medicationsList.length > 0 ? (
                    medicationsList.map((medication: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                        {medication}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No current medications recorded</p>
                  );
                })()}
              </div>
            </div>

            {/* Doctor's Notes */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Doctor's Notes</h3>
              {notesLoading ? (
                <p className="text-sm text-gray-500">Loading notes...</p>
              ) : (
                <>
                  <textarea
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    placeholder="Add your notes about this patient here..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={6}
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={handleSaveNotes}
                      disabled={notesSaving}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {notesSaving ? "Saving..." : "Save Notes"}
                    </button>
                    {notesSaved && (
                      <span className="text-sm text-green-600 font-medium">✓ Saved successfully</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column - Documents (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Document Type Filters - 2x3 Grid */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Filter by Type</h2>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedDocType("all")}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    selectedDocType === "all"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  All Documents ({docTypeCounts.all})
                </button>
                <button
                  onClick={() => setSelectedDocType("prescription")}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    selectedDocType === "prescription"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Prescriptions ({docTypeCounts.prescription})
                </button>
                <button
                  onClick={() => setSelectedDocType("lab")}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    selectedDocType === "lab"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Lab Reports ({docTypeCounts.lab})
                </button>
                <button
                  onClick={() => setSelectedDocType("scan")}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    selectedDocType === "scan"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Scans ({docTypeCounts.scan})
                </button>
                <button
                  onClick={() => setSelectedDocType("discharge")}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    selectedDocType === "discharge"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Discharge Summaries ({docTypeCounts.discharge})
                </button>
                <button
                  onClick={() => setSelectedDocType("other")}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    selectedDocType === "other"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Other ({docTypeCounts.other})
                </button>
              </div>
            </div>

            {/* Documents Grid - Fixed height with scroll */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col" style={{ height: 'calc(100vh - 320px)', minHeight: '600px' }}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Patient Documents ({filteredDocuments.length})
              </h2>

          <div className="flex-1 overflow-y-auto pr-2">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">
                {selectedDocType === "all" 
                  ? "No documents found in patient's vault" 
                  : `No ${selectedDocType} documents found`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${getDocTypeColor(doc.docType)}`}>
                      {getDocTypeIcon(doc.docType)}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getDocTypeColor(doc.docType)}`}>
                      {doc.docType.charAt(0).toUpperCase() + doc.docType.slice(1)}
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {doc.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewDocument(doc)}
                      className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    <button
                      onClick={() => handleDownloadDocument(doc)}
                      className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>

                  {doc.ocrAvailable && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <span className="text-xs text-green-600 font-medium">
                        ✓ OCR Available
                      </span>
                    </div>
                  )}

                  {doc.processingStatus && doc.processingStatus !== "completed" && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-500">
                        Status: {doc.processingStatus}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      {viewerOpen && viewerUrl && viewerDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[95%] h-[92%] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {viewerDoc.docType.charAt(0).toUpperCase() + viewerDoc.docType.slice(1)}
                </h3>
                <p className="text-sm text-gray-600">
                  {new Date(viewerDoc.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => {
                  setViewerOpen(false);
                  setViewerUrl(null);
                  setViewerUrls(null);
                  setViewerDoc(null);
                }}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                ✕ Close
              </button>
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-auto p-4">
              {viewerUrls && viewerUrls.length > 1 ? (
                <div className="space-y-2">
                  {viewerUrls.map((url, idx) => (
                    <div key={url + idx} className="mb-2">
                      <img 
                        src={url} 
                        alt={`Page ${idx + 1}`} 
                        className="w-full h-auto object-contain"
                      />
                    </div>
                  ))}
                </div>
              ) : viewerUrl && (viewerUrl.endsWith('.png') || viewerUrl.endsWith('.jpg') || viewerUrl.endsWith('.jpeg')) ? (
                <img 
                  src={viewerUrl} 
                  alt="Document" 
                  className="w-full h-auto object-contain"
                />
              ) : viewerUrl ? (
                <iframe 
                  src={viewerUrl + '#toolbar=0&navpanes=0&scrollbar=1'} 
                  title="Document Viewer" 
                  className="w-full h-full border-0"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
