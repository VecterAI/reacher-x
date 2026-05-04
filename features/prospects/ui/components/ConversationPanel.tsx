/**
 * ConversationPanel
 * Displays a full Twitter conversation (original tweet + all cross-user replies).
 * Uses SocialAPI `conversation_id` search operator to fetch the complete reply chain.
 * Opens as a sub-panel in the panel stack (like EvidencePostsPanel pattern).
 */
"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/shared/lib/utils";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { usePanelStack } from "../../contexts/PanelStackContext";
import { Tweet } from "@/features/webapp/ui/components/tweet";
import type { Tweet as TweetType } from "@/features/threads/types";
import type { TwitterPostSummary } from "@/shared/lib/twitter/contracts";
import { usePostEngagementMerge } from "@/shared/hooks/usePostEngagementMerge";
import { useTwitterTimelineEngagementMerge } from "@/shared/hooks/useTwitterTimelineEngagementMerge";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import { mergeLocalEngagementIntoTweet } from "@/shared/lib/twitter/mergeViewerState";
import { toFallbackTweetFromSummary } from "@/shared/lib/twitter/ui";

export interface ConversationPanelProps {
  /** Original tweet ID to fetch conversation for */
  threadId: string;
  /** Prospect ID for ownership validation */
  prospectId?: string;
  /** Original/source post ID for preserving interaction state */
  sourceTweetId?: string;
  /** Source tweet snapshot from the interaction list when available */
  sourceTweet?: TweetType | null;
  /** Source tweet fallback summary when SocialAPI omits it */
  sourceTweetSummary?: TwitterPostSummary | null;
  /** Reply tweet id to ensure the viewer's reply is shown */
  replyTweetId?: string;
  /** Reply tweet fallback summary when SocialAPI omits it */
  replyTweetSummary?: TwitterPostSummary | null;
  /** Whether the source tweet should display as commented/replied */
  overlayCommented?: boolean;
  /** Additional className */
  className?: string;
  onBack?: () => void;
}

function getTweetTimestamp(tweet: TweetType): number | null {
  if (!tweet.tweet_created_at) {
    return null;
  }
  const timestamp = Date.parse(tweet.tweet_created_at);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function dedupeAndSortConversationTweets(
  tweets: Array<TweetType | null | undefined>
): TweetType[] {
  const byId = new Map<string, { tweet: TweetType; order: number }>();
  let order = 0;

  for (const tweet of tweets) {
    const tweetId = tweet?.id_str;
    if (!tweetId) {
      continue;
    }

    const prior = byId.get(tweetId);
    byId.set(tweetId, {
      tweet,
      order: prior?.order ?? order,
    });
    order += 1;
  }

  return Array.from(byId.values())
    .sort((left, right) => {
      const leftTimestamp = getTweetTimestamp(left.tweet);
      const rightTimestamp = getTweetTimestamp(right.tweet);

      if (leftTimestamp != null && rightTimestamp != null) {
        if (leftTimestamp !== rightTimestamp) {
          return leftTimestamp - rightTimestamp;
        }
      } else if (leftTimestamp != null) {
        return -1;
      } else if (rightTimestamp != null) {
        return 1;
      }

      return left.order - right.order;
    })
    .map((entry) => entry.tweet);
}

export function ConversationPanel({
  threadId,
  prospectId: _prospectId,
  sourceTweetId,
  sourceTweet,
  sourceTweetSummary,
  replyTweetId,
  replyTweetSummary,
  overlayCommented = false,
  className,
  onBack,
}: ConversationPanelProps) {
  const { popPanel } = usePanelStack();
  const fetchConversation = useAction(api.socialapi.getDynamicThreadData);
  const fetchConversationRef = React.useRef(fetchConversation);
  const [isLoading, setIsLoading] = React.useState(true);
  const [tweets, setTweets] = React.useState<TweetType[]>([]);
  const [_error, setError] = React.useState<string | null>(null);
  const mergedTweets = useTwitterTimelineEngagementMerge(tweets);
  const normalizedReplyTweetId = React.useMemo(
    () => replyTweetId?.trim() || replyTweetSummary?.ref.postId || "",
    [replyTweetId, replyTweetSummary]
  );
  const { tweetsById: replyTweetsById } = useHydratedTwitterPosts(
    normalizedReplyTweetId ? [normalizedReplyTweetId] : []
  );

  const fallbackSourceTweet = React.useMemo(() => {
    if (sourceTweet?.id_str) {
      return sourceTweet;
    }
    return sourceTweetSummary
      ? toFallbackTweetFromSummary(sourceTweetSummary)
      : null;
  }, [sourceTweet, sourceTweetSummary]);

  const fallbackReplyTweet = React.useMemo(() => {
    return replyTweetSummary
      ? toFallbackTweetFromSummary(replyTweetSummary)
      : null;
  }, [replyTweetSummary]);
  const mergedFallbackSourceTweet = usePostEngagementMerge(fallbackSourceTweet);
  const mergedFallbackReplyTweet = usePostEngagementMerge(fallbackReplyTweet);

  const sourceTweetIdForDisplay =
    sourceTweetId ?? mergedFallbackSourceTweet?.id_str ?? threadId;
  const shouldOverlayCommented =
    overlayCommented || mergedFallbackSourceTweet?.viewerState?.commented === true;

  const conversationTweets = React.useMemo(() => {
    const supplementalReplyTweet =
      (normalizedReplyTweetId
        ? replyTweetsById[normalizedReplyTweetId]
        : null) ?? mergedFallbackReplyTweet;

    return dedupeAndSortConversationTweets([
      mergedFallbackSourceTweet,
      ...mergedTweets,
      supplementalReplyTweet,
    ]).map((tweet) => {
      if (
        !shouldOverlayCommented ||
        !sourceTweetIdForDisplay ||
        tweet.id_str !== sourceTweetIdForDisplay
      ) {
        return tweet;
      }

      return mergeLocalEngagementIntoTweet(tweet, {
        overlayCommented: true,
      });
    });
  }, [
    mergedFallbackReplyTweet,
    mergedFallbackSourceTweet,
    mergedTweets,
    normalizedReplyTweetId,
    replyTweetsById,
    shouldOverlayCommented,
    sourceTweetIdForDisplay,
  ]);

  React.useEffect(() => {
    fetchConversationRef.current = fetchConversation;
  }, [fetchConversation]);

  const loadConversation = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchConversationRef.current({
        threadId,
      });
      setTweets(result.tweets as TweetType[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load conversation"
      );
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  React.useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="flex h-full flex-col md:w-full">
        <PageHeader title="Conversation" onBack={onBack ?? popPanel} />
        <ScrollArea
          className="min-h-0 flex-1 overscroll-contain"
          viewportClassName="pb-6"
        >
          <PageContent className="pt-4">
            {isLoading ? (
              <ConversationSkeleton />
            ) : conversationTweets.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                Could not load conversation.
              </div>
            ) : (
              <section>
                {conversationTweets.map((tweet, index) => (
                  <article key={tweet.id_str} className="px-4">
                    <Tweet
                      tweet={tweet}
                      characterLimit={280}
                      showThread={index === conversationTweets.length - 1}
                    />
                  </article>
                ))}
              </section>
            )}
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}

function ConversationSkeleton() {
  return (
    <div className="divide-y">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-3 px-4 py-3">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-12 w-full" />
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
