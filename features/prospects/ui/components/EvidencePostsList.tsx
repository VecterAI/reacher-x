"use client";

import * as React from "react";
import { Tweet, TweetSkeleton } from "@/features/webapp/ui/components/tweet";
import {
  LinkedInCommentThread,
  LinkedInPostCard,
} from "@/features/webapp/ui/components/linkedin";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import type { Tweet as TweetType } from "@/features/threads/types";
import { summarizeTwitterPost } from "@/shared/lib/twitter/contracts";
import { toFallbackTweetFromSummary } from "@/shared/lib/twitter/ui";
import { UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS } from "@/features/prospects/lib/uiPreviewData";
import { cn } from "@/shared/lib/utils";

export interface EvidencePostsListProps {
  prospectId?: string;
  posts?: unknown[];
  platform?: "twitter" | "linkedin";
  readOnly?: boolean;
  maxItems?: number;
  className?: string;
}

export function EvidencePostsList({
  prospectId,
  posts = [],
  platform = "twitter",
  readOnly = false,
  maxItems,
  className,
}: EvidencePostsListProps) {
  const [openLinkedInPostId, setOpenLinkedInPostId] = React.useState<
    string | null
  >(null);
  const visiblePosts = React.useMemo(
    () => (typeof maxItems === "number" ? posts.slice(0, maxItems) : posts),
    [maxItems, posts]
  );
  const twitterPostIds = React.useMemo(
    () =>
      platform === "twitter"
        ? visiblePosts
            .map((post) => getPostId(post))
            .filter((postId): postId is string => Boolean(postId))
        : [],
    [platform, visiblePosts]
  );
  const { tweetsById, resultsById, isLoading, error } =
    useHydratedTwitterPosts(twitterPostIds);

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
          key={index}
          className={cn("px-4 pb-2", index === 0 ? "pt-4" : "pt-2")}
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
                    showThread={false}
                    readOnly={readOnly}
                  />
                );
              }

              if (isLoading || (postId && !resultsById[postId])) {
                return <TweetSkeleton showThread={false} />;
              }

              const summary = summarizeTwitterPost(post);
              if (summary) {
                return (
                  <Tweet
                    tweet={toFallbackTweetFromSummary(summary) as TweetType}
                    characterLimit={280}
                    showThread={false}
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
