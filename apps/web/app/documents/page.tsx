"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DocumentReviewForm, { ExtractedDocument } from "@/components/DocumentReviewForm";

type Status = "idle" | "uploading" | "processing" | "review" | "error";

export default function DocumentsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [aiData, setAiData] = useState<ExtractedDocument | null>(null);
  const [reviewOpen, setReviewOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'scan' | 'view' | 'bin'>('scan');
  const [documents, setDocuments] = useState<any[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [message, setMessage] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [viewerOpen, setViewerOpen] = useState<boolean>(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerUrls, setViewerUrls] = useState<string[] | null>(null);
  const [viewerDoc, setViewerDoc] = useState<any | null>(null);
  const [viewerAnalysis, setViewerAnalysis] = useState<any | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [menuDocId, setMenuDocId] = useState<string | null>(null);
  const [overlayRect, setOverlayRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [previewHover, setPreviewHover] = useState<boolean>(false);
  const viewBtnRefs = useMemo(() => ({} as Record<string, HTMLButtonElement | null>), []);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const [selectModeView, setSelectModeView] = useState<boolean>(false);
  const [selectModeBin, setSelectModeBin] = useState<boolean>(false);
  const [selectedViewIds, setSelectedViewIds] = useState<string[]>([]);
  const [selectedBinIds, setSelectedBinIds] = useState<string[]>([]);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterDocType, setFilterDocType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    const current = files[previewIndex] || null;
    if (!current) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(current);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [files, previewIndex]);

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select a file first");
      return;
    }
    setStatus("uploading");
    setError("");
    setMessage("");

    const formData = new FormData();
    if (files.length > 1) {
      for (const f of files) formData.append('files', f);
    } else {
      formData.append("file", files[0]);
    }

    try {
      setStatus("processing");
      const res = await fetch("/api/documents/extract", {
        method: "POST",
        body: formData,
      });
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json().catch(() => ({})) : { error: await res.text().catch(() => "") };
      if (!res.ok) {
        throw new Error(data?.error || "Upload failed");
      }
      // Accept both direct object or {data: {...}} shapes
      const extracted: any = (data as any)?.data ?? (data as any) ?? null;
      // Debug: log extracted AI payload to verify units/summary presence
      try { console.debug('[AI Extract] payload', extracted); } catch {}
      setAiData(extracted);
      setReviewOpen(true);
      setStatus("review");
      const hasText = !!(extracted && typeof extracted?.raw_text === 'string' && extracted.raw_text.trim().length > 0);
      const hasFields = !!(extracted && (
        extracted.patient_name || extracted.doctor_name || extracted.summary ||
        (Array.isArray(extracted.medications) && extracted.medications.length > 0) ||
        (Array.isArray(extracted.vitals) && extracted.vitals.length > 0)
      ));
      setMessage(hasText || hasFields
        ? "AI extraction completed. Review and confirm below."
        : "No readable text detected. You can still edit fields or try another file.");
    } catch (err: any) {
      setError(err?.message || "Upload failed");
      setStatus("error");
    }
  };

  const handleSelect = (list: File[] | null) => {
    setFiles(list || []);
    setPreviewIndex(0);
    setAiData(null);
    setStatus("idle");
    setError("");
    setMessage("");
  };

  function resetScan() {
    setFiles([]);
    setPreviewUrl(null);
    setPreviewIndex(0);
    setAiData(null);
    setStatus("idle");
    setError("");
    setMessage("");
    setReviewOpen(false);
    // Ensure file input can emit change for the same file again
    try { fileInputRef.current && (fileInputRef.current.value = ""); } catch {}
  }

  const previewLabel = useMemo(() => {
    if (files.length === 0) return "";
    if (files.length === 1) {
      const f = files[0];
      const sizeKb = (f.size / 1024).toFixed(1);
      return `${f.name} • ${f.type || "unknown"} • ${sizeKb} KB`;
    }
    const totalKb = (files.reduce((acc, f)=> acc + f.size, 0) / 1024).toFixed(1);
    // Only show count and total size for multiple selections
    return `${files.length} files • ${totalKb} KB total`;
  }, [files]);

  const onConfirm = async (payload: ExtractedDocument) => {
    if (files.length === 0) {
      setError("No file selected to save");
      return;
    }
    try {
      setStatus("processing");
      setMessage("");
      // Map classification to docType used by backend
      const cls = (payload.classification || "other").toLowerCase();
      const docType = cls.includes("lab") ? "lab" : cls.includes("prescription") ? "prescription" : cls.includes("discharge") ? "discharge" : "other";

      const fd = new FormData();
      if (files.length > 1) {
        for (const f of files) fd.append('files', f);
      } else {
        fd.append("file", files[0]);
      }
      fd.append("profileId", "default-profile");
      fd.append("ownerUserId", "self");
      fd.append("docType", docType);
      // Include quick fields as initial metadata for immediate UI visibility
      const meta = {
        patient_name: payload.patient_name,
        dob: payload.dob,
        doctor_name: payload.doctor_name,
        diagnosis: payload.diagnosis,
        summary: payload.summary,
        report_date: payload.report_date,
        medications: payload.medications,
        vitals: payload.vitals,
        raw_text: aiData?.raw_text || '',
      };
      fd.append('meta', JSON.stringify(meta));

      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json().catch(() => ({})) : { error: await res.text().catch(() => "") };
      if (!res.ok) {
        throw new Error(data?.error || "Save failed");
      }
      setStatus("idle");
      setReviewOpen(false);
      setMessage("Saved to vault. Processing started");
      // Clear scan state
      setFiles([]);
      setPreviewUrl(null);
      setAiData(null);
      setError("");
      // Refresh documents list and switch to view mode
      await refreshDocuments();
      setViewMode('view');
    } catch (err: any) {
      setError(err?.message || "Save failed");
      setStatus("error");
    }
  };

  async function refreshDocuments(status: 'active' | 'archived' = 'active') {
    try {
      setIsRefreshing(true);
      const res = await fetch(`/api/documents?status=${status}` , { cache: 'no-store', credentials: 'include' as RequestCredentials });
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json().catch(() => ({})) : { error: await res.text().catch(() => "") };
      if (!res.ok) throw new Error(data?.error || 'Fetch failed');
      setDocuments(data?.data || []);
    } catch (e: any) {
      // Keep errors non-blocking for list
    } finally { setIsRefreshing(false); }
  }

  useEffect(() => { refreshDocuments('active'); }, []);

  useEffect(() => {
    // Reset selections when switching modes
    if (viewMode === 'view') {
      setSelectedBinIds([]);
      setSelectModeBin(false);
    }
    if (viewMode === 'bin') {
      setSelectedViewIds([]);
      setSelectModeView(false);
    }
  }, [viewMode]);

  // Removed retrySummary: Only the AI-provided summary (metadata.summary) should be shown.

  const formatDate = (iso?: string | null) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch { return iso; }
  };

  const titleText = useMemo(() => {
    const cls = (aiData?.classification || 'Other').replace(/_/g, ' ');
    const dateStr = formatDate(aiData?.report_date || null);
    return dateStr ? `${cls} - ${dateStr}` : cls;
  }, [aiData]);

  // Filtered documents based on search and filters
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Filter by document type
      if (filterDocType !== "all" && doc.docType !== filterDocType) {
        return false;
      }

      // Filter by search query (title, doctor, summary)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesDoctor = doc.doctorName?.toLowerCase().includes(query);
        const matchesSummary = doc.summary?.toLowerCase().includes(query);
        const matchesType = doc.docType?.toLowerCase().includes(query);
        
        if (!matchesDoctor && !matchesSummary && !matchesType) {
          return false;
        }
      }

      // Filter by upload date range
      if (dateFrom) {
        const docDate = new Date(doc.createdAt);
        const fromDate = new Date(dateFrom);
        if (docDate < fromDate) {
          return false;
        }
      }

      if (dateTo) {
        const docDate = new Date(doc.createdAt);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (docDate > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [documents, searchQuery, filterDocType, dateFrom, dateTo]);

  // Document type counts
  const docTypeCounts = useMemo(() => {
    return {
      all: documents.length,
      prescription: documents.filter(d => d.docType === "prescription").length,
      lab: documents.filter(d => d.docType === "lab").length,
      scan: documents.filter(d => d.docType === "scan").length,
      discharge: documents.filter(d => d.docType === "discharge").length,
      other: documents.filter(d => d.docType === "other").length,
    };
  }, [documents]);

  // Poll for summary availability while viewer is open and summary is pending
  useEffect(() => {
    if (!viewerOpen || !viewerDoc || viewerDoc?.summary) return;
    let mounted = true;
    const id = viewerDoc.id;
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/documents?status=active');
        const ct = res.headers.get('content-type') || '';
        const data = ct.includes('application/json') ? await res.json().catch(()=>({})) : { error: await res.text().catch(()=>"") };
        if (!mounted) return;
        const found = (data?.data || []).find((x:any)=> x.id === id);
        if (found && found.summary) {
          setViewerDoc((prev:any)=> ({ ...(prev||{}), summary: found.summary }));
          clearInterval(timer);
        }
      } catch {}
    }, 10000);
    return () => { mounted = false; clearInterval(timer); };
  }, [viewerOpen, viewerDoc]);

  async function openViewerByStorageKey(storageKey: string, mimeType?: string) {
    try {
      const res = await fetch(`/api/documents/download?storageKey=${encodeURIComponent(storageKey)}`);
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json().catch(()=>({})) : { error: await res.text().catch(()=>"") };
      if (!res.ok) throw new Error(data?.error || 'Download URL failed');
      const urls = Array.isArray((data as any)?.urls) ? (data as any).urls : null;
      setViewerUrls(urls);
      setViewerUrl(data?.url || (urls && urls[0]) || null);
      setViewerOpen(true);
    } catch (e:any) {
      setError(e?.message || 'Failed to open viewer');
    }
  }

  async function openViewer(doc: any) {
    setViewerDoc(doc);
    setViewerAnalysis(null);
    await openViewerByStorageKey(doc.storageKey, doc.mimeType);
    // Fetch analysis details (observations, ocr meta)
    try {
      const res = await fetch(`/api/documents/analysis?documentId=${encodeURIComponent(doc.id)}`);
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json().catch(()=>({})) : { error: await res.text().catch(()=>"") };
      if (res.ok) {
        setViewerAnalysis(data);
      }
    } catch {}
  }

  // Coerce any summary payload into a structured shape
  function summarizeToObject(s: any) {
    const fallback = {
      disclaimer: 'This is only advice; for proper follow-ups, contact a licensed medical practitioner.',
      in_depth_summary: '',
      key_findings: [] as string[],
      recommendations: [] as string[],
      possible_follow_ups: [] as string[],
      lifestyle_advice: [] as string[],
    };
    try {
      if (!s) return fallback;
      if (typeof s === 'string') {
        // Attempt to parse JSON; otherwise treat as raw markdown paragraph
        try { const obj = JSON.parse(s); s = obj; } catch {}
        if (typeof s === 'string') {
          return { ...fallback, in_depth_summary: s };
        }
      }
      let obj = s || {};

      // If the in_depth_summary itself is a JSON blob, try to unwrap it once
      if (typeof obj.in_depth_summary === 'string' && obj.in_depth_summary.trim().startsWith('{')) {
        try {
          const inner = JSON.parse(obj.in_depth_summary);
          if (inner && typeof inner === 'object') {
            obj = inner;
          }
        } catch {}
      }

      // Normalize scalar fields / arrays
      const normalizeArray = (value: any): string[] => {
        if (!value) return [];
        if (Array.isArray(value)) return value.map((x:any)=>String(x)).filter((x:string)=>x.trim());
        if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
        return [];
      };

      return {
        disclaimer: typeof obj.disclaimer === 'string' && obj.disclaimer.trim() ? obj.disclaimer : fallback.disclaimer,
        in_depth_summary: typeof obj.in_depth_summary === 'string' ? obj.in_depth_summary : '',
        key_findings: normalizeArray(obj.key_findings),
        recommendations: normalizeArray(obj.recommendations),
        possible_follow_ups: normalizeArray(obj.possible_follow_ups),
        lifestyle_advice: normalizeArray(obj.lifestyle_advice),
      };
    } catch {
      return fallback;
    }
  }

  return (
    <div className="container py-3">
      <header className="mb-2">
        <h1 className="h5 m-0">Documents</h1>
        <div className="text-muted small">Upload, review, and manage your medical files. Status and metadata stay visible.</div>
      </header>
      <div className="row g-4">
        <div className="col-12">
          <div className="d-flex gap-2 mb-3">
            <button className={`btn btn-sm ${viewMode==='scan'?'btn-danger':'btn-outline-danger'}`} onClick={()=>setViewMode('scan')}>Scan Documents</button>
            <button className={`btn btn-sm ${viewMode==='view'?'btn-danger':'btn-outline-danger'}`} onClick={()=>{setViewMode('view'); refreshDocuments('active');}}>View Scanned Documents</button>
            <button className={`btn btn-sm ${viewMode==='bin'?'btn-danger':'btn-outline-danger'}`} onClick={()=>{setViewMode('bin'); refreshDocuments('archived');}}>Bin</button>
          </div>

          {/* Search and Filters - Only show in view/bin modes */}
          {(viewMode === 'view' || viewMode === 'bin') && (
            <div className="card shadow-sm mb-3">
              <div className="card-body p-3">
                <h6 className="mb-3">Search & Filter</h6>
                <div className="row g-3">
                  {/* Search Input */}
                  <div className="col-12">
                    <div className="position-relative">
                      <input
                        type="text"
                        placeholder="Search by doctor, type, or summary..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-control form-control-sm"
                        style={{ paddingLeft: '32px' }}
                      />
                      <span className="position-absolute top-50 start-0 translate-middle-y ms-2 text-muted">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                        </svg>
                      </span>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="btn btn-sm position-absolute top-50 end-0 translate-middle-y me-1"
                          style={{ padding: '2px 8px' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Document Type Filter */}
                  <div className="col-md-4">
                    <label className="form-label small mb-1">Document Type</label>
                    <select
                      value={filterDocType}
                      onChange={(e) => setFilterDocType(e.target.value)}
                      className="form-select form-select-sm"
                    >
                      <option value="all">All Types ({docTypeCounts.all})</option>
                      <option value="prescription">Prescription ({docTypeCounts.prescription})</option>
                      <option value="lab">Lab Report ({docTypeCounts.lab})</option>
                      <option value="scan">Scan ({docTypeCounts.scan})</option>
                      <option value="discharge">Discharge ({docTypeCounts.discharge})</option>
                      <option value="other">Other ({docTypeCounts.other})</option>
                    </select>
                  </div>

                  {/* Date From */}
                  <div className="col-md-4">
                    <label className="form-label small mb-1">Upload Date From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="form-control form-control-sm"
                    />
                  </div>

                  {/* Date To */}
                  <div className="col-md-4">
                    <label className="form-label small mb-1">Upload Date To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="form-control form-control-sm"
                    />
                  </div>

                  {/* Clear Filters */}
                  {(searchQuery || filterDocType !== 'all' || dateFrom || dateTo) && (
                    <div className="col-12">
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setFilterDocType("all");
                          setDateFrom("");
                          setDateTo("");
                        }}
                        className="btn btn-sm btn-outline-secondary"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {viewMode === 'scan' && (
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h4 className="mb-1">Upload Document</h4>
                  <div className="text-muted small">Securely add medical files to your vault</div>
                </div>
                <span className="badge bg-success">Encrypted</span>
              </div>

              <div
                className={`p-4 rounded-3 text-center border ${dragOver ? "border-2 border-danger" : "border-2 border-secondary"}`}
                style={{ borderStyle: "dashed", background: dragOver ? "#fff6f8" : "#fafafa" }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const droppedList = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
                  handleSelect(droppedList);
                }}
              >
                <p className="fw-semibold mb-1">Drag & Drop files here</p>
                <p className="text-muted small">PDF, JPG, PNG up to 10MB each</p>
                <div className="d-flex justify-content-center gap-2">
                  <label className="btn btn-outline-secondary btn-sm">
                    Choose Files
                    <input
                      type="file"
                      className="d-none"
                      ref={fileInputRef}
                      multiple
                      onChange={(e) => handleSelect(e.target.files ? Array.from(e.target.files) : [])}
                    />
                  </label>
                </div>
                {files.length > 0 && (
                  <div className="alert alert-secondary mt-3 mb-0 text-start">
                    <div className="fw-semibold">Selected</div>
                    <div className="small text-muted">{previewLabel}</div>
                  </div>
                )}
              </div>

              <div className="d-flex justify-content-between align-items-center mt-4">
                <div className="text-muted small ">Your files are encrypted in transit and at rest.</div>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  disabled={status === "processing"}
                  onClick={handleUpload}
                >
                  {status === "processing" ? "Processing..." : "Upload & Extract"}
                </button>
              </div>

              {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
              {message && !error && <div className="alert alert-info mt-3 mb-0">{message}</div>}
            </div>
          </div>
        </div>
        )}

        {viewMode === 'bin' && (
        <div className="col-12">
          <div className="border rounded p-3 bg-white">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h2 className="h6 m-0">Bin</h2>
              <div>
                <button className="btn btn-sm btn-outline-secondary" onClick={()=>refreshDocuments('archived')} disabled={isRefreshing}>
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <button className={`btn btn-sm ms-2 ${selectModeBin?'btn-danger':'btn-outline-danger'}`} onClick={() => { const next = !selectModeBin; setSelectModeBin(next); if (!next) setSelectedBinIds([]); }}>Select Multiple</button>
                {selectModeBin && (
                  <>
                    <button className="btn btn-sm btn-outline-secondary ms-2" disabled={selectedBinIds.length===0} onClick={async ()=>{
                      try {
                        await Promise.all(selectedBinIds.map(id => fetch('/api/documents/restore', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ id }) })));
                        setSelectedBinIds([]);
                        await refreshDocuments('archived');
                      } catch {}
                    }}>Restore Selected</button>
                    <button className="btn btn-sm btn-outline-danger ms-2" disabled={selectedBinIds.length===0} onClick={()=> setConfirmDeleteIds([...selectedBinIds])}>Delete Selected</button>
                  </>
                )}
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    {selectModeBin && (<th scope="col" style={{width:32}}></th>)}
                    <th scope="col">Created At</th>
                    <th scope="col">Doctor</th>
                    <th scope="col">Type</th>
                    <th scope="col">Summary</th>
                    <th scope="col" className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 ? (
                    <tr>
                      {selectModeBin && (<td></td>)}
                      <td className="text-muted">—</td>
                      <td className="text-muted">—</td>
                      <td className="text-muted">—</td>
                      <td className="text-muted">—</td>
                      <td></td>
                    </tr>
                  ) : (
                    documents.map((d) => (
                      <tr key={d.id}>
                        {selectModeBin && (
                          <td>
                            <input type="checkbox" checked={selectedBinIds.includes(d.id)} onChange={(e)=>{
                              const checked = e.currentTarget.checked;
                              setSelectedBinIds(prev => checked ? [...prev, d.id] : prev.filter(x=>x!==d.id));
                            }} />
                          </td>
                        )}
                        <td className="text-muted">{new Date(d.createdAt).toLocaleString()}</td>
                        <td className="text-muted">{d.doctorName || '—'}</td>
                        <td>{d.docType}</td>
                        <td title={(d.summary || '')}>{(d.summary || '—').slice(0, 40)}{(d.summary || '').length > 40 ? '…' : ''}</td>
                        <td className="text-end">
                          <div className="btn-group">
                            <button className="btn btn-sm btn-outline-secondary" onClick={async ()=>{
                              try {
                                const res = await fetch('/api/documents/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: d.id }) });
                                if (res.ok) { await refreshDocuments('archived'); }
                              } catch {}
                            }}>Restore</button>
                            <button className="btn btn-sm btn-outline-danger" onClick={()=> setConfirmDeleteIds([d.id])}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}

        {viewMode === 'scan' && (
        <div className="col-12 col-lg-7">
          <div className="card h-100 shadow-sm">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <div className="rounded-3 border h-100 p-2 text-center" style={{ background: "#f7f7f7" }}>
                    <div className="text-muted small mb-2">{titleText || 'Original Preview'}</div>
                    {previewUrl ? (
                      <div className="position-relative d-inline-block" onMouseEnter={()=> setPreviewHover(true)} onMouseLeave={()=> setPreviewHover(false)}>
                        {(() => {
                          const current = files[previewIndex];
                          const isPdf = !!current && ((current.type || '').toLowerCase().includes('pdf') || (current.name || '').toLowerCase().endsWith('.pdf'));
                          return isPdf ? (
                            <iframe src={(previewUrl ? (previewUrl + '#toolbar=0&navpanes=0&scrollbar=1') : '')} title="preview-pdf" className="rounded-3" style={{ width: '100%', height: 360, border: 'none' }} />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={previewUrl || ''} alt="preview" className="img-fluid rounded-3" />
                          );
                        })()}
                        {/* Always-on close button (clickable even when overlay disables pointer events for PDFs) */}
                        <div className="position-absolute" style={{ top: 8, right: 8, zIndex: 10, opacity: previewHover ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: previewHover ? 'auto' as any : 'none' }}>
                          <button className="btn btn-danger btn-sm rounded-circle" title="Reset scan" onClick={resetScan}>✕</button>
                        </div>
                        {(() => { const current = files[previewIndex]; const isPdf = !!current && ((current.type || '').toLowerCase().includes('pdf') || (current.name || '').toLowerCase().endsWith('.pdf')); return (
                        <div className="position-absolute top-0 start-0 w-100 h-100" style={{opacity:0, transition:'opacity 0.2s', pointerEvents: isPdf ? 'none' as any : 'auto'}}
                          onMouseEnter={(e)=>{(e.currentTarget as HTMLElement).style.opacity='1';}}
                          onMouseLeave={(e)=>{(e.currentTarget as HTMLElement).style.opacity='0';}}
                        >
                          {/* Navigation arrows and reset */}
                          {!isPdf && files.length > 1 && (
                            <>
                              <button
                                className="btn btn-outline-danger btn-sm rounded-circle"
                                title="Previous"
                                style={{ position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)' }}
                                onClick={()=> setPreviewIndex((i)=> (files.length ? (i - 1 + files.length) % files.length : 0))}
                              >
                                ‹
                              </button>
                              <button
                                className="btn btn-outline-danger btn-sm rounded-circle"
                                title="Next"
                                style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)' }}
                                onClick={()=> setPreviewIndex((i)=> (files.length ? (i + 1) % files.length : 0))}
                              >
                                ›
                              </button>
                              <span className="badge bg-light text-dark" style={{ position: 'absolute', bottom: 10, right: 10 }}>
                                {previewIndex+1}/{files.length}
                              </span>
                            </>
                          )}
                        </div>
                        ); })()}
                      </div>
                    ) : (
                      <div className="text-muted">No file selected</div>
                    )}
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  {status === "processing" && (
                    <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center">
                      <div className="spinner-border text-danger mb-3" role="status" />
                      <div className="fw-semibold">Processing with AI...</div>
                      <div className="text-muted small">This may take a moment.</div>
                    </div>
                  )}
                  {status === "review" && aiData && reviewOpen && (
                    <DocumentReviewForm data={aiData} onConfirm={onConfirm} />
                  )}
                  {status === "idle" && (
                    <div className="text-muted text-center">Upload a document to start extraction.</div>
                  )}
                  {status === "error" && (
                    <div className="alert alert-danger">{error || "Something went wrong."}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
        {viewMode === 'view' && (
        <div className="col-12">
          <div className="border rounded p-3 bg-white">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h2 className="h6 m-0">Your Documents</h2>
              <div>
                <button className="btn btn-sm btn-outline-secondary" onClick={()=>refreshDocuments('active')} disabled={isRefreshing}>
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <button className={`btn btn-sm ms-2 ${selectModeView?'btn-danger':'btn-outline-danger'}`} onClick={() => { const next = !selectModeView; setSelectModeView(next); if (!next) setSelectedViewIds([]); }}>Select Multiple</button>
                {selectModeView && (
                  <button className="btn btn-sm btn-outline-secondary ms-2" disabled={selectedViewIds.length===0} onClick={async ()=>{
                    try {
                      await Promise.all(selectedViewIds.map(id => fetch('/api/documents/bin', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ id }) })));
                      setSelectedViewIds([]);
                      await refreshDocuments('active');
                    } catch {}
                  }}>Bin Selected</button>
                )}
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    {selectModeView && (<th scope="col" style={{width:32}}></th>)}
                    <th scope="col">Created At</th>
                    <th scope="col">Doctor</th>
                    <th scope="col">Type</th>
                    <th scope="col">Summary</th>
                    <th scope="col" className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      {selectModeView && (<td></td>)}
                      <td className="text-muted" colSpan={5}>
                        {documents.length === 0 ? 'No documents found' : 'No documents match your filters'}
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((d) => (
                      <tr key={d.id}>
                        {selectModeView && (
                          <td>
                            <input type="checkbox" checked={selectedViewIds.includes(d.id)} onChange={(e)=>{
                              const checked = e.currentTarget.checked;
                              setSelectedViewIds(prev => checked ? [...prev, d.id] : prev.filter(x=>x!==d.id));
                            }} />
                          </td>
                        )}
                        <td className="text-muted">{new Date(d.createdAt).toLocaleString()}</td>
                        <td className="text-muted">{d.doctorName || '—'}</td>
                        <td>{d.docType}</td>
                        <td title={(d.summary || '')}>{(d.summary || 'Pending').slice(0, 40)}{(d.summary || '').length > 40 ? '…' : ''}</td>
                        <td className="text-end position-relative">
                          <div className="btn-group position-relative">
                            <button ref={(el)=>{ viewBtnRefs[d.id] = el; }} className="btn btn-sm btn-outline-secondary" onClick={()=> openViewer(d)}>View</button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={()=> {
                              const next = menuDocId===d.id?null:d.id;
                              setMenuDocId(next);
                              const el = viewBtnRefs[d.id];
                              if (next && el) setOverlayRect({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
                            }} aria-label="More actions">⋯</button>
                            {menuDocId === d.id && overlayRect && (
                              <button className="btn btn-sm btn-danger position-absolute" style={{ left: overlayRect.x, top: overlayRect.y, zIndex: 50, width: overlayRect.w, height: overlayRect.h }} onClick={async ()=>{
                                try {
                                  const res = await fetch('/api/documents/bin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: d.id }) });
                                  const ok = res.ok;
                                  setMenuDocId(null);
                                  if (ok) { await refreshDocuments('active'); }
                                } catch {}
                              }}>Bin</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}

        {viewerOpen && viewerUrl && viewerDoc && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="bg-white rounded shadow" style={{ width: '95%', height: '92%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {/* Header bar to avoid overlay conflicts */}
              <div style={{ height: 44, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 12px' }}>
                <button className="btn btn-sm btn-outline-danger" onClick={()=>{ setViewerOpen(false); setViewerUrl(null); setViewerDoc(null); setViewerAnalysis(null); }}>✕</button>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: 0, minHeight: 0 }}>
                {/* Left: document */}
                <div style={{ width: '60%', height: '100%', minHeight: 0, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', overflowY: 'auto', overflowX: 'hidden', padding: 0, margin: 0, boxSizing: 'border-box', overscrollBehavior: 'contain', scrollbarGutter: 'stable' as any }}>
                  {viewerUrls && viewerUrls.length > 1 ? (
                    <div style={{ width: '100%' }}>
                      {viewerUrls.map((u, idx) => (
                        <div key={u+idx} className="mb-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt={`Page ${idx+1}`} style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }} />
                        </div>
                      ))}
                    </div>
                  ) : viewerUrl && (viewerUrl.endsWith('.png') || viewerUrl.endsWith('.jpg') || viewerUrl.endsWith('.jpeg')) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={viewerUrl} alt="Document" style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }} />
                  ) : (
                    viewerUrl ? <iframe src={(viewerUrl + '#toolbar=0&navpanes=0&scrollbar=1')} title="Document Viewer" style={{ width: '100%', height: '100%', border: 'none' }} /> : null
                  )}
                </div>
                {/* Right: information panel */}
                <div style={{ width: '40%', height: '100%', minHeight: 0, padding: '12px 16px 16px 4px', overflowY: 'auto', overflowX: 'hidden', borderLeft: 'none', margin: 0, boxSizing: 'border-box', overscrollBehavior: 'contain', scrollbarGutter: 'stable' as any }}>
                  {(() => { const s = summarizeToObject(viewerDoc?.summary_full ?? viewerDoc?.summary); return (
                    <div className="alert alert-warning p-2 mb-3" style={{ fontSize: '0.9rem' }}>
                      {s.disclaimer}
                    </div>
                  ); })()}
                  <h3 className="h6">Extracted Information</h3>
                  <div className="mb-2 text-muted small">{viewerDoc?.docType ? (`Type: ${viewerDoc.docType}`) : ''}</div>
                  <dl className="row mb-3">
                    <dt className="col-4">Patient Name</dt><dd className="col-8">{viewerDoc?.patient_name || '—'}</dd>
                    <dt className="col-4">Date of Birth</dt><dd className="col-8">{viewerDoc?.dob || '—'}</dd>
                    <dt className="col-4">Doctor Name</dt><dd className="col-8">{viewerDoc?.doctorName || viewerDoc?.doctor_name || '—'}</dd>
                    <dt className="col-4">Diagnosis</dt><dd className="col-8">{viewerDoc?.diagnosis || 'no outright diagnosis by the doctor'}</dd>
                    <dt className="col-4">Report Date</dt><dd className="col-8">{viewerDoc?.report_date || '—'}</dd>
                  </dl>
                  {Array.isArray(viewerDoc?.medications) && viewerDoc.medications.length > 0 && (
                    <div className="mb-3">
                      <div className="fw-semibold mb-1">Medications</div>
                      <ul className="small">
                        {viewerDoc.medications.map((m: any, idx:number) => (
                          <li key={idx}>{[m?.name, m?.dose, m?.frequency].filter(Boolean).join(' ')}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(viewerDoc?.vitals) && viewerDoc.vitals.length > 0 ? (
                    <div className="mb-3">
                      <div className="fw-semibold mb-1">Vitals</div>
                      <div className="table-responsive">
                        <table className="table table-sm">
                          <thead><tr><th>Label</th><th>Value</th><th>Unit</th></tr></thead>
                          <tbody>
                            {/* Improved deduplication: by label+value+unit, merge advice/explanation if present */}
                            {(() => {
                              const seen = new Map();
                              // Iterate in reverse to keep latest
                              [...viewerDoc.vitals].reverse().forEach((v:any) => {
                                const key = [
                                  (v.label || '').toLowerCase().trim(),
                                  String(v.value ?? '').toLowerCase().trim(),
                                  (v.unit || '').toLowerCase().trim()
                                ].join('|');
                                if (key && !seen.has(key)) {
                                  seen.set(key, { ...v });
                                } else if (key && seen.has(key)) {
                                  // Merge advice/explanation if missing in the kept one
                                  const existing = seen.get(key);
                                  if (!existing.advice && v.advice) existing.advice = v.advice;
                                  if (!existing.explanation && v.explanation) existing.explanation = v.explanation;
                                }
                              });
                              return Array.from(seen.values()).reverse().map((v:any, i:number) => (
                                <tr key={i}><td>{v.label || ''}</td><td>{String(v.value ?? '')}</td><td>{v.unit || '-'}</td></tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (viewerAnalysis?.classification?.observations && viewerAnalysis.classification.observations.length > 0 && (
                    <div className="mb-3">
                      <div className="fw-semibold mb-1">Observations</div>
                      <div className="table-responsive">
                        <table className="table table-sm">
                          <thead><tr><th>Name</th><th>Value</th><th>Unit</th></tr></thead>
                          <tbody>
                            {viewerAnalysis.classification.observations.map((o:any, i:number)=> (
                              <tr key={i}><td>{o.name}</td><td>{String(o.value)}</td><td>{o.unit || ''}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                  {(() => {
                    const s = summarizeToObject(viewerDoc?.summary_full ?? viewerDoc?.summary);
                    const hasSummary = s.in_depth_summary || s.key_findings.length > 0 || s.recommendations.length > 0;
                    return (
                      <div className="mb-3">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <div className="fw-semibold">Summary</div>
                          <button 
                            className="btn btn-sm d-inline-flex align-items-center gap-1"
                            style={{ background: "#81102A", color: "white" }}
                            disabled={summaryLoading}
                            onClick={async () => {
                              try {
                                setSummaryLoading(true);
                                // Fetch OCR text if available
                                const ocrCol = viewerDoc?.versionId ? `${viewerDoc.id}:${viewerDoc.versionId}` : null;
                                let rawText = '';
                                if (ocrCol) {
                                  try {
                                    const ocrRes = await fetch(`/api/ocr?id=${ocrCol}`);
                                    if (ocrRes.ok) {
                                      const ocrData = await ocrRes.json();
                                      rawText = ocrData?.text || '';
                                    }
                                  } catch {}
                                }
                                
                                const structured = {
                                  patient_name: viewerDoc?.patient_name,
                                  dob: viewerDoc?.dob,
                                  doctor_name: viewerDoc?.doctorName,
                                  diagnosis: viewerDoc?.diagnosis,
                                  medications: viewerDoc?.medications || [],
                                  vitals: viewerDoc?.vitals || [],
                                  summary: viewerDoc?.summary,
                                  classification: viewerDoc?.classification || viewerDoc?.metadata?.classification,
                                  raw_text: rawText,
                                };
                                const res = await fetch('/api/documents/fast-summarize', {
                                  method: 'POST',
                                  headers: { 'content-type': 'application/json' },
                                  body: JSON.stringify({ documentId: viewerDoc?.id, structured })
                                });
                                if (res.ok) {
                                  const data = await res.json();
                                  setViewerDoc((prev: any) => ({ ...prev, summary_full: data.summary }));
                                  // Also refresh the documents list so that reopening the viewer
                                  // always uses the latest persisted summary from the backend.
                                  await refreshDocuments('active');
                                }
                              } catch (e) {
                                console.error('Summary generation failed:', e);
                              } finally {
                                setSummaryLoading(false);
                              }
                            }}
                          >
                            {summaryLoading && (
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                            )}
                            <span>{hasSummary ? '🔄 Generate In-Depth Summary' : '✨ Generate Summary'}</span>
                          </button>
                        </div>
                        {s.in_depth_summary && (
                          <div className="mb-2">
                            <div className="fw-semibold">In-Depth Summary</div>
                            <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{s.in_depth_summary}</div>
                          </div>
                        )}
                        {s.key_findings.length > 0 && (
                          <div className="mb-2">
                            <div className="fw-semibold">Key Findings</div>
                            <ul className="small mb-0">
                              {s.key_findings.map((k:string, i:number)=>(<li key={i}>{k}</li>))}
                            </ul>
                          </div>
                        )}
                        {s.recommendations.length > 0 && (
                          <div className="mb-2">
                            <div className="fw-semibold">Recommendations</div>
                            <ul className="small mb-0">
                              {s.recommendations.map((k:string, i:number)=>(<li key={i}>{k}</li>))}
                            </ul>
                          </div>
                        )}
                        {s.possible_follow_ups.length > 0 && (
                          <div className="mb-2">
                            <div className="fw-semibold">Possible Follow-Ups</div>
                            <ul className="small mb-0">
                              {s.possible_follow_ups.map((k:string, i:number)=>(<li key={i}>{k}</li>))}
                            </ul>
                          </div>
                        )}
                        {s.lifestyle_advice.length > 0 && (
                          <div className="mb-2">
                            <div className="fw-semibold">Lifestyle Advice</div>
                            <ul className="small mb-0">
                              {s.lifestyle_advice.map((k:string, i:number)=>(<li key={i}>{k}</li>))}
                            </ul>
                          </div>
                        )}
                        {!s.in_depth_summary && s.key_findings.length === 0 && s.recommendations.length === 0 && (
                          <div className="small text-muted">Pending…</div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {confirmDeleteIds && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded shadow p-3" style={{ maxWidth: 420, width: '90%' }}>
            <h3 className="h6">Delete Permanently?</h3>
            <p className="mb-3 text-muted small">These will be deleted from our database completely.</p>
            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary" onClick={()=> setConfirmDeleteIds(null)}>Go Back</button>
              <button className="btn btn-danger" onClick={async ()=>{
                try {
                  await Promise.all(confirmDeleteIds!.map(id => fetch(`/api/documents/purge?id=${encodeURIComponent(id)}`, { method: 'DELETE' })));
                  await refreshDocuments('archived');
                  setConfirmDeleteIds(null);
                } catch {}
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
