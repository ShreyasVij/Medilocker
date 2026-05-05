"use client";

import { FileText, Calendar, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface HealthSummarySection {
  heading: string;
  content: string;
}

interface HealthSummary {
  // Keep flexible shape — AI may return either { summary, sections } or a richer object
  [key: string]: any;
}

export function HealthSummaryPanel() {
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [userVitalsByCategory, setUserVitalsByCategory] = useState<Record<string, any[]>>({});
  const [documentCount, setDocumentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  // serverProcessing removed to avoid transient UI banner

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch('/api/health-summary');
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch health summary');
        }
        const data = await res.json();
        setSummary(data.summary);
        // also fetch active + archived (bin) document count so a document in the bin
        // still counts as present for the summary/vitals UX
        try {
          const [activeRes, archivedRes] = await Promise.all([
            fetch('/api/documents?status=active'),
            fetch('/api/documents?status=archived')
          ]);
          let activeLen = 0;
          let archivedLen = 0;
          if (activeRes.ok) {
            const ad = await activeRes.json().catch(() => ({}));
            const list = ad?.data || ad || [];
            activeLen = Array.isArray(list) ? list.length : 0;
          }
          if (archivedRes.ok) {
            const ar = await archivedRes.json().catch(() => ({}));
            const list = ar?.data || ar || [];
            archivedLen = Array.isArray(list) ? list.length : 0;
          }
          setDocumentCount(activeLen + archivedLen);
        } catch {}
        // also try to read vitals grouped by category from the same API
        if (data.groupedVitals && typeof data.groupedVitals === 'object') {
          const norm: Record<string, any[]> = {};
          for (const k of Object.keys(data.groupedVitals)) {
            norm[k.toLowerCase()] = data.groupedVitals[k];
          }
          setUserVitalsByCategory(norm);
        }
        return data.processing;
      } catch (err: any) {
        console.error('Error fetching health summary:', err);
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    let mounted = true;
    let poll: ReturnType<typeof setInterval> | null = null;

    fetchSummary().then((isProcessing) => {
      // Start polling only if the server actively reports processing
      if (isProcessing && mounted) {
        poll = setInterval(async () => {
          if (!mounted) return;
          try {
            const res = await fetch('/api/health-summary');
            if (!res.ok) return;
            const d = await res.json().catch(() => ({}));
            if (!mounted) return;
            setSummary(d.summary || null);
            // stop polling when no longer processing
            if (!d.processing) {
              if (poll) clearInterval(poll);
              poll = null;
            }
          } catch {}
        }, 5000);
      }
    });

    return () => { 
      mounted = false; 
      if (poll) clearInterval(poll); 
    };
  }, []);

  // If vitals aren't provided via /api/health-summary response, fetch /api/vitals
  useEffect(() => {
    async function fetchVitalsFallback() {
      try {
        if (Object.keys(userVitalsByCategory).length > 0) return;
        const res = await fetch('/api/vitals');
        if (!res.ok) return;
        const data = await res.json();
        const grouped = data.groupedVitals || {};
        const norm: Record<string, any[]> = {};
        for (const k of Object.keys(grouped)) {
          norm[k.toLowerCase()] = grouped[k];
        }
        if (Object.keys(norm).length > 0) setUserVitalsByCategory(norm);
      } catch (e) {
        // non-fatal
      }
    }
    fetchVitalsFallback();
  }, [userVitalsByCategory]);

  if (loading && !summary) {
    return (
      <section className="mt-8">
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Health Summary</h2>
          </div>
          <p className="text-muted-foreground">Loading your comprehensive health summary...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-8">
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Health Summary</h2>
          </div>
          <div className="flex items-start gap-2 text-red-600">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <p>Error loading health summary: {error}</p>
          </div>
        </div>
      </section>
    );
  }

  // If user currently has no active documents and no stored summary, show an empty state
  if (documentCount === 0 && !summary) {
    return (
      <section className="mt-8">
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Health Summary Available</h3>
          <p className="text-muted-foreground">Upload medical documents to generate your comprehensive health summary.</p>
        </div>
      </section>
    );
  }

  // If there are documents but no summary yet, show a calculating/loading message
  if (!summary) {
    return (
      <section className="mt-8">
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Comprehensive Health Summary</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-full border-2 border-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Calculating health summary — this may take 20–60 seconds.</p>
          </div>
        </div>
      </section>
    );
  }

  // If we reach here, we have a stored summary. If the server is still processing
  // a newer generation, show the existing summary but indicate it's updating.

  // Robust JSON parsing: handle double-encoded JSON strings and fallbacks
  function tryParseJSON(v: any) {
    let cur = v;
    // If value is not a string, return as-is
    if (typeof cur !== 'string') return cur;
    let s = cur.trim();
    if (s === '') return cur;

    // Try to find JSON embedded in surrounding text (e.g., AI returns a preface then JSON)
    const firstBrace = s.search(/[{\[]/);
    if (firstBrace > 0) {
      // attempt to extract substring from first brace to last matching closing brace
      const lastBrace = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
      if (lastBrace > firstBrace) {
        const candidate = s.slice(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(candidate);
        } catch (e) {
          // fall through to other attempts
        }
      }
    }

    // If the string itself looks like JSON, try parsing; attempt double-encoded JSON up to 3 times
    for (let i = 0; i < 3; i++) {
      const trimmed = s.trim();
      if (trimmed.length === 0) return cur;
      if (trimmed[0] === '{' || trimmed[0] === '[' || trimmed[0] === '"') {
        try {
          const parsed = JSON.parse(trimmed);
          // If parsing yields a string again, continue loop to attempt deeper parse
          if (typeof parsed === 'string') {
            s = parsed;
            cur = parsed;
            continue;
          }
          return parsed;
        } catch (e) {
          return cur;
        }
      }
      // No JSON-looking start; return original
      return cur;
    }
    return cur;
  }

  // Prefer parsing the stored `summary.summary` string. Also accept the stored
  // summary document itself when it already contains structured AI fields.
  let content: any = null;
  const parsedSummary = summary && typeof summary.summary === 'string' ? tryParseJSON(summary.summary) : null;
  if (parsedSummary && typeof parsedSummary === 'object' && !Array.isArray(parsedSummary)) {
    const keys = Object.keys(parsedSummary);
    const hasHealthKeys = keys.some(k => /cardio|cardiovascular|metabolic|blood|kidney|liver|thyroid|anthropometrics|overall|abnormal_findings|advice|sections/i.test(k));
    if (hasHealthKeys || parsedSummary.overall_summary || parsedSummary.sections) {
      content = parsedSummary;
    }
  }
  if (!content && summary && typeof summary === 'object') {
    const keys = Object.keys(summary);
    const hasHealthKeys = keys.some(k => /cardio|cardiovascular|metabolic|blood|kidney|liver|thyroid|anthropometrics|overall|abnormal_findings|advice|sections/i.test(k));
    if (hasHealthKeys || summary.overall_summary || summary.overall_feedback || summary.sections) {
      content = summary;
    }
  }
  const isStructured = Boolean(content);
  // Helper to safely render values that may be string, array, or nested object
  function renderValue(val: any, className = 'text-muted-foreground') {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
      return <p className={`${className} whitespace-pre-wrap`}>{val}</p>;
    }
    if (Array.isArray(val)) {
      return (
        <ul className="list-disc pl-5 text-muted-foreground space-y-1">
          {val.map((it: any, idx: number) => (
            <li key={idx} className={className}>{typeof it === 'string' ? it : JSON.stringify(it)}</li>
          ))}
        </ul>
      );
    }
    if (typeof val === 'object') {
      // If object looks like a map of lab/test -> details, render entries
      return (
        <div className="space-y-2">
          {Object.keys(val).map((k) => {
            const v = val[k];
            if (v == null) return null;
            // If value has test-like fields, render gracefully
            if (typeof v === 'object' && (v.value !== undefined || v.explanation !== undefined || v.unit !== undefined)) {
              return (
                <div key={k}>
                  <div className="text-foreground font-medium">{k}</div>
                  <div className={`text-sm ${className}`}>
                    {v.value !== undefined ? `${v.value}${v.unit ? ` ${v.unit}` : ''}` : ''}
                    {v.explanation ? ` — ${v.explanation}` : ''}
                  </div>
                </div>
              );
            }
            // Fallback: stringify
            return (
              <div key={k}>
                <div className="text-foreground font-medium">{k}</div>
                <div className={`text-sm ${className}`}>{JSON.stringify(v)}</div>
              </div>
            );
          })}
        </div>
      );
    }
    // fallback to stringify for other types
    return <p className={`${className}`}>{String(val)}</p>;
  }
  // Safe fallback sources when `content` is null/undefined
  const fallbackSections = (content && Array.isArray(content.sections))
    ? content.sections
    : (summary && Array.isArray(summary.sections) ? summary.sections : null);
  const displayContent = content ?? parsedSummary ?? summary;

  return (
    <section className="mt-8">
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div 
          className="bg-muted/30 px-6 py-4 border-b border-border cursor-pointer hover:bg-muted/40 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Comprehensive Health Summary</h2>
            </div>
            <button className="text-muted-foreground hover:text-foreground">
              {expanded ? '−' : '+'}
            </button>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{summary.documentCount} document{summary.documentCount !== 1 ? 's' : ''} analyzed</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>
                Generated {(() => {
                  let dateObj = summary.generatedAt;
                  if (typeof dateObj === 'string') {
                    dateObj = new Date(dateObj);
                  }
                  if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
                    return dateObj.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });
                  } else {
                    return 'Unknown';
                  }
                })()}
              </span>
            </div>
          </div>
          {/* serverProcessing banner removed to avoid transient UI flips */}
        </div>

        {expanded && (
          <div className="p-6">
            {/* If the AI returned an `overall_summary` object, render it in a nice format */}
            {isStructured ? (
              <div className="space-y-6">
                {/* Overall summary (if present) */}
                {(content.overall_summary || content.overall_feedback || content.summary) && (
                  <div className="bg-muted/10 p-4 rounded border border-border">
                    <h3 className="text-lg font-semibold text-foreground mb-2">Overall Health</h3>
                    {typeof content.overall_summary === 'string' && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{content.overall_summary}</p>
                    )}
                    {content.overall_summary && typeof content.overall_summary === 'object' && (
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">Status</p>
                          <p className="text-sm text-muted-foreground">{content.overall_summary.overall_health || content.overall_summary.status || 'Unknown'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-foreground">Notes</p>
                          <p className="text-sm text-muted-foreground max-w-prose whitespace-pre-wrap">{content.overall_summary.feedback || content.overall_summary.summary || ''}</p>
                        </div>
                      </div>
                    )}
                    {typeof content.overall_feedback === 'string' && (
                      <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{content.overall_feedback}</p>
                    )}
                    {typeof content.summary === 'string' && !content.overall_summary && (
                      <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{content.summary}</p>
                    )}
                  </div>
                )}

                {Array.isArray(content.sections) && content.sections.length > 0 && (
                  <div className="space-y-4">
                    {content.sections.map((section: any, idx: number) => (
                      <div key={section?.heading || idx} className="bg-card rounded border border-border p-4">
                        <h4 className="font-semibold text-foreground mb-2 capitalize">{section?.heading || `Section ${idx + 1}`}</h4>
                        <p className="text-muted-foreground whitespace-pre-wrap">{section?.content || 'No information available.'}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Render each clinical area (anything except meta keys) */}
                {Object.keys(content).filter(k => !['id','userId','ocrTextHash','overall_summary','overall_feedback','generatedAt','documentCount','lastDocumentDate','summary','sections','explanations'].includes(k)).map((key) => {
                  const section = content[key];
                  if (section == null) return null;
                  const keyLower = key.toLowerCase();
                  // try to find matching vitals by category or label
                  const normalize = (s: string) =>
                    s
                      .toString()
                      .toLowerCase()
                      .replace(/[_\-]+/g, ' ')
                      .replace(/[^a-z0-9 ]+/g, '')
                      .replace(/\s+/g, ' ')
                      .trim();

                  const findMatchingVitals = () => {
                    const target = normalize(keyLower);
                    // build normalized category map
                    const normMap: Record<string, any[]> = {};
                    for (const cat of Object.keys(userVitalsByCategory)) {
                      const nk = normalize(cat);
                      normMap[nk] = userVitalsByCategory[cat];
                    }

                    if (normMap[target]) return normMap[target];

                    // fuzzy match: contains
                    for (const nk of Object.keys(normMap)) {
                      if (nk.includes(target) || target.includes(nk)) return normMap[nk];
                    }

                    // fallback: search through all vitals for label/type match
                    const all = Object.values(normMap).flat();
                    const hits = (all as any[]).filter((v) => {
                      const lab = normalize(v.label || '');
                      const type = normalize(v.vitalType || '');
                      return lab.includes(target) || type.includes(target) || target.includes(lab) || target.includes(type);
                    });
                    return hits;
                  };
                  const matchingVitals = findMatchingVitals() || [];
                  // If section is a primitive string, render as paragraph
                  if (typeof section === 'string') {
                    return (
                      <div key={key} className="bg-card rounded border border-border p-4">
                        <h4 className="font-semibold text-foreground mb-2 capitalize">{key.replace(/_/g, ' ')}</h4>
                        <p className="text-muted-foreground whitespace-pre-wrap">{section}</p>
                        {matchingVitals.length > 0 && (
                          <div className="mt-3">
                            <p className="font-medium text-foreground mb-1">Related Readings</p>
                            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                              {matchingVitals.map((v: any, i: number) => (
                                <li key={i}>
                                  <div className="text-foreground font-medium">{v.label} — {v.value}{v.unit ? ` ${v.unit}` : ''}</div>
                                  <div className="text-sm text-muted-foreground">{v.explanation || 'No explanation available'}</div>
                                  {v.advice && <div className="text-sm text-muted-foreground italic">Advice: {v.advice}</div>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  }
                  if (typeof section !== 'object') return null;
                  return (
                    <div key={key} className="bg-card rounded border border-border p-4">
                      <h4 className="font-semibold text-foreground mb-2 capitalize">{key.replace(/_/g, ' ')}</h4>
                      {section.summary && <div className="text-muted-foreground mb-3">{renderValue(section.summary)}</div>}

                      {/* Render status/feedback if present so card isn't empty */}
                      {section.status && (
                        <div className="mb-2">
                          <p className="font-medium text-foreground">Status</p>
                          <p className="text-sm text-muted-foreground">{typeof section.status === 'string' ? section.status : JSON.stringify(section.status)}</p>
                        </div>
                      )}
                      {section.feedback && (
                        <div className="mb-2">
                          <p className="font-medium text-foreground">Notes</p>
                          <div className="text-sm text-muted-foreground">{renderValue(section.feedback)}</div>
                        </div>
                      )}

                      {/* Render matching stored vitals (explanations/advice) if any */}
                      {matchingVitals.length > 0 && (
                        <div className="mb-3">
                          <p className="font-medium text-foreground mb-1">Related Readings</p>
                          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                            {matchingVitals.map((v: any, i: number) => (
                              <li key={i}>
                                <div className="text-foreground font-medium">{v.label} — {v.value}{v.unit ? ` ${v.unit}` : ''}</div>
                                <div className="text-sm text-muted-foreground">{v.explanation || 'No explanation available'}</div>
                                {v.advice && <div className="text-sm text-muted-foreground italic">Advice: {v.advice}</div>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {Array.isArray(section.abnormal_findings) && section.abnormal_findings.length > 0 && (
                        <div className="mb-3">
                          <p className="font-medium text-foreground mb-1">Abnormal Findings</p>
                          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                            {section.abnormal_findings.map((f: any, i: number) => (
                              <li key={i}>
                                <div className="text-foreground font-medium">{f.test || f.label || f.name || 'Finding'}</div>
                                <div className="text-sm text-muted-foreground">
                                  {f.value !== undefined ? `${f.value}${f.unit ? ' ' + f.unit : ''}` : ''}
                                  {f.reference_range ? ` — ref: ${f.reference_range}` : ''}
                                  {f.status ? ` — ${f.status}` : ''}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {section.advice && (
                        <div className="mt-2">
                          <p className="font-medium text-foreground mb-1">Advice</p>
                          <div className="text-sm text-muted-foreground">{renderValue(section.advice)}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              // Fallback to older `sections` / `summary` format
              <div className="space-y-6">
                {Array.isArray(fallbackSections) && fallbackSections.length > 0 ? (
                  fallbackSections.map((section: any, idx: number) => (
                    <div key={idx}>
                      <h3 className="text-lg font-semibold text-foreground mb-2">{section.heading}</h3>
                      <p className="text-muted-foreground whitespace-pre-wrap">{section.content}</p>
                    </div>
                  ))
                ) : (
                      <div>
                        {typeof displayContent === 'string' ? (
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{displayContent}</p>
                        ) : (
                          <pre className="bg-muted/5 rounded p-3 overflow-auto text-sm">
                            {JSON.stringify(displayContent, null, 2)}
                          </pre>
                        )}
                      </div>
                )}
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground italic">
                ⚠️ This summary is AI-generated based on your medical documents and is for informational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult your healthcare provider for medical decisions.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
