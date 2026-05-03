// app/(webapp)/analytics/page.tsx
"use client";

import { useRouter } from "next/navigation";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { AnalyticsDashboard } from "@/features/analytics/ui/AnalyticsDashboard";
import { useActiveUseCaseLabels } from "@/shared/hooks";

export default function AnalyticsPage() {
  const router = useRouter();
  const { pageLabels } = useActiveUseCaseLabels();

  return (
    <PageLayout className="flex max-w-none flex-col overflow-hidden border-none">
      <PageHeader title={pageLabels.analytics} onBack={() => router.back()} />
      <PageContent className="min-h-0 flex-1 overflow-y-auto scroll-fade-effect-y p-4">
        <AnalyticsDashboard />
      </PageContent>
    </PageLayout>
  );
}
