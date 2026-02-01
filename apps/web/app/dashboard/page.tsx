"use client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import React from "react";
import HealthOverview from "@/components/dashboard/HealthOverview";
import { useVitals } from "@/hooks/useVitals";
import { HealthSummaryPanel } from "@/components/dashboard/HealthSummaryPanel";
import { ReprocessButton } from "@/components/dashboard/ReprocessButton";

function DashboardPageClient() {
  const {
    vitals,
    groupedVitals,
    loading,
    error,
    documentCount,
    categoryIcons,
    categoryLabels,
    statusColors,
  } = useVitals();

  return (
    <div className="max-w-6xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground mt-1">Here's an overview of your health records.</p>
        </div>
        <ReprocessButton />
      </div>

      {/* Two-column layout: left = vitals, right = formatted health summary */}
      <div className="flex gap-6">
        <div className="w-1/3 min-w-[320px] max-h-[72vh] overflow-auto">
          <HealthOverview
            vitals={vitals}
            groupedVitals={groupedVitals}
            loading={loading}
            error={error}
            documentCount={documentCount}
            categoryIcons={categoryIcons}
            categoryLabels={categoryLabels}
            statusColors={statusColors}
          />
        </div>

        <div className="flex-1 max-h-[72vh] overflow-auto">
          <HealthSummaryPanel />
        </div>
      </div>

      <div className="mt-12 pt-6 border-t border-border">
      </div>
    </div>
  );
}

export default function DashboardPage() {
  // This page is now a client component
  return <DashboardPageClient />;
}