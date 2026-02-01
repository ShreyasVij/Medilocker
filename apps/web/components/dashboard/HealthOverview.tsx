import React from 'react';
// Assuming Lucide icons or similar are used
import { User } from 'lucide-react';

export default function HealthOverview({ 
  vitals, 
  loading, 
  error, 
  documentCount, 
  groupedVitals, 
  categoryIcons, 
  categoryLabels, 
  statusColors 
}: any) {
  
  // 1. Handle Loading State
  if (loading) {
    return (
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">Health Overview</h2>
          <p className="text-medical-note mt-1">Loading your health data...</p>
        </div>
      </section>
    );
  }

  // 2. Handle Error State
  if (error) {
    return (
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">Health Overview</h2>
          <p className="text-red-600 mt-1">Error loading vitals: {error}</p>
        </div>
      </section>
    );
  }

  // 3. Handle Empty State (No Documents)
  if (documentCount === 0) {
    return (
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">Health Overview</h2>
          <p className="text-medical-note mt-1">
            Recent readings from your medical records. For interpretation, please consult your healthcare provider.
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <div className="text-muted-foreground mb-2">No vitals available yet.</div>
          <p className="text-sm text-muted-foreground">Upload medical documents to track your health vitals</p>
        </div>
      </section>
    );
  }

  // 4. Handle Processing State (Docs exist but no vitals extracted yet)
  if (!vitals || vitals.length === 0) {
    return (
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">Health Overview</h2>
          <p className="text-medical-note mt-1">
            Recent readings from your medical records. For interpretation, please consult your healthcare provider.
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-full border-2 border-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Calculating vitals — fetching latest readings...</p>
          </div>
        </div>
      </section>
    );
  }

  // 5. Define Category Order
  const categoryOrder = [
    'Vital Signs',
    'Anthropometrics',
    'Blood Sugar',
    'Lipid Profile',
    'Blood Tests',
    'Liver Function',
    'Kidney Function',
    'Thyroid Function',
    'Other'
  ];

  // Filter categories to only those that have data
  const orderedCategories = categoryOrder.filter(
    (cat) => groupedVitals[cat] && groupedVitals[cat].length > 0
  );

  // 6. Main Render
  // Show extracted userVitals (raw) until AI-enriched vitals are available, then only show AI-enriched
  const hasAIEnriched = vitals && vitals.some((v: any) => v.explanation && v.explanation !== 'No explanation available.');
  const displayGroupedVitals = hasAIEnriched
    ? Object.fromEntries(
        Object.entries(groupedVitals).map(([cat, arr]) => [
          cat,
          (Array.isArray(arr) ? arr : []).filter((v: any) =>
            (v.explanation && v.explanation !== 'No explanation available.') ||
            (typeof v.advice === 'string' && v.advice.trim() !== '')
          )
        ]).filter(([_, arr]) => (Array.isArray(arr) && arr.length > 0))
      )
    : groupedVitals;

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">Health Overview</h2>
        <p className="text-medical-note mt-1">
          Recent readings from your medical records. For interpretation, please consult your healthcare provider.
        </p>
      </div>

      <div className="space-y-6">
        {orderedCategories.map((category) => {
          const categoryVitals = displayGroupedVitals[category];
          if (!categoryVitals || categoryVitals.length === 0) return null;
          const Icon = categoryIcons[category] || User;
          const categoryLabel = categoryLabels[category] || category;

          // Deduplicate: keep only the latest reading per vital label/type
          const latestVitalsMap = new Map();
          for (const vital of categoryVitals) {
            const key = (vital as any).vitalType || vital.label;
            const existing = latestVitalsMap.get(key);
            if (!existing || new Date(vital.documentDate) > new Date(existing.documentDate)) {
              latestVitalsMap.set(key, { ...vital });
            } else if (existing) {
              // Merge advice if missing in the latest but present in older
              if ((!existing.advice || existing.advice.trim() === '') && vital.advice && vital.advice.trim() !== '') {
                latestVitalsMap.set(key, { ...existing, advice: vital.advice });
              }
            }
          }
          const latestVitals = Array.from(latestVitalsMap.values());

          // Debug: Log each vital to inspect advice presence
          if (typeof window !== 'undefined') {
            console.log('HealthOverview: Rendering vitals for category', category, latestVitals);
          }

          return (
            <div key={category} className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/30 px-6 py-3 border-b border-border flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">{categoryLabel}</h3>
              </div>
              <div className="divide-y divide-border">
                {latestVitals.map((vital: any, idx: number) => (
                  <div key={vital.id || `${category}-${vital.label}-${idx}`} className="px-6 py-4 hover:bg-muted/20 transition-colors">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                      <div className="flex items-center">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-foreground">{vital.label}</span>
                            {vital.status && (
                              <span
                                className={`status-${vital.status} capitalize font-bold`}
                                style={{
                                  color:
                                    vital.status === 'alert'
                                      ? '#d32f2f' // red
                                      : vital.status === 'warning'
                                      ? '#f57c00' // orange
                                      : vital.status === 'normal'
                                      ? '#388e3c' // green
                                      : undefined
                                }}
                              >
                                {vital.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-foreground">
                          {vital.value}
                          {vital.unit && <span className="text-base font-normal text-muted-foreground ml-1">{vital.unit}</span>}
                        </div>
                      </div>
                      <div className="col-span-1 sm:col-span-2 mt-3">
                        <p className="text-sm text-muted-foreground mb-2">
                          <span className="font-semibold">What it means: </span>
                          {vital.explanation || 'No explanation available.'}
                        </p>
                        {/* Always show advice if present, even if explanation is missing */}
                        {typeof vital.advice === 'string' && vital.advice.trim() !== '' && (
                          <div className="mt-2 p-3 rounded bg-yellow-50 border border-yellow-200 text-black whitespace-pre-line">
                            <span className="font-semibold">Advice: </span>
                            <span className="font-normal">{vital.advice}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          <span>
                            {new Date(vital.documentDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                          <span>•</span>
                          <span>{vital.source}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}