"use client";

import * as React from "react";
import type { Tweet as TweetType } from "@/features/threads/types";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { Tweet } from "@/features/webapp/ui/components/tweet";
import { LinkedInPostCard } from "@/features/webapp/ui/components/linkedin/LinkedInPostCard";
import { cn } from "@/shared/lib/utils";
import {
  summarizeTwitterPost,
  type TwitterPostRef,
  type TwitterPostSummary,
} from "@/shared/lib/twitter/contracts";
import { toFallbackTweetFromSummary } from "@/shared/lib/twitter/ui";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import { TweetSkeleton } from "@/features/webapp/ui/components/tweet";

export interface PostCardProps {
  platform: "twitter" | "linkedin";
  postData?: unknown;
  postRef?: TwitterPostRef;
  postSummary?: TwitterPostSummary;
  context?: string;
  className?: string;
}

export function PostCard({
  platform,
  postData,
  postRef: _postRef,
  postSummary,
  context,
  className,
}: PostCardProps) {
  const resolvedSummary =
    platform === "twitter"
      ? (postSummary ?? summarizeTwitterPost(postData))
      : undefined;
  const { tweetsById, isLoading, error } = useHydratedTwitterPosts(
    platform === "twitter" && resolvedSummary
      ? [resolvedSummary.ref.postId]
      : []
  );

  if (!postData && !postSummary) {
    return null;
  }

  const renderedPost =
    platform === "twitter" ? (
      resolvedSummary ? (
        tweetsById[resolvedSummary.ref.postId] ? (
          <Tweet
            tweet={tweetsById[resolvedSummary.ref.postId] as TweetType}
            showFullContent
            showThread
          />
        ) : isLoading || !error ? (
          <TweetSkeleton showThread={true} />
        ) : (
          <Tweet
            tweet={toFallbackTweetFromSummary(resolvedSummary) as TweetType}
            showFullContent
            showThread
          />
        )
      ) : null
    ) : (
      <LinkedInPostCard post={postData as UnifiedPost} showFullContent />
    );

  return (
    <div className={cn("", className)}>
      {context && <p className="mb-4 text-sm italic">{context}</p>}
      {renderedPost}
    </div>
  );
}
