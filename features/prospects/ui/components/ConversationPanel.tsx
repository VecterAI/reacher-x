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
import { InfiniteScrollTrigger } from "@/shared/ui/components/InfiniteScrollTrigger";
import { usePanelStack } from "../../contexts/PanelStackContext";
import { Tweet, TweetSkeleton } from "@/features/webapp/ui/components/tweet";
import type { Tweet as TweetType } from "@/features/threads/types";
import type { TwitterPostSummary } from "@/shared/lib/twitter/contracts";
import { useTwitterTimelineEngagementMerge } from "@/shared/hooks/useTwitterTimelineEngagementMerge";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import { mergeLocalEngagementIntoTweet } from "@/shared/lib/twitter/mergeViewerState";
import { toFallbackTweetFromSummary } from "@/shared/lib/twitter/ui";
import {
  dedupeAndSortConversationTweets,
  hasRenderableTweetContent,
  mergeConversationTweetsPreservingOrder,
} from "@/features/prospects/lib/twitterConversation";

const EMPTY_FALLBACK_TWEETS: TweetType[] = [];

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
  /** Durable snapshots for every known post in this interaction thread */
  fallbackTweets?: TweetType[];
  /** Whether the source tweet should display as commented/replied */
  overlayCommented?: boolean;
  /** Additional className */
  className?: string;
  onBack?: () => void;
}

export function ConversationPanel({
  threadId,
  prospectId: _prospectId,
  sourceTweetId,
  sourceTweet,
  sourceTweetSummary,
  replyTweetId,
  replyTweetSummary,
  fallbackTweets = EMPTY_FALLBACK_TWEETS,
  overlayCommented = false,
  className,
  onBack,
}: ConversationPanelProps) {
  const { popPanel } = usePanelStack();
  const fetchConversation = useAction(api.socialapi.getDynamicThreadData);
  const fetchConversationRef = React.useRef(fetchConversation);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [tweets, setTweets] = React.useState<TweetType[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [nextRepliesCursor, setNextRepliesCursor] = React.useState<
    string | null
  >(null);
  const mergedTweets = useTwitterTimelineEngagementMerge(tweets);
  const durableFallbackTweets = React.useMemo(
    () =>
      dedupeAndSortConversationTweets([
        sourceTweet,
        sourceTweetSummary
          ? toFallbackTweetFromSummary(sourceTweetSummary)
          : null,
        ...fallbackTweets,
        replyTweetSummary
          ? toFallbackTweetFromSummary(replyTweetSummary)
          : null,
      ]),
    [fallbackTweets, replyTweetSummary, sourceTweet, sourceTweetSummary]
  );
  const fallbackTweetIds = React.useMemo(
    () =>
      Array.from(
        new Set([
          ...durableFallbackTweets.map((tweet) => tweet.id_str),
          replyTweetId?.trim(),
        ])
      ).filter((tweetId): tweetId is string => Boolean(tweetId)),
    [durableFallbackTweets, replyTweetId]
  );
  const { tweetsById: hydratedFallbackTweetsById } =
    useHydratedTwitterPosts(fallbackTweetIds);
  const hydratedFallbackTweets = React.useMemo(
    () =>
      mergeConversationTweetsPreservingOrder(
        durableFallbackTweets,
        fallbackTweetIds.map((tweetId) => hydratedFallbackTweetsById[tweetId])
      ),
    [durableFallbackTweets, fallbackTweetIds, hydratedFallbackTweetsById]
  );
  const mergedFallbackTweets = useTwitterTimelineEngagementMerge(
    hydratedFallbackTweets
  );

  const sourceTweetIdForDisplay =
    sourceTweetId ?? mergedFallbackTweets[0]?.id_str ?? threadId;
  const shouldOverlayCommented =
    overlayCommented ||
    mergedFallbackTweets.some((tweet) => tweet.viewerState?.commented === true);

  const conversationTweets = React.useMemo(() => {
    return mergeConversationTweetsPreservingOrder(
      mergedFallbackTweets,
      mergedTweets
    ).map((tweet) => {
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
    mergedFallbackTweets,
    mergedTweets,
    shouldOverlayCommented,
    sourceTweetIdForDisplay,
  ]);

  React.useEffect(() => {
    fetchConversationRef.current = fetchConversation;
  }, [fetchConversation]);

  const loadConversation = React.useCallback(
    async (cursor?: string | null) => {
      const isInitialLoad = !cursor;
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      setError(null);
      try {
        const result = await fetchConversationRef.current({
          threadId,
          repliesCursor: cursor ?? undefined,
        });
        setTweets((currentTweets) =>
          isInitialLoad
            ? (result.tweets as TweetType[])
            : dedupeAndSortConversationTweets([
                ...currentTweets,
                ...(result.tweets as TweetType[]),
              ])
        );
        setNextRepliesCursor(result.repliesCursor ?? null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load conversation"
        );
      } finally {
        if (isInitialLoad) {
          setIsLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    [threadId]
  );

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
            {isLoading && conversationTweets.length === 0 ? (
              <ConversationSkeleton />
            ) : conversationTweets.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                Could not load conversation.
              </div>
            ) : (
              <section>
                {conversationTweets.map((tweet, index) => (
                  <article key={tweet.id_str} className="px-4">
                    {hasRenderableTweetContent(tweet) ? (
                      <Tweet
                        tweet={tweet}
                        characterLimit={280}
                        showThread={index === conversationTweets.length - 1}
                      />
                    ) : (
                      <TweetSkeleton
                        showThread={index === conversationTweets.length - 1}
                      />
                    )}
                  </article>
                ))}
                <InfiniteScrollTrigger
                  hasMore={Boolean(nextRepliesCursor)}
                  isLoading={isLoadingMore}
                  loadMoreError={Boolean(
                    nextRepliesCursor && error && !isLoadingMore
                  )}
                  onLoadMore={() => {
                    if (nextRepliesCursor) {
                      void loadConversation(nextRepliesCursor);
                    }
                  }}
                  resultCount={conversationTweets.length}
                  loadingLabel="Loading more replies"
                  loadMoreLabel="Load more replies"
                  retryLabel="Retry loading replies"
                />
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
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="px-4 py-3">
          <TweetSkeleton showThread={item === 4} />
        </div>
      ))}
    </div>
  );
}
