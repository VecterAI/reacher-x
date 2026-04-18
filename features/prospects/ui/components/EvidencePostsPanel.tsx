/**
 * EvidencePostsPanel
 * Sub-panel that displays evidence posts for a pain point or finance source.
 * Uses panel stack navigation - back button returns to previous panel.
 */
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { usePanelStack } from "../../contexts/PanelStackContext";
import { Tweet } from "@/features/webapp/ui/components/tweet";
import { LinkedInPostCard } from "@/features/webapp/ui/components/linkedin";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import type { Tweet as TweetType } from "@/features/threads/types";
import { TweetSkeleton } from "@/features/webapp/ui/components/tweet";
import { summarizeTwitterPost } from "@/shared/lib/twitter/contracts";
import { toFallbackTweetFromSummary } from "@/shared/lib/twitter/ui";

export interface EvidencePostsPanelProps {
  prospectId?: string;
  /** Panel title */
  title?: string;
  /** Evidence posts to display */
  posts?: unknown[];
  /** Platform for rendering posts */
  platform?: "twitter" | "linkedin";
  /** Additional className */
  className?: string;
  onBack?: () => void;
  readOnly?: boolean;
  onOpenLinkedInCommentComposer?: (post: UnifiedPost) => void;
}

export function EvidencePostsPanel({
  prospectId,
  title = "Evidence",
  posts = [],
  platform = "twitter",
  className,
  onBack,
  readOnly = false,
  onOpenLinkedInCommentComposer,
}: EvidencePostsPanelProps) {
  const { popPanel } = usePanelStack();
  const twitterPostIds = React.useMemo(
    () =>
      platform === "twitter"
        ? posts
            .map((post) => getPostId(post))
            .filter((postId): postId is string => Boolean(postId))
        : [],
    [platform, posts]
  );
  const { tweetsById, resultsById, isLoading, error } =
    useHydratedTwitterPosts(twitterPostIds);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="flex h-full flex-col md:w-full">
        <PageHeader title={title} onBack={onBack ?? popPanel} />
        <ScrollArea
          className="min-h-0 flex-1 overscroll-contain"
          viewportClassName="pb-6"
        >
          <PageContent>
            {posts.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No evidence posts found.
              </div>
            ) : (
              <div className="divide-y">
                {posts.map((post, index) => (
                  <div key={index} className="px-4 py-2">
                    {platform === "twitter" ? (
                      (() => {
                        const postId = getPostId(post);
                        const hydratedTweet = postId
                          ? tweetsById[postId]
                          : undefined;
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
                        readOnly={readOnly && !onOpenLinkedInCommentComposer}
                        showMenu={false}
                        previewMode={Boolean(onOpenLinkedInCommentComposer)}
                        onPreviewComment={onOpenLinkedInCommentComposer}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
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
