// app/(webapp)/analytics/page.tsx
"use client";

import { useRouter } from "next/navigation";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { BidLandscapeIcon } from "@/shared/ui/components/icons";

export default function AnalyticsPage() {
  const router = useRouter();

  return (
    <PageLayout className="max-w-none border-none">
      <PageHeader title="Analytics" onBack={() => router.back()} />
      <PageContent className="flex h-full flex-col items-center justify-center p-4">
        <div className="text-muted-foreground text-center">
          <BidLandscapeIcon className="fill-muted-foreground mx-auto mb-4 size-16" />
          <h2 className="text-lg font-medium">Analytics Dashboard</h2>
          <p className="mt-2 text-sm">
            Coming soon — track your prospecting performance and engagement
            metrics
          </p>
        </div>
      </PageContent>
    </PageLayout>
  );
}
