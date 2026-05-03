// features/agent/ui/components/PostCardSkeleton.tsx
// Skeleton component for PostCard - follows composition pattern per AGENT_CONTEXT.txt
"use client";

import { QuoteTweetCardSkeleton } from "@/features/webapp/ui/components/tweet";
import { QuoteLinkedInCardSkeleton } from "@/features/webapp/ui/components/linkedin/QuoteLinkedInCardSkeleton";
import { cn } from "@/shared/lib/utils";

export interface PostCardSkeletonProps {
  platform?: "twitter" | "linkedin";
  context?: string;
  className?: string;
}

/**
 * Loading skeleton for PostCard.
 * Per AGENT_CONTEXT.txt: Uses composition pattern - external skeleton component.
 */
export function PostCardSkeleton({
  platform = "twitter",
  context,
  className,
}: PostCardSkeletonProps) {
  return (
    <div className={cn("w-full", className)}>
      {context && (
        <p className="text-muted-foreground mb-2 text-xs italic">{context}</p>
      )}
      {platform === "twitter" ? (
        <QuoteTweetCardSkeleton />
      ) : (
        <QuoteLinkedInCardSkeleton />
      )}
    </div>
  );
}
