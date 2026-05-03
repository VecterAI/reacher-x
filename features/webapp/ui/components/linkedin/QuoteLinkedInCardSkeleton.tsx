// features/webapp/ui/components/linkedin/QuoteLinkedInCardSkeleton.tsx
// Skeleton component for QuoteLinkedInCard - follows composition pattern per AGENT_CONTEXT.txt
"use client";

import { Skeleton } from "@/shared/ui/components/Skeleton";

/**
 * Loading skeleton for QuoteLinkedInCard component.
 * Per AGENT_CONTEXT.txt: Use separate skeleton components instead of loading props.
 */
export function QuoteLinkedInCardSkeleton() {
  return (
    <div className="bg-card/30 rounded-xl border p-2">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="min-w-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1 h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[70%]" />
      </div>
      <div className="mt-2">
        <Skeleton className="aspect-video w-full rounded-lg" />
      </div>
    </div>
  );
}
