// features/webapp/ui/components/linkedin/LinkedInPostCardSkeleton.tsx
// Skeleton component for LinkedInPostCard - follows composition pattern per AGENT_CONTEXT.txt
"use client";

import { Skeleton } from "@/shared/ui/components/Skeleton";

/**
 * Loading skeleton for LinkedInPostCard component.
 * Per AGENT_CONTEXT.txt: Use separate skeleton components instead of loading props.
 */
export function LinkedInPostCardSkeleton() {
  return (
    <article className="w-full">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="min-w-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-1 h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-4 w-[75%]" />
      </div>
      <div className="mt-2">
        <Skeleton className="aspect-video w-full rounded-xl" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="my-2">
        <Skeleton className="h-px w-full" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-6" />
        </div>
      </div>
    </article>
  );
}
