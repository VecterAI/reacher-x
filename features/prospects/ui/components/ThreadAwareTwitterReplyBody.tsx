"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Tweet } from "@/features/webapp/ui/components/tweet";
import type { Tweet as TweetType } from "@/features/threads/types";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import { dedupeAndSortConversationTweets } from "@/features/prospects/lib/twitterConversation";
import { mergeLocalEngagementIntoTweet } from "@/shared/lib/twitter/mergeViewerState";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";

export interface ThreadAwareTwitterReplyBodyProps {
  tweetId: string;
  threadId?: string;
  initialTweet?: TweetType | null;
  overlayCommented?: boolean;
  renderComposerSection: (tweet: TweetType) => React.ReactNode;
}

export function ThreadAwareTwitterReplyBody({
  tweetId,
  threadId,
  initialTweet,
  overlayCommented = false,
  renderComposerSection,
}: ThreadAwareTwitterReplyBodyProps) {
  const fetchConversation = useAction(api.socialapi.getConversationContext);
  const fetchConversationRef = React.useRef(fetchConversation);
  const focusedTweetRef = React.useRef<HTMLElement | null>(null);
  const pendingAnchorRestoreRef = React.useRef<{
    viewport: HTMLElement;
    previousTop: number;
  } | null>(null);
  const { tweetsById, resultsById, isLoading: isHydratingTweet } =
    useHydratedTwitterPosts(tweetId ? [tweetId] : []);
  const [conversationTweets, setConversationTweets] = React.useState<TweetType[]>(
    []
  );
  const [nextRepliesCursor, setNextRepliesCursor] = React.useState<string | null>(
    null
  );
  const [isLoadingConversation, setIsLoadingConversation] = React.useState(false);
  const [conversationError, setConversationError] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    fetchConversationRef.current = fetchConversation;
  }, [fetchConversation]);

  const displayTweet = React.useMemo(() => {
    const baseTweet = tweetsById[tweetId] ?? initialTweet ?? null;
    if (!baseTweet) {
      return null;
    }

    if (!overlayCommented) {
      return baseTweet;
    }

    return mergeLocalEngagementIntoTweet(baseTweet, {
      overlayCommented: true,
    });
  }, [initialTweet, overlayCommented, tweetId, tweetsById]);

  const baseTweet = displayTweet ?? initialTweet ?? null;
  const tweetLoading =
    !displayTweet && (isHydratingTweet || (!resultsById[tweetId] && !baseTweet));
  const tweetError =
    resultsById[tweetId]?.status === "not_found"
      ? (resultsById[tweetId]?.message ?? "This post is no longer available.")
      : null;
  const rootTweetId =
    baseTweet?.conversation_id_str?.trim() ||
    threadId?.trim() ||
    tweetId.trim() ||
    undefined;
  const matchedReplyTweetId =
    baseTweet?.in_reply_to_status_id_str ||
    (rootTweetId && rootTweetId !== tweetId ? tweetId : undefined);

  React.useEffect(() => {
    pendingAnchorRestoreRef.current = null;
  }, [tweetId, rootTweetId]);

  const loadConversation = React.useCallback(
    async (cursor?: string | null) => {
      if (!rootTweetId) {
        return;
      }

      setConversationError(null);
      setIsLoadingConversation(true);
      try {
        if (!cursor && focusedTweetRef.current) {
          const viewport = focusedTweetRef.current.closest(
            "[data-radix-scroll-area-viewport]"
          );
          if (viewport instanceof HTMLElement) {
            pendingAnchorRestoreRef.current = {
              viewport,
              previousTop: focusedTweetRef.current.getBoundingClientRect().top,
            };
          }
        }

        const result = await fetchConversationRef.current({
          rootTweetId,
          repliesCursor: cursor ?? undefined,
          matchedReplyTweetId,
        });
        const incomingTweets = (((result.tweets as TweetType[]) ?? []).filter(
          Boolean
        ) as TweetType[]).filter((conversationTweet) =>
          Boolean(conversationTweet?.id_str)
        );

        setConversationTweets((current) =>
          dedupeAndSortConversationTweets([
            ...(cursor ? current : []),
            ...incomingTweets,
            baseTweet,
          ])
        );
        setNextRepliesCursor(result.repliesCursor ?? null);
      } catch (error) {
        setConversationError(
          error instanceof Error ? error.message : "Failed to load conversation"
        );
      } finally {
        setIsLoadingConversation(false);
      }
    },
    [baseTweet, matchedReplyTweetId, rootTweetId]
  );

  React.useEffect(() => {
    if (!baseTweet || !rootTweetId) {
      return;
    }

    void loadConversation(null);
  }, [baseTweet, loadConversation, rootTweetId]);

  React.useLayoutEffect(() => {
    const pendingAnchor = pendingAnchorRestoreRef.current;
    if (!pendingAnchor || !focusedTweetRef.current) {
      return;
    }

    const nextTop = focusedTweetRef.current.getBoundingClientRect().top;
    pendingAnchor.viewport.scrollTop += nextTop - pendingAnchor.previousTop;
    pendingAnchorRestoreRef.current = null;
  }, [conversationTweets]);

  const orderedConversationTweets = React.useMemo(
    () =>
      dedupeAndSortConversationTweets([...conversationTweets, baseTweet]).map(
        (conversationTweet) => {
          if (!overlayCommented || conversationTweet.id_str !== tweetId) {
            return conversationTweet;
          }

          return mergeLocalEngagementIntoTweet(conversationTweet, {
            overlayCommented: true,
          });
        }
      ),
    [baseTweet, conversationTweets, overlayCommented, tweetId]
  );

  const focusedTweetIndex = React.useMemo(
    () =>
      orderedConversationTweets.findIndex(
        (conversationTweet) => conversationTweet.id_str === tweetId
      ),
    [orderedConversationTweets, tweetId]
  );

  const timelineBeforeComposer = React.useMemo(() => {
    if (focusedTweetIndex < 0) {
      return displayTweet ? [displayTweet] : [];
    }

    return orderedConversationTweets.slice(0, focusedTweetIndex + 1);
  }, [displayTweet, focusedTweetIndex, orderedConversationTweets]);

  const timelineAfterComposer = React.useMemo(() => {
    if (focusedTweetIndex < 0) {
      return [];
    }

    return orderedConversationTweets.slice(focusedTweetIndex + 1);
  }, [focusedTweetIndex, orderedConversationTweets]);

  const isInitialConversationLoading =
    isLoadingConversation && conversationTweets.length === 0;

  if (tweetLoading) {
    return (
      <div className="mx-4 space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!displayTweet) {
    return (
      <div className="text-muted-foreground mx-4 text-sm">
        {tweetError || "Unable to load this post."}
      </div>
    );
  }

  return (
    <>
      <div className="mx-4 mb-0">
        {isInitialConversationLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <section className="space-y-0">
            {timelineBeforeComposer.map((conversationTweet) => (
              <article
                key={conversationTweet.id_str}
                ref={
                  conversationTweet.id_str === tweetId
                    ? focusedTweetRef
                    : undefined
                }
              >
                <Tweet
                  tweet={conversationTweet}
                  showFullContent={conversationTweet.id_str === tweetId}
                  showThread={false}
                />
              </article>
            ))}
            {conversationError ? (
              <p className="text-muted-foreground mt-2 text-sm">
                {conversationError}
              </p>
            ) : null}
          </section>
        )}
      </div>

      {renderComposerSection(displayTweet)}

      {timelineAfterComposer.length > 0 ? (
        <div className="divide-y">
          {timelineAfterComposer.map((conversationTweet) => (
            <article
              key={conversationTweet.id_str}
              className="px-4 pt-4 pb-2"
            >
              <Tweet tweet={conversationTweet} showThread={true} />
            </article>
          ))}
        </div>
      ) : null}

      {nextRepliesCursor ? (
        <div className="px-4 pt-2">
          <Button
            size="xs"
            className="w-full"
            onClick={() => void loadConversation(nextRepliesCursor)}
            disabled={isLoadingConversation}
          >
            {isLoadingConversation ? (
              <AsciiSpinnerText text="Loading" />
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      ) : null}
    </>
  );
}
