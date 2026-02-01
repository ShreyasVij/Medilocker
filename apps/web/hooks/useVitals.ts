"use client";
import { useEffect, useState } from 'react';

export function useVitals() {
  const [vitals, setVitals] = useState<any[]>([]);
  const [groupedVitals, setGroupedVitals] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentCount, setDocumentCount] = useState<number>(0);

  useEffect(() => {
    async function fetchVitals() {
      setLoading(true);
      try {
        const res = await fetch('/api/vitals');
        if (!res.ok) throw new Error('Failed to fetch vitals');
        const data = await res.json();
        setVitals(data.vitals || []);
        setGroupedVitals(data.groupedVitals || {});
        setDocumentCount(data.totalCount || 0);
      } catch (err: any) {
        setError(err.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchVitals();
  }, []);

  // Provide sensible defaults for icons, labels, and status colors
  const categoryIcons = {};
  const categoryLabels = {};
  const statusColors = {
    normal: 'bg-green-100 text-green-800',
    abnormal: 'bg-red-100 text-red-800',
    borderline: 'bg-yellow-100 text-yellow-800',
    unknown: 'bg-gray-100 text-gray-800',
  };

  return {
    vitals,
    groupedVitals,
    loading,
    error,
    documentCount,
    categoryIcons,
    categoryLabels,
    statusColors,
  };
}
