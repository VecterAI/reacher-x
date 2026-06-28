/**
 * ThreadCardSkeleton
 * Loading skeleton for ThreadCard, mirroring the real thread row layout.
 * Used by HistoryPanel during search and initial load.
 */
"use client";

import { Skeleton } from "@/shared/ui/components/Skeleton";

export function ThreadCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="card-fade-bottom-mid border-border flex items-start gap-2 border-b p-4"
    >
      <Skeleton className="size-6 shrink-0 rounded-md" />

      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-[88%]" />
          <Skeleton className="h-4 w-[62%]" />
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </div>

      <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
    </article>
  );
}
