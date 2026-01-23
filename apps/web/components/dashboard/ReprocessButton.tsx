"use client";

import { RefreshCw } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export function ReprocessButton() {
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [disabledByServer, setDisabledByServer] = useState(false);
  const consecRef = useRef(0);

  async function handleReprocess() {
    setProcessing(true);
    setMessage(null);
    setIsError(false);

    try {
      console.log('🔄 Starting document reprocessing...');
      const res = await fetch('/api/vitals/reprocess', {
        method: 'POST'
      });

      const data = await res.json();
      console.log('📊 Reprocess result:', data);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reprocess documents');
      }

      // Show appropriate message based on results
      let successMsg = '';
      if (data.vitalsUpdated > 0) {
        successMsg = `✓ Success! Processed ${data.documentsProcessed}/${data.totalDocuments} documents, updated ${data.vitalsUpdated} vitals.`;
      } else if (data.totalDocuments === 0) {
        successMsg = '⚠️ No documents found to process. Please upload medical documents first.';
      } else if (data.errors && data.errors.length > 0) {
        successMsg = `⚠️ Found ${data.totalDocuments} document(s) but couldn't extract vitals. Check if documents contain health data.`;
      } else {
        successMsg = `ℹ️ Found ${data.totalDocuments} document(s). No new vitals to update.`;
      }
      
      setMessage(successMsg);
      setIsError(data.vitalsUpdated === 0 && data.totalDocuments > 0);

      // Only reload if vitals were actually updated
      if (data.vitalsUpdated > 0) {
        console.log('✅ Vitals updated, reloading page in 3 seconds...');
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        console.log('ℹ️ No vitals updated, not reloading page');
      }

    } catch (err: any) {
      console.error('❌ Reprocess error:', err);
      setMessage(`✗ Error: ${err.message}`);
      setIsError(true);
    } finally {
      setProcessing(false);
    }
  }

  // Poll health-summary to see if server reports processing; disable button when true
  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const res = await fetch('/api/health-summary');
        if (!res.ok) {
          // Reset any transient state if the endpoint isn't available
          consecRef.current = 0;
          setDisabledByServer(false);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        // Only consider disabling the button when the server reports processing
        // AND there is a stored summary (avoid disabling when summary is null)
        const isProc = Boolean(data.processing) && (data.summary != null);

        // Additionally, fetch vitals to detect placeholder explanations. If any vital
        // has a placeholder explanation like "No explanation available" and an
        // empty advice string, treat vitals as incomplete and DO NOT disable the
        // button so the user can retry reprocessing.
        let incompleteVitals = false;
        try {
          const vres = await fetch('/api/vitals');
          if (vres.ok) {
            const vdata = await vres.json().catch(() => ({}));
            const vitalsList = Array.isArray(vdata.vitals) ? vdata.vitals : [];
            for (const v of vitalsList) {
              const expl = (v && typeof v.explanation === 'string') ? v.explanation.trim() : '';
              const adv = (v && typeof v.advice === 'string') ? v.advice.trim() : '';
              if (expl && /^no explanation/i.test(expl) && adv === '') {
                incompleteVitals = true;
                break;
              }
            }
          }
        } catch (e) {
          // If vitals endpoint fails, be conservative and do not change incompleteVitals
        }

        const shouldConsiderDisable = isProc && !incompleteVitals;
        if (shouldConsiderDisable) {
          consecRef.current = Math.min(3, consecRef.current + 1);
        } else {
          consecRef.current = 0;
        }
        // Only disable after two consecutive polls reporting processing and vitals complete
        setDisabledByServer(consecRef.current >= 2 && shouldConsiderDisable);
      } catch {}
    }
    check();
    const timer = setInterval(check, 3000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleReprocess}
        disabled={processing || disabledByServer}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        title="Reprocess all existing documents to update vitals and health summary"
      >
        <RefreshCw className={`h-4 w-4 ${processing ? 'animate-spin' : ''}`} />
        {processing || disabledByServer ? 'Processing...' : 'Refresh Health Data'}
      </button>
      
      {message && (
        <p className={`text-sm ${isError ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
