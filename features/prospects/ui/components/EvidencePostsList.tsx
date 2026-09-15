"use client";

import * as React from "react";
import { Tweet, TweetSkeleton } from "@/features/webapp/ui/components/tweet";
import {
  LinkedInCommentThread,
  LinkedInPostCard,
} from "@/features/webapp/ui/components/linkedin";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import { useTwitterTimelineEngagementMerge } from "@/shared/hooks/useTwitterTimelineEngagementMerge";
import { useLinkedInPostEngagementMerge } from "@/shared/hooks/useLinkedInPostEngagementMerge";
import type { Tweet as TweetType } from "@/features/threads/types";
import {
  getTwitterPostId,
  summarizeTwitterPost,
} from "@/shared/lib/twitter/contracts";
import { toFallbackTweetFromSummary } from "@/shared/lib/twitter/ui";
import { UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS } from "@/features/prospects/lib/uiPreviewData";
import { cn } from "@/shared/lib/utils";
import { normalizeLinkedInPost } from "@/shared/lib/linkedin/post";
import { shouldIgnorePostCardClick } from "@/features/webapp/lib/postNavigation";

const EMPTY_POSTS: unknown[] = [];

export interface EvidencePostsListProps {
  prospectId?: string;
  posts?: unknown[];
  platform?: "twitter" | "linkedin";
  readOnly?: boolean;
  /** Render supplied fixtures without hydration or engagement requests. */
  offline?: boolean;
  maxItems?: number;
  compact?: boolean;
  onPostSelect?: (post: unknown) => void;
  className?: string;
}

export function EvidencePostsList({
  prospectId,
  posts = EMPTY_POSTS,
  platform = "twitter",
  readOnly = false,
  offline = false,
  maxItems,
  compact = false,
  onPostSelect,
  className,
}: EvidencePostsListProps) {
  const [openLinkedInPostId, setOpenLinkedInPostId] = React.useState<
    string | null
  >(null);
  const normalizedPosts = React.useMemo(
    () =>
      platform === "linkedin"
        ? posts.map((post) => normalizeLinkedInPost(post) ?? post)
        : posts,
    [platform, posts]
  );
  const dedupedPosts = React.useMemo(
    () => dedupePosts(normalizedPosts),
    [normalizedPosts]
  );
  const visiblePosts = React.useMemo(
    () =>
      typeof maxItems === "number"
        ? dedupedPosts.slice(0, maxItems)
        : dedupedPosts,
    [dedupedPosts, maxItems]
  );
  const twitterPostIds = React.useMemo(() => {
    if (platform !== "twitter") {
      return [];
    }

    const postIds: string[] = [];
    for (const post of visiblePosts) {
      const postId = getPostId(post);
      if (postId) {
        postIds.push(postId);
      }
    }
    return postIds;
  }, [platform, visiblePosts]);
  const { tweetsById, resultsById, error } = useHydratedTwitterPosts(
    offline ? [] : twitterPostIds
  );
  const fallbackTweets = useTwitterTimelineEngagementMerge(
    React.useMemo(() => {
      if (platform !== "twitter") {
        return [];
      }

      const tweets: TweetType[] = [];
      for (const post of visiblePosts) {
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
    }, [platform, visiblePosts]),
    !offline
  );
  const fallbackTweetsById = React.useMemo(() => {
    const tweetsById: Record<string, TweetType> = {};
    for (const tweet of fallbackTweets) {
      if (tweet.id_str) {
        tweetsById[tweet.id_str] = tweet;
      }
    }
    return tweetsById;
  }, [fallbackTweets]);
  const linkedInPosts = useLinkedInPostEngagementMerge(
    React.useMemo(() => {
      if (platform !== "linkedin") {
        return [];
      }
      return visiblePosts.filter(
        (post): post is UnifiedPost =>
          Boolean(post) &&
          typeof post === "object" &&
          (post as UnifiedPost).platform === "linkedin"
      );
    }, [platform, visiblePosts]),
    !offline
  );
  const linkedInPostsById = React.useMemo(() => {
    const postsById: Record<string, UnifiedPost> = {};
    for (const post of linkedInPosts) {
      if (post.id) {
        postsById[post.id] = post;
      }
    }
    return postsById;
  }, [linkedInPosts]);
  const characterLimit = compact ? 180 : 280;
  const linkedInCharacterLimit = compact ? 180 : 300;
  const bodyLineClamp = compact ? 3 : undefined;
  const showPostActions = !compact;

  if (visiblePosts.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No evidence posts found.
      </div>
    );
  }

  return (
    <div className={cn("divide-y", className)}>
      {visiblePosts.map((post, index) => (
        <div
          key={getPostKey(prospectId, post, index)}
          className={cn(
            "px-4 pb-2",
            index === 0 ? "pt-4" : "pt-2",
            onPostSelect &&
              "cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-950"
          )}
          role={platform === "twitter" && onPostSelect ? "button" : undefined}
          tabIndex={platform === "twitter" && onPostSelect ? 0 : undefined}
          onClick={
            platform === "twitter" && onPostSelect
              ? (event) => {
                  if (shouldIgnorePostCardClick(event)) {
                    return;
                  }
                  const postId = getPostId(post);
                  onPostSelect(
                    (postId &&
                      (tweetsById[postId] ?? fallbackTweetsById[postId])) ||
                      post
                  );
                }
              : undefined
          }
          onKeyDown={
            platform === "twitter" && onPostSelect
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    const postId = getPostId(post);
                    onPostSelect(
                      (postId &&
                        (tweetsById[postId] ?? fallbackTweetsById[postId])) ||
                        post
                    );
                  }
                }
              : undefined
          }
        >
          {platform === "twitter" ? (
            (() => {
              const postId = getPostId(post);
              const hydratedTweet = postId ? tweetsById[postId] : undefined;
              const fallbackTweet = postId
                ? fallbackTweetsById[postId]
                : undefined;
              const hydrationResult = postId ? resultsById[postId] : undefined;
              const isPostPending = !hydratedTweet && !hydrationResult;
              if (hydratedTweet) {
                return (
                  <Tweet
                    tweet={hydratedTweet as TweetType}
                    characterLimit={characterLimit}
                    showThread={false}
                    hideThreadLine
                    readOnly={readOnly}
                    bodyLineClamp={bodyLineClamp}
                    showOpenGraphPreview
                    showMenu={showPostActions ? undefined : false}
                    showFooter={showPostActions}
                    interactiveCursor={Boolean(onPostSelect)}
                    openBehavior={offline || onPostSelect ? "none" : "auto"}
                  />
                );
              }

              if (fallbackTweet) {
                return (
                  <Tweet
                    tweet={fallbackTweet}
                    characterLimit={characterLimit}
                    showThread={false}
                    hideThreadLine
                    readOnly={readOnly}
                    bodyLineClamp={bodyLineClamp}
                    showOpenGraphPreview
                    showMenu={showPostActions ? undefined : false}
                    showFooter={showPostActions}
                    interactiveCursor={Boolean(onPostSelect)}
                    openBehavior={offline || onPostSelect ? "none" : "auto"}
                  />
                );
              }

              if (isPostPending) {
                return <TweetSkeleton showThread={false} hideThreadLine />;
              }

              return (
                <div className="text-muted-foreground text-sm">
                  {error || "Could not load this post right now."}
                </div>
              );
            })()
          ) : (
            <LinkedInPostCard
              post={
                linkedInPostsById[(post as UnifiedPost).id] ??
                (post as UnifiedPost)
              }
              prospectId={prospectId}
              characterLimit={linkedInCharacterLimit}
              readOnly={readOnly}
              showMenu={showPostActions ? undefined : false}
              showFooter={showPostActions}
              onClick={
                onPostSelect
                  ? () =>
                      onPostSelect(
                        linkedInPostsById[(post as UnifiedPost).id] ??
                          (post as UnifiedPost)
                      )
                  : undefined
              }
              interactiveCursor={Boolean(onPostSelect)}
              openBehavior={offline || onPostSelect ? "none" : "auto"}
              disableExternalNavigation={
                (readOnly && platform === "linkedin") || Boolean(onPostSelect)
              }
              commentBehavior={compact ? "none" : "open_thread"}
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
                            ...UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS.multiple,
                            thread: {
                              ...UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS.multiple
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
        </div>
      ))}
    </div>
  );
}

function getPostId(post: unknown): string | undefined {
  const twitterPostId = getTwitterPostId(post);
  if (twitterPostId) {
    return twitterPostId;
  }

  const p = post as Record<string, unknown>;

  if (typeof p.id_str === "string") {
    return p.id_str;
  }

  if (typeof p.postID === "string") {
    return p.postID;
  }

  if (typeof p.id === "string") {
    return p.id;
  }

  if (typeof p.id === "number") {
    return String(p.id);
  }

  return undefined;
}

function getPostKey(
  prospectId: string | undefined,
  post: unknown,
  index: number
): string {
  const postId = getPostId(post);
  return postId
    ? `${prospectId ?? "evidence"}-${postId}-${index}`
    : `${prospectId ?? "evidence"}-post-${index}`;
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
