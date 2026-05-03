// features/webapp/ui/components/tweet/TweetSkeleton.tsx
// Skeleton component for Tweet - follows composition pattern per AGENT_CONTEXT.txt
"use client";

import { Skeleton } from "@/shared/ui/components/Skeleton";
import { cn } from "@/shared/lib/utils";

interface TweetSkeletonProps {
  showThread?: boolean;
  className?: string;
}

/**
 * Loading skeleton for Tweet component.
 * Per AGENT_CONTEXT.txt: Use separate skeleton components instead of loading props.
 */
export function TweetSkeleton({
  showThread = false,
  className,
}: TweetSkeletonProps) {
  return (
    <article
      className={cn("group flex w-full gap-2", className)}
      aria-label="Loading tweet"
    >
      {/* Left column: avatar + thread guideline */}
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="mt-1 h-8 w-8 rounded-full" />
        {!showThread && <Skeleton className="w-0.5 flex-1" />}
      </div>
      {/* Right column: content */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
          <Skeleton className="h-4 w-6 rounded-md" />
        </header>
        <div className="my-2 space-y-2">
          <Skeleton className="h-4 w-5/6 rounded-md" />
          <Skeleton className="h-4 w-4/6 rounded-md" />
          <Skeleton className="h-4 w-3/6 rounded-md" />
        </div>
        <div className="mt-2">
          <Skeleton className="h-6 w-24 rounded-md" />
        </div>
        <div className="mt-2 flex items-center gap-4">
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-6 w-12 rounded-md" />
        </div>
      </div>
    </article>
  );
}
