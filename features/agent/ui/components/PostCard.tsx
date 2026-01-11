// features/agent/ui/components/PostCard.tsx
// Generative UI component for rendering posts inline in chat
// Per AGENT_CONTEXT.txt: Uses composition pattern with separate skeleton

"use client";

import type { Tweet as TweetType } from "@/features/threads/types";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { QuoteTweetCard } from "@/features/webapp/ui/components/tweet";
import { QuoteLinkedInCard } from "@/features/webapp/ui/components/linkedin";
import { cn } from "@/shared/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface PostCardProps {
  platform: "twitter" | "linkedin";
  /** Raw post data from the displayPost tool */
  postData: unknown;
  /** Context message explaining why this post is shown */
  context?: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// PostCard Component
// ============================================================================

/**
 * Renders a Quote Tweet or Quote LinkedIn card inline in the agent chat.
 * Used for generative UI to display posts when the agent discusses them.
 *
 * Per AGENT_CONTEXT.txt: No loading prop - use PostCardSkeleton externally.
 */
export function PostCard({
  platform,
  postData,
  context,
  className,
}: PostCardProps) {
  // No data - return nothing
  if (!postData) {
    return null;
  }

  return (
    <div className={cn("", className)}>
      {context && <p className="mb-4 text-sm italic">{context}</p>}
      {platform === "twitter" ? (
        <QuoteTweetCard tweet={postData as TweetType} showFullContent={true} />
      ) : platform === "linkedin" ? (
        <QuoteLinkedInCard
          post={postData as UnifiedPost}
          showFullContent={false}
        />
      ) : (
        // Fallback for unknown platform - try to render as tweet
        <QuoteTweetCard tweet={postData as TweetType} showFullContent={true} />
      )}
    </div>
  );
}
