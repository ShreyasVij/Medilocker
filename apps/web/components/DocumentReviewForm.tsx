"use client";

import { useEffect, useState } from "react";

export type ExtractedDocument = {
  patient_name?: string;
  dob?: string;
  report_date?: string;
  doctor_name?: string;
  diagnosis?: string;
  medications?: { name?: string; dose?: string; frequency?: string }[];
  vitals?: { label?: string; value?: string | number; unit?: string | null }[];
  summary?: any;
  classification?: string;
  raw_text?: string;
};

interface Props {
  data: ExtractedDocument;
  onConfirm: (payload: ExtractedDocument) => void;
}

export function DocumentReviewForm({ data, onConfirm }: Props) {
  const [draft, setDraft] = useState<ExtractedDocument>(data);

  useEffect(() => {
    // Preserve AI response verbatim; no fallbacks or overrides.
    setDraft({ ...(data || {}) });
  }, [data]);

  const updateField = (key: keyof ExtractedDocument, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const updateVital = (idx: number, key: 'label' | 'value' | 'unit', value: string) => {
    setDraft(prev => {
      const rows = Array.isArray(prev.vitals) ? [...prev.vitals] : [];
      const current = rows[idx] || { label: '', value: '', unit: '' };
      rows[idx] = { ...current, [key]: value };
      return { ...prev, vitals: rows };
    });
  };

  const addVital = () => {
    setDraft(prev => ({ ...prev, vitals: [...(prev.vitals || []), { label: '', value: '', unit: '' }] }));
  };

  const removeVital = (idx: number) => {
    setDraft(prev => ({ ...prev, vitals: (prev.vitals || []).filter((_, i) => i !== idx) }));
  };

  return (
    <div className="space-y-3">
      <h5 className="mb-2" style={{ color: "#81102A" }}>Extracted Information</h5>
      <div className="p-3 bg-white rounded-3 border shadow-sm" style={{ display: 'flex', flexDirection: 'column', maxHeight: '60vh' }}>
        <div id="extracted-form-body" role="region" aria-label="Extracted document fields" tabIndex={0} style={{ overflowY: 'auto', paddingRight: 8, WebkitOverflowScrolling: 'touch' }}>
          <label className="form-label small text-uppercase text-muted">Patient Name</label>
          <input className="form-control mb-3" value={draft.patient_name || ""} onChange={(e) => updateField("patient_name", e.target.value)} />

          <label className="form-label small text-uppercase text-muted">Date of Birth</label>
          <input className="form-control mb-3" value={draft.dob || ""} onChange={(e) => updateField("dob", e.target.value)} />

          <label className="form-label small text-uppercase text-muted">Doctor Name</label>
          <input className="form-control mb-3" value={draft.doctor_name || ""} onChange={(e) => updateField("doctor_name", e.target.value)} />

          <label className="form-label small text-uppercase text-muted">Diagnosis</label>
          <input className="form-control mb-3" value={draft.diagnosis || ""} placeholder="no outright diagnosis by the doctor" onChange={(e) => updateField("diagnosis", e.target.value)} />

          <label className="form-label small text-uppercase text-muted">Summary</label>
          <textarea className="form-control mb-3" rows={3} value={typeof draft.summary === 'string' ? (draft.summary || "") : (draft.summary ? JSON.stringify(draft.summary) : "")} onChange={(e) => updateField("summary", e.target.value)} />

          <label className="form-label small text-uppercase text-muted">Classification</label>
          <input className="form-control mb-3" value={draft.classification || ""} onChange={(e) => updateField("classification", e.target.value)} />

          <div className="mt-2">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <div className="fw-semibold">Vitals</div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addVital}>Add Row</button>
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr><th style={{width:'45%'}}>Label</th><th style={{width:'35%'}}>Value</th><th style={{width:'20%'}}>Unit</th><th style={{width:32}}></th></tr>
                </thead>
                <tbody>
                  {(draft.vitals || []).length === 0 ? (
                    <tr><td className="text-muted">—</td><td className="text-muted">—</td><td className="text-muted">—</td><td></td></tr>
                  ) : (
                    (draft.vitals || []).map((v, idx) => (
                      <tr key={idx}>
                        <td>
                          <input className="form-control form-control-sm" value={v.label || ''} onChange={e=> updateVital(idx, 'label', e.target.value)} />
                        </td>
                        <td>
                          <input className="form-control form-control-sm" value={String(v.value ?? '')} onChange={e=> updateVital(idx, 'value', e.target.value)} />
                        </td>
                        <td>
                          <input className="form-control form-control-sm" value={v.unit || '-'} onChange={e=> updateVital(idx, 'unit', e.target.value === '-' ? '' : e.target.value)} />
                        </td>
                        <td>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={()=> removeVital(idx)}>✕</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ position: 'sticky', bottom: 0, background: 'white', paddingTop: 8, paddingBottom: 0 }}>
          <div className="d-grid mt-3">
            <button className="btn" style={{ background: "#81102A", color: "white" }} onClick={() => onConfirm(draft)}>
              Confirm & Save to Vault
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentReviewForm;
