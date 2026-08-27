"use client";

import { Skeleton } from "@/shared/ui/components/Skeleton";
import { LinkedInReplyComposer } from "./LinkedInReplyComposer";

export interface LinkedInCommentThreadSkeletonProps {
  prospectId?: string;
}

function LinkedInCommentItemSkeleton() {
  return (
    <article className="flex items-start gap-3" aria-hidden="true">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48 max-w-[70%]" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
        <div className="flex items-center gap-3 pl-1">
          <Skeleton className="h-5 w-10 rounded-md" />
          <Skeleton className="h-5 w-12 rounded-md" />
        </div>
      </div>
    </article>
  );
}

export function LinkedInCommentThreadSkeleton({
  prospectId,
}: LinkedInCommentThreadSkeletonProps) {
  return (
    <div
      className="space-y-5"
      role="status"
      aria-label="Loading comments"
      aria-live="polite"
    >
      <LinkedInReplyComposer
        prospectId={prospectId}
        placeholder="Add a comment..."
        submitLabel="Comment"
        disabled
        onSubmit={() => undefined}
      />
      <div className="space-y-5">
        <LinkedInCommentItemSkeleton />
        <LinkedInCommentItemSkeleton />
        <LinkedInCommentItemSkeleton />
      </div>
      <span className="sr-only">Loading comments</span>
    </div>
  );
}
