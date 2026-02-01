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
    <PageLayout className="max-w-none border-none">
      <PageHeader title="Analytics" className="pl-4" />
      <PageContent className="p-4">
        <AnalyticsDashboard />
      </PageContent>
    </PageLayout>
  );
}
