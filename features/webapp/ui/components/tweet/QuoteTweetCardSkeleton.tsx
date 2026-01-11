// features/webapp/ui/components/tweet/QuoteTweetCardSkeleton.tsx
// Skeleton component for QuoteTweetCard - follows composition pattern per AGENT_CONTEXT.txt
"use client";

import { Skeleton } from "@/shared/ui/components/Skeleton";
import { cn } from "@/shared/lib/utils";

interface QuoteTweetCardSkeletonProps {
  className?: string;
}

/**
 * Loading skeleton for QuoteTweetCard component.
 * Per AGENT_CONTEXT.txt: Use separate skeleton components instead of loading props.
 */
export function QuoteTweetCardSkeleton({
  className,
}: QuoteTweetCardSkeletonProps) {
  return (
    <div
      className={cn("block w-full rounded-xl border p-2", className)}
      aria-label="Loading quoted tweet"
    >
      <div className="flex flex-col">
        <header className="mb-1 flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
            <Skeleton className="h-4 w-6 rounded-md" />
          </div>
        </header>
        <div className="mb-1 space-y-2">
          <Skeleton className="h-4 w-5/6 rounded-md" />
          <Skeleton className="h-4 w-4/6 rounded-md" />
        </div>
        <Skeleton className="mt-2 h-32 w-full rounded-md" />
      </div>
    </div>
  );
}
