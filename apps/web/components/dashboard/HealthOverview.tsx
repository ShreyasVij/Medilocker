"use client";

import { Heart, Activity, Droplets, Scale, Thermometer, Zap, User, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

interface VitalReading {
  id: string;
  label: string;
  value: string | number;
  unit: string | null;
  documentDate: Date;
  source: string;
  explanation: string;
  advice?: string;
  status?: "normal" | "warning" | "alert";
  vitalCategory: string;
}

interface GroupedVitals {
  [category: string]: VitalReading[];
}

const categoryIcons: Record<string, React.ElementType> = {
  'Vital Signs': Activity,
  'Anthropometrics': Scale,
  'Blood Sugar': Zap,
  'Lipid Profile': Heart,
  'Blood Tests': Droplets,
  'Liver Function': TrendingUp,
  'Kidney Function': Scale,
  'Thyroid Function': Thermometer,
  'Other': User
};

const categoryLabels: Record<string, string> = {
  'Vital Signs': 'Vital Signs',
  'Anthropometrics': 'Anthropometrics',
  'Blood Sugar': 'Blood Sugar',
  'Lipid Profile': 'Lipid Profile',
  'Blood Tests': 'Blood Tests',
  'Liver Function': 'Liver Function',
  'Kidney Function': 'Kidney Function',
  'Thyroid Function': 'Thyroid Function',
  'Other': 'Other Measurements'
};

const statusColors = {
  normal: "text-green-600 bg-green-50",
  warning: "text-yellow-600 bg-yellow-50",
  alert: "text-red-600 bg-red-50"
};

export function HealthOverview() {
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [groupedVitals, setGroupedVitals] = useState<GroupedVitals>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentCount, setDocumentCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchVitals() {
      try {
        const res = await fetch('/api/vitals');
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch vitals');
        }
        const data = await res.json();
        setVitals(data.vitals || []);
        setGroupedVitals(data.groupedVitals || {});
        // fetch active + archived (bin) document count so a document in the bin
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
      } catch (err: any) {
        console.error('Error fetching vitals:', err);
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchVitals();
  }, []);

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

  // Get ordered categories (medically accurate order)
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
  const orderedCategories = categoryOrder.filter(cat => groupedVitals[cat] && groupedVitals[cat].length > 0);

  // If user has zero active documents, show empty message regardless of stored vitals
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

  // If there are documents but vitals are not yet available, show calculating indicator
  if (vitals.length === 0) {
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

  // otherwise render vitals
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
            const categoryVitals = groupedVitals[category];
            const Icon = categoryIcons[category] || User;
            const categoryLabel = categoryLabels[category] || category;

            return (
              <div key={category} className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="bg-muted/30 px-6 py-3 border-b border-border flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">{categoryLabel}</h3>
                </div>
                
                <div className="divide-y divide-border">
                  {categoryVitals.map((vital) => (
                    <div key={vital.id} className="px-6 py-4 hover:bg-muted/20 transition-colors">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                        <div className="flex items-center">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-foreground">{vital.label}</span>
                              {vital.status && (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[vital.status]}`}>
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
                          {vital.advice && (
                            <p className="text-sm text-blue-700 bg-blue-50 rounded px-2 py-1 inline-block">
                              <span className="font-semibold">Advice: </span>
                              {vital.advice}
                            </p>
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
