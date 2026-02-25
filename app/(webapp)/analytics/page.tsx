// app/(webapp)/analytics/page.tsx
"use client";

import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { AnalyticsDashboard } from "@/features/analytics/ui/AnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <PageLayout className="flex max-w-none flex-col overflow-hidden border-none">
      <PageHeader title="Analytics" className="pl-4" />
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4">
        <AnalyticsDashboard />
      </PageContent>
    </PageLayout>
  );
}
