"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";

type SummaryPayload =
  | string
  | {
      in_depth_summary?: string;
      key_findings?: string[];
      recommendations?: string[];
      possible_follow_ups?: string[];
      lifestyle_advice?: string[];
      disclaimer?: string;
    };

type DocumentDetail = {
  id: string;
  docType: string;
  status?: string;
  processingStatus?: string;
  mimeType?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: {
    patientName?: string;
    doctorName?: string;
    diagnosis?: string;
    reportDate?: string;
    dob?: string;
  };
  summary?: string;
  summaryFull?: SummaryPayload;
  tags?: string[];
};

type ApiResponse = {
  document: DocumentDetail;
  owner: { id: string };
  download: { url: string | null; urls: string[] | null };
};

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = (params?.documentId as string) || "";

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    async function fetchData() {
      if (!documentId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/family/documents/${documentId}`, { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Unable to load document");
        }
        const body = (await res.json()) as ApiResponse;
        setData(body);
      } catch (err: any) {
        setError(err?.message || "Unable to load document");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [documentId]);

  const downloadPages = useMemo(() => data?.download?.urls || null, [data]);
  const primaryUrl = useMemo(() => {
    if (downloadPages && downloadPages.length > 0) {
      return downloadPages[Math.min(activePage, downloadPages.length - 1)];
    }
    return data?.download?.url || null;
  }, [data, downloadPages, activePage]);

  const formatDate = (iso?: string) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const renderSummary = (summary: SummaryPayload) => {
    if (!summary) return null;
    if (typeof summary === "string") {
      return <p className="text-sm text-gray-700 whitespace-pre-line">{summary}</p>;
    }
    return (
      <div className="space-y-3">
        {summary.in_depth_summary ? (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Summary</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{summary.in_depth_summary}</p>
          </div>
        ) : null}
        {summary.key_findings && summary.key_findings.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Key Findings</p>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {summary.key_findings.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {summary.recommendations && summary.recommendations.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Recommendations</p>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {summary.recommendations.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {summary.possible_follow_ups && summary.possible_follow_ups.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Follow Ups</p>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {summary.possible_follow_ups.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {summary.lifestyle_advice && summary.lifestyle_advice.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Lifestyle Advice</p>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {summary.lifestyle_advice.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {summary.disclaimer ? (
          <p className="text-xs text-gray-500">{summary.disclaimer}</p>
        ) : null}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading document...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-md w-full text-center">
          <div className="flex justify-center mb-3">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <p className="text-gray-800 font-medium mb-2">Unable to load document</p>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.back()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </button>
            <Link
              href="/family"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700"
            >
              Return to family
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { document } = data;
  const hasMultiplePages = !!(downloadPages && downloadPages.length > 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <p className="text-xs text-gray-500">Document ID</p>
            <p className="text-sm font-semibold text-gray-900">{document.id}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 max-w-3xl mx-auto">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Document</p>
                  <h2 className="text-xl font-semibold text-gray-900">{document.docType || "Document"}</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Uploaded {formatDate(document.createdAt)}
                    {document.updatedAt ? ` • Updated ${formatDate(document.updatedAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {document.status ? (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {document.status}
                    </span>
                  ) : null}
                  {document.processingStatus ? (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {document.processingStatus}
                    </span>
                  ) : null}
                </div>
              </div>

              {primaryUrl ? (
                <div className="border border-gray-200 rounded-md overflow-hidden bg-gray-50 flex justify-center">
                  <iframe
                    src={primaryUrl}
                    className="w-full max-w-2xl h-[60vh] min-h-[400px] bg-white rounded shadow-sm"
                    style={{ aspectRatio: '4/5' }}
                    title="Document preview"
                  />
                </div>
              ) : (
                <div className="border border-dashed border-gray-200 rounded-md p-6 text-center text-sm text-gray-600">
                  No preview available. Use the download button to open the file.
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {primaryUrl ? (
                  <a
                    href={primaryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open document
                  </a>
                ) : null}
                {data.download.url && !downloadPages ? (
                  <a
                    href={data.download.url}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    download
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                ) : null}
              </div>

              {hasMultiplePages && downloadPages ? (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-600 mb-2">Pages</p>
                  <div className="flex flex-wrap gap-2">
                    {downloadPages.map((url, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActivePage(idx)}
                        className={`rounded border px-3 py-1 text-sm ${
                          idx === activePage
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Page {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">AI Summary</h3>
              {document.summaryFull || document.summary ? (
                renderSummary((document.summaryFull as SummaryPayload) || document.summary || "")
              ) : (
                <p className="text-sm text-gray-600">No summary available yet.</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Details</h3>
              <dl className="space-y-2 text-sm text-gray-700">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Type</dt>
                  <dd className="font-medium">{document.docType || "-"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Doctor</dt>
                  <dd className="font-medium">{document.metadata?.doctorName || "-"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Patient</dt>
                  <dd className="font-medium">{document.metadata?.patientName || "-"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Report Date</dt>
                  <dd className="font-medium">{document.metadata?.reportDate ? formatDate(document.metadata.reportDate) : "-"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Diagnosis</dt>
                  <dd className="font-medium">{document.metadata?.diagnosis || "-"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">DOB</dt>
                  <dd className="font-medium">{document.metadata?.dob || "-"}</dd>
                </div>
              </dl>
              {document.tags && document.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {document.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Actions</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <Link
                  href="/family"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Return to family dashboard
                </Link>
                {primaryUrl ? (
                  <a
                    href={primaryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in new tab
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
