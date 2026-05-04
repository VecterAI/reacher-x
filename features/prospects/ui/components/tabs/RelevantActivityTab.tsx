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
import {
  LinkedInCommentThread,
  LinkedInPostCard,
} from "@/features/webapp/ui/components/linkedin";
import type { Tweet as TweetType } from "@/features/threads/types";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import { useTwitterTimelineEngagementMerge } from "@/shared/hooks/useTwitterTimelineEngagementMerge";
import {
  getTwitterPostId,
  summarizeTwitterPost,
} from "@/shared/lib/twitter/contracts";
import { toFallbackTweetFromSummary } from "@/shared/lib/twitter/ui";
import { UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS } from "@/features/prospects/lib/uiPreviewData";

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
  /** How this prospect was discovered */
  discoverySource?: "search_post" | "search_people" | "conversation_reply";
  /** Disables write actions and panel-expanding affordances */
  readOnly?: boolean;
}

const POSTS_PER_PAGE = 10;

// ============================================================================
// Component
// ============================================================================

export function RelevantActivityTab({
  prospectId,
  platform,
  evidencePosts,
  discoverySource,
  readOnly = false,
}: RelevantActivityTabProps) {
  const [visibleCount, setVisibleCount] = React.useState(POSTS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [openLinkedInPostId, setOpenLinkedInPostId] = React.useState<
    string | null
  >(null);

  // Use evidence posts from props
  const allPosts = React.useMemo(() => {
    return dedupePosts((evidencePosts as unknown[]) || []);
  }, [evidencePosts]);

  // Sort by newest first (based on tweet_created_at or postedAt)
  const sortedPosts = React.useMemo(() => {
    return allPosts.toSorted((a, b) => {
      const aTime = getPostTimestamp(a);
      const bTime = getPostTimestamp(b);
      return bTime - aTime; // Descending (newest first)
    });
  }, [allPosts]);

  const visiblePosts = sortedPosts.slice(0, visibleCount);
  const hasMore = visibleCount < sortedPosts.length;
  // Depend on sortedPosts + visibleCount, not visiblePosts (slice() is a new array every render).
  const visibleTwitterPostIds = React.useMemo(
    () => {
      if (platform !== "twitter") {
        return [];
      }

      const postIds: string[] = [];
      for (const post of sortedPosts.slice(0, visibleCount)) {
        const postId = getPostId(post);
        if (postId) {
          postIds.push(postId);
        }
      }
      return postIds;
    },
    [platform, visibleCount, sortedPosts]
  );
  const { tweetsById, resultsById, error } =
    useHydratedTwitterPosts(visibleTwitterPostIds);
  const fallbackTweets = useTwitterTimelineEngagementMerge(
    React.useMemo(
      () => {
        if (platform !== "twitter") {
          return [];
        }

        const tweets: TweetType[] = [];
        for (const post of sortedPosts.slice(0, visibleCount)) {
          const summary = summarizeTwitterPost(post);
          if (!summary) {
            continue;
          }
          const tweet = toFallbackTweetFromSummary(summary) as TweetType;
          if (tweet.id_str) {
            tweets.push(tweet);
          }
        }
        return tweets;
      },
      [platform, sortedPosts, visibleCount]
    )
  );
  const fallbackTweetsById = React.useMemo(
    () => {
      const tweetsById: Record<string, TweetType> = {};
      for (const tweet of fallbackTweets) {
        if (tweet.id_str) {
          tweetsById[tweet.id_str] = tweet;
        }
      }
      return tweetsById;
    },
    [fallbackTweets]
  );
  const isInitialHydrationPending =
    platform === "twitter" &&
    visibleTwitterPostIds.some(
      (postId) => !tweetsById[postId] && !resultsById[postId]
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
    const emptyMessage =
      platform === "linkedin" && discoverySource === "search_people"
        ? "Relevant LinkedIn activity is still syncing for this profile."
        : "No relevant activity found.";
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <section className="space-y-0">
      <div className="divide-y">
        {visiblePosts.map((post, index) => (
          <article
            key={getPostKey(prospectId, post, index)}
            className="px-4 pt-4 pb-2"
          >
            {platform === "twitter" ? (
              (() => {
                const postId = getPostId(post);
                const hydratedTweet = postId ? tweetsById[postId] : undefined;
                const fallbackTweet = postId
                  ? fallbackTweetsById[postId]
                  : undefined;
                const hydrationResult = postId
                  ? resultsById[postId]
                  : undefined;
                const isPostPending = !hydratedTweet && !hydrationResult;
                if (hydratedTweet) {
                  return (
                    <Tweet
                      tweet={hydratedTweet as TweetType}
                      characterLimit={280}
                      showThread={true}
                      readOnly={readOnly}
                    />
                  );
                }

                if (isPostPending) {
                  return <TweetSkeleton showThread={true} />;
                }

                if (fallbackTweet) {
                  return (
                    <Tweet
                      tweet={fallbackTweet}
                      characterLimit={280}
                      showThread={true}
                      readOnly={readOnly}
                    />
                  );
                }

                return (
                  <div className="text-muted-foreground text-sm">
                    {error || "Could not load this post right now."}
                  </div>
                );
              })()
            ) : (
              <LinkedInPostCard
                post={post as UnifiedPost}
                prospectId={prospectId}
                characterLimit={300}
                readOnly={readOnly}
                disableExternalNavigation={readOnly && platform === "linkedin"}
                commentBehavior="open_thread"
                isCommentsOpen={openLinkedInPostId === (post as UnifiedPost).id}
                onToggleComments={(linkedinPost) =>
                  setOpenLinkedInPostId((previous) =>
                    previous === linkedinPost.id ? null : linkedinPost.id
                  )
                }
                commentThread={
                  openLinkedInPostId === (post as UnifiedPost).id ? (
                    <LinkedInCommentThread
                      post={post as UnifiedPost}
                      prospectId={prospectId}
                      previewScenario={
                        readOnly && platform === "linkedin"
                          ? {
                              ...UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS.replies,
                              thread: {
                                ...UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS.replies
                                  .thread,
                                resolvedPost: post as UnifiedPost,
                                resolvedPostId: (post as UnifiedPost).id,
                              },
                            }
                          : undefined
                      }
                    />
                  ) : null
                }
              />
            )}
          </article>
        ))}
      </div>

      {hasMore && !isInitialHydrationPending && (
        <div className="p-4">
          <Button
            size="xs"
            className="mx-auto block"
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

  if (typeof p.createdAt === "number") {
    return p.createdAt;
  }

  if (typeof p.createdAt === "string") {
    const timestamp = Date.parse(p.createdAt);
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

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
  const twitterPostId = getTwitterPostId(post);
  if (twitterPostId) {
    return twitterPostId;
  }

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

function getPostKey(prospectId: string, post: unknown, index: number): string {
  const postId = getPostId(post);
  return postId
    ? `${prospectId}-${postId}-${index}`
    : `${prospectId}-relevant-activity-${index}`;
}

function dedupePosts(posts: unknown[]): unknown[] {
  const seen = new Set<string>();

  return posts.filter((post) => {
    const postId = getPostId(post);
    if (!postId) {
      return true;
    }
    if (seen.has(postId)) {
      return false;
    }
    seen.add(postId);
    return true;
  });
}
