"use client";
import React from "react";
import HealthOverview from "@/components/dashboard/HealthOverview";
import { useVitals } from "@/hooks/useVitals";
import { HealthSummaryPanel } from "@/components/dashboard/HealthSummaryPanel";
import { ReprocessButton } from "@/components/dashboard/ReprocessButton";
import { useSession } from "next-auth/react";

function DashboardPageClient() {
  const { data: session, status } = useSession();
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

  const displayName = session?.user?.name || session?.user?.email?.split("@")[0] || null;
  const isReturningUser = status === "authenticated" && !session?.user?.isNewUser;
  const greeting = isReturningUser
    ? displayName
      ? `Welcome back, ${displayName}`
      : "Welcome back"
    : "Welcome";
  const subtitle = isReturningUser
    ? "Here's an overview of your health records."
    : "Here's your dashboard overview."

  return (
    <div className="max-w-6xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{greeting}</h1>
          <p className="text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <ReprocessButton />
      </div>

      {/* Two-column layout: left = vitals, right = formatted health summary */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-1/3 lg:min-w-[320px] max-h-[72vh] overflow-auto">
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