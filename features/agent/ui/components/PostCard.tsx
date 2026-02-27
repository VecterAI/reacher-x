"use client";

import type { Tweet as TweetType } from "@/features/threads/types";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { Tweet } from "@/features/webapp/ui/components/tweet";
import { LinkedInPostCard } from "@/features/webapp/ui/components/linkedin/LinkedInPostCard";
import { cn } from "@/shared/lib/utils";

export interface PostCardProps {
  platform: "twitter" | "linkedin";
  postData: unknown;
  context?: string;
  className?: string;
}

export function PostCard({
  platform,
  postData,
  context,
  className,
}: PostCardProps) {
  if (!postData) {
    return null;
  }

  const renderedPost =
    platform === "twitter" ? (
      <Tweet tweet={postData as TweetType} showFullContent showThread />
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
