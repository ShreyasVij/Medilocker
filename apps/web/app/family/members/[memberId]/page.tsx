"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface MemberInfo {
  id: string;
  name: string;
  email: string;
  familyRole?: string;
  profile?: {
    phone?: string;
    dob?: Date;
    gender?: string;
    medical?: {
      bloodGroup?: string;
      allergies?: string;
      conditions?: string;
    };
  };
}

interface Document {
  id: string;
  docType: string;
  createdAt: string;
  summary?: string;
  mimeType?: string;
  metadata?: {
    patientName?: string;
    doctorName?: string;
    diagnosis?: string;
    reportDate?: string;
    dob?: string;
  };
  tags?: string[];
}

interface ApiResponse {
  member: MemberInfo;
  documents: Document[];
  totalCount: number;
  filters?: {
    search?: string;
    type?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}

export default function FamilyMemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  
  // Filters and search
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  // Unwrap params on mount
  useEffect(() => {
    params.then((p) => setMemberId(p.memberId));
  }, [params]);

  const fetchMemberDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (typeFilter !== "all") params.set("type", typeFilter);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const response = await fetch(
        `/api/family/members/${memberId}/documents?${params.toString()}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError("Member not found or has been removed from the family.");
        } else if (response.status === 403) {
          setError("You don't have permission to view this member's documents.");
        } else {
          setError("Failed to load documents. Please try again.");
        }
        setLoading(false);
        return;
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Error fetching member documents:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (memberId) {
      fetchMemberDocuments();
    }
  }, [memberId, searchQuery, typeFilter, sortBy, sortOrder]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMemberDocuments();
  };

  const getDocTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      prescription: "Prescription",
      lab: "Lab Report",
      scan: "Scan",
      discharge: "Discharge Summary",
      other: "Other",
    };
    return labels[type] || type;
  };

  const getDocTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      prescription: "bg-blue-100 text-blue-800",
      lab: "bg-green-100 text-green-800",
      scan: "bg-purple-100 text-purple-800",
      discharge: "bg-orange-100 text-orange-800",
      other: "bg-gray-100 text-gray-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading member details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-sm text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push("/family")}
              className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Family
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { member, documents, totalCount } = data;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            href="/family"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Family
          </Link>
        </div>

        {/* Member Profile Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xl font-semibold text-blue-700">
                  {member.name?.substring(0, 2).toUpperCase() || "M"}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
                <p className="text-sm text-gray-600">{member.email}</p>
                {member.profile?.phone && (
                  <p className="text-sm text-gray-600 mt-1">
                    📞 {member.profile.phone}
                  </p>
                )}
              </div>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
              {member.familyRole === "owner" ? "Owner" : "Member"}
            </span>
          </div>

          {/* Medical Info */}
          {member.profile?.medical && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Medical Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {member.profile.medical.bloodGroup && (
                  <div>
                    <p className="text-xs text-gray-500">Blood Group</p>
                    <p className="text-sm font-medium text-gray-900">
                      {member.profile.medical.bloodGroup}
                    </p>
                  </div>
                )}
                {member.profile.medical.allergies && (
                  <div>
                    <p className="text-xs text-gray-500">Allergies</p>
                    <p className="text-sm font-medium text-gray-900">
                      {member.profile.medical.allergies}
                    </p>
                  </div>
                )}
                {member.profile.medical.conditions && (
                  <div>
                    <p className="text-xs text-gray-500">Conditions</p>
                    <p className="text-sm font-medium text-gray-900">
                      {member.profile.medical.conditions}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Documents Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Medical Documents
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {totalCount} {totalCount === 1 ? "document" : "documents"} found
                </p>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <form onSubmit={handleSearch} className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search documents..."
                    className="w-full sm:w-64 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <svg
                    className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </form>

                {/* Type Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="prescription">Prescription</option>
                  <option value="lab">Lab Report</option>
                  <option value="scan">Scan</option>
                  <option value="discharge">Discharge Summary</option>
                  <option value="other">Other</option>
                </select>

                {/* Sort */}
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [newSortBy, newSortOrder] = e.target.value.split("-");
                    setSortBy(newSortBy);
                    setSortOrder(newSortOrder);
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="type-asc">Type A-Z</option>
                  <option value="type-desc">Type Z-A</option>
                </select>
              </div>
            </div>
          </div>

          {/* Documents List */}
          <div className="divide-y divide-gray-200">
            {documents.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">No documents found</p>
                {searchQuery || typeFilter !== "all" ? (
                  <p className="text-xs text-gray-500 mt-2">
                    Try adjusting your search or filters
                  </p>
                ) : null}
              </div>
            ) : (
              documents.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/dashboard/documents/${doc.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer no-underline"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getDocTypeColor(
                            doc.docType
                          )}`}
                        >
                          {getDocTypeLabel(doc.docType)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDate(doc.createdAt)}
                        </span>
                      </div>

                      {doc.metadata?.doctorName && (
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {doc.metadata.doctorName}
                        </p>
                      )}

                      {doc.summary && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          {doc.summary}
                        </p>
                      )}

                      {doc.metadata?.diagnosis && (
                        <p className="text-xs text-gray-500">
                          Diagnosis: {doc.metadata.diagnosis}
                        </p>
                      )}

                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {doc.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <svg
                      className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
