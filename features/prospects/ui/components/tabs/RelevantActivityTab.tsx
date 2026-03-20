/**
 * RelevantActivityTab
 * Displays evidence posts that qualified this prospect.
 * Shows max 10 posts initially with "Load more" pagination.
 * Posts are sorted by newest first.
 */
"use client";

import * as React from "react";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Tweet, TweetSkeleton } from "@/features/webapp/ui/components/tweet";
import { LinkedInPostCard } from "@/features/webapp/ui/components/linkedin";
import type { Tweet as TweetType } from "@/features/threads/types";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";

// ============================================================================
// Types
// ============================================================================

export interface RelevantActivityTabProps {
  /** Prospect ID to fetch evidence posts for */
  prospectId: string;
  /** Platform for rendering posts */
  platform: "twitter" | "linkedin";
  /** Evidence posts from prospect data (optional, for non-mock usage) */
  evidencePosts?: unknown[];
}

const POSTS_PER_PAGE = 10;

// ============================================================================
// Component
// ============================================================================

export function RelevantActivityTab({
  prospectId,
  platform,
  evidencePosts,
}: RelevantActivityTabProps) {
  const [visibleCount, setVisibleCount] = React.useState(POSTS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  // Use evidence posts from props
  const allPosts = React.useMemo(() => {
    return (evidencePosts as unknown[]) || [];
  }, [evidencePosts]);

  // Sort by newest first (based on tweet_created_at or postedAt)
  const sortedPosts = React.useMemo(() => {
    return [...allPosts].sort((a, b) => {
      const aTime = getPostTimestamp(a);
      const bTime = getPostTimestamp(b);
      return bTime - aTime; // Descending (newest first)
    });
  }, [allPosts]);

  const visiblePosts = sortedPosts.slice(0, visibleCount);
  const hasMore = visibleCount < sortedPosts.length;
  // Depend on sortedPosts + visibleCount, not visiblePosts (slice() is a new array every render).
  const visibleTwitterPostIds = React.useMemo(
    () =>
      platform === "twitter"
        ? sortedPosts
            .slice(0, visibleCount)
            .map((post) => getPostId(post))
            .filter((postId): postId is string => Boolean(postId))
        : [],
    [platform, visibleCount, sortedPosts]
  );
  const { tweetsById, isLoading, error } = useHydratedTwitterPosts(
    visibleTwitterPostIds
  );

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    // Simulate loading delay
    setTimeout(() => {
      setVisibleCount((prev) => prev + POSTS_PER_PAGE);
      setIsLoadingMore(false);
    }, 500);
  };

  if (sortedPosts.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No relevant activity found.
      </div>
    );
  }

  return (
    <section className="space-y-0">
      <div className="divide-y">
        {visiblePosts.map((post, index) => (
          <article
            key={`${prospectId}-${getPostId(post) || index}`}
            className="px-4 pt-4 pb-2"
          >
            {platform === "twitter" ? (
              (() => {
                const postId = getPostId(post);
                const hydratedTweet = postId ? tweetsById[postId] : undefined;
                if (hydratedTweet) {
                  return (
                    <Tweet
                      tweet={hydratedTweet as TweetType}
                      characterLimit={280}
                      showThread={true}
                    />
                  );
                }

                if (isLoading || !error) {
                  return <TweetSkeleton showThread={true} />;
                }

                return (
                  <div className="text-muted-foreground text-sm">
                    Could not load this post from X.
                  </div>
                );
              })()
            ) : (
              <LinkedInPostCard
                post={post as UnifiedPost}
                characterLimit={300}
              />
            )}
          </article>
        ))}
      </div>

      {hasMore && (
        <div className="p-4">
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

export function RelevantActivityTabSkeleton() {
  return (
    <div className="divide-y">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3 px-4 py-3">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-16 w-full" />
          <div className="flex gap-4">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPostTimestamp(post: unknown): number {
  const p = post as Record<string, unknown>;

  // Twitter format
  if (typeof p.tweet_created_at === "string") {
    return new Date(p.tweet_created_at).getTime();
  }

  // LinkedIn format
  if (
    p.postedAt &&
    typeof (p.postedAt as Record<string, unknown>).timestamp === "number"
  ) {
    return (p.postedAt as Record<string, unknown>).timestamp as number;
  }

  return 0;
}

function getPostId(post: unknown): string | undefined {
  const p = post as Record<string, unknown>;

  // Twitter format
  if (typeof p.id_str === "string") {
    return p.id_str;
  }

  // LinkedIn format
  if (typeof p.postID === "string") {
    return p.postID;
  }

  return undefined;
}
