/**
 * ThreadCardSkeleton
 * Loading skeleton for ThreadCard, following the composition pattern.
 * Used by HistoryPanel during search and initial load.
 */
"use client";

import { Skeleton } from "@/shared/ui/components/Skeleton";

export function ThreadCardSkeleton() {
  return (
    <article className="flex items-start gap-3 px-3 py-2.5">
      <Skeleton className="mt-0.5 size-4 rounded-sm" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full rounded-sm" />
        <Skeleton className="h-3 w-16 rounded-sm" />
      </div>
    </article>
  );
}
