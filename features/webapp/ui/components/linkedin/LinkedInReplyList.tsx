"use client";

import * as React from "react";
import type { LinkedInCommentPage } from "@/shared/lib/linkedin/comments";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";

export interface LinkedInReplyListProps {
  page?: LinkedInCommentPage;
  loading?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  children: React.ReactNode;
}

export function LinkedInReplyList({
  page,
  loading = false,
  error,
  onLoadMore,
  children,
}: LinkedInReplyListProps) {
  return (
    <div className="border-border/70 ml-4 border-l pl-4">
      <div className="space-y-4">
        {children}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-5/6" />
          </div>
        ) : null}
        {!loading && error ? (
          <div className="rounded-[20px] border px-4 py-3 text-sm">
            <p className="font-medium">Could not load replies</p>
            <p className="text-muted-foreground mt-1">{error}</p>
          </div>
        ) : null}
        {!loading && !error && page?.cursor && onLoadMore ? (
          <Button variant="ghost" size="xs" onClick={onLoadMore}>
            Load more replies
          </Button>
        ) : null}
      </div>
    </div>
  );
}
