/**
 * YourInteractionsTab
 * Displays conversation interactions between the viewer and the prospect.
 * Reads durable rows first, then refreshes discovery in the background.
 */
"use client";

import * as React from "react";
import { useAction, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/shared/ui/components/Button";
import { InfiniteScrollTrigger } from "@/shared/ui/components/InfiniteScrollTrigger";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Tweet, TweetSkeleton } from "@/features/webapp/ui/components/tweet";
import {
  LinkedInPostCard,
  type LinkedInCommentThreadPreviewScenario,
} from "@/features/webapp/ui/components/linkedin";
import { AvatarStack } from "@/shared/ui/components/AvatarStack";
import { usePanelStack } from "../../../contexts/PanelStackContext";
import type { ProspectInteraction } from "@/features/prospects/types";
import { mergeLocalEngagementIntoTweet } from "@/shared/lib/twitter/mergeViewerState";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { UnavailableInteractionCard } from "./UnavailableInteractionCard";
import { UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS } from "@/features/prospects/lib/uiPreviewData";
import { normalizeLinkedInPost } from "@/shared/lib/linkedin/post";
import type { Tweet as TweetType } from "@/features/threads/types";
import {
  buildTwitterInteractionThreadFallbackTweets,
  getLinkedInThreadCommentIds,
  groupProspectInteractionsByThread,
  type ProspectInteractionThread,
} from "@/features/prospects/lib/prospectInteractionThreads";
import {
  hasRenderableTweetContent,
  mergeConversationTweetWithFallback,
} from "@/features/prospects/lib/twitterConversation";

const INITIAL_PAGE_SIZE = 10;

export interface YourInteractionsTabProps {
  prospectId: string;
  platform: "twitter" | "linkedin";
  readOnly?: boolean;
  syncEnabled?: boolean;
  previewInteractions?: ProspectInteraction[];
}

export function YourInteractionsTab({
  prospectId,
  platform,
  readOnly = false,
  syncEnabled = false,
  previewInteractions,
}: YourInteractionsTabProps) {
  const { pushPanel } = usePanelStack();
  const markedUnavailableRef = React.useRef<Set<string>>(new Set());
  const activeSyncRef = React.useRef<string | null>(null);
  const syncRequestIdRef = React.useRef(0);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string>();
  const isPreview = Array.isArray(previewInteractions);
  const refreshProspectInteractions = useAction(
    api.interactionsActions.refreshProspectInteractions
  );

  const interactionsQuery = usePaginatedQuery(
    api.interactions.getProspectInteractionsPage,
    isPreview
      ? "skip"
      : {
          prospectId: prospectId as Id<"prospects">,
        },
    { initialNumItems: INITIAL_PAGE_SIZE }
  );
  const markInteractionUnavailable = useMutation(
    api.interactions.markInteractionUnavailable
  );

  React.useEffect(() => {
    if (!syncEnabled || readOnly || isPreview) {
      syncRequestIdRef.current += 1;
      setIsSyncing(false);
      setSyncError(undefined);
      return;
    }
    const syncKey = `${platform}:${prospectId}`;
    if (activeSyncRef.current === syncKey) {
      return;
    }

    const requestId = syncRequestIdRef.current + 1;
    syncRequestIdRef.current = requestId;
    activeSyncRef.current = syncKey;
    setIsSyncing(true);
    setSyncError(undefined);
    void refreshProspectInteractions({
      prospectId: prospectId as Id<"prospects">,
      force: true,
    })
      .then((result) => {
        if (result.skipped && activeSyncRef.current === syncKey) {
          activeSyncRef.current = null;
        }
        if (syncRequestIdRef.current === requestId && result.skipped) {
          setSyncError(
            `Connect ${platform === "twitter" ? "X" : "LinkedIn"} to sync interactions.`
          );
        }
      })
      .catch((error: unknown) => {
        if (activeSyncRef.current === syncKey) {
          activeSyncRef.current = null;
        }
        if (syncRequestIdRef.current === requestId) {
          setSyncError(
            error instanceof Error
              ? error.message
              : "Could not sync interactions right now."
          );
        }
      })
      .finally(() => {
        if (syncRequestIdRef.current === requestId) {
          setIsSyncing(false);
        }
      });
  }, [
    isPreview,
    platform,
    prospectId,
    readOnly,
    refreshProspectInteractions,
    syncEnabled,
  ]);

  const interactions = React.useMemo(
    () =>
      isPreview
        ? previewInteractions
        : (interactionsQuery.results as ProspectInteraction[]),
    [interactionsQuery.results, isPreview, previewInteractions]
  );

  const interactionThreads = React.useMemo(
    () => groupProspectInteractionsByThread(interactions, platform),
    [interactions, platform]
  );

  const visibleTwitterPostIds = React.useMemo(
    () =>
      platform === "twitter"
        ? interactionThreads.map((thread) => thread.threadId)
        : [],
    [interactionThreads, platform]
  );

  const {
    tweetsById,
    resultsById,
    isLoading: isHydratingTweets,
    error: hydrateError,
  } = useHydratedTwitterPosts(visibleTwitterPostIds);

  React.useEffect(() => {
    if (
      platform !== "twitter" ||
      isHydratingTweets ||
      hydrateError ||
      visibleTwitterPostIds.length === 0
    ) {
      return;
    }

    const missingInteractionIds: string[] = [];
    for (const thread of interactionThreads) {
      const interactionId = thread.representative.id;
      if (
        thread.representative.status === "active" &&
        resultsById[thread.threadId]?.status === "not_found" &&
        !markedUnavailableRef.current.has(interactionId)
      ) {
        missingInteractionIds.push(interactionId);
      }
    }

    if (missingInteractionIds.length === 0) {
      return;
    }

    for (const interactionId of missingInteractionIds) {
      markedUnavailableRef.current.add(interactionId);
      void markInteractionUnavailable({
        interactionId: interactionId as Id<"prospectInteractions">,
        status: "missing",
        lastHydrationErrorMessage: "This post is no longer available.",
      }).catch(() => {
        markedUnavailableRef.current.delete(interactionId);
      });
    }
  }, [
    hydrateError,
    interactionThreads,
    isHydratingTweets,
    markInteractionUnavailable,
    platform,
    resultsById,
    visibleTwitterPostIds,
  ]);

  const handleShowConversation = (
    thread: ProspectInteractionThread,
    sourceTweet: TweetType | null
  ) => {
    const fallbackTweets = buildTwitterInteractionThreadFallbackTweets(thread);
    pushPanel("conversation", {
      threadId: thread.threadId,
      sourceTweetId: thread.threadId,
      sourceTweet,
      fallbackTweets,
      overlayCommented: true,
    });
  };

  const handleOpenLinkedInThread = React.useCallback(
    (thread: ProspectInteractionThread, post: UnifiedPost) => {
      pushPanel("linkedin-post-thread", {
        post,
        initialSort: "MOST_RECENT",
        autoExpandCommentIds: getLinkedInThreadCommentIds(thread),
        previewScenario: isPreview
          ? buildLinkedInInteractionPreviewScenario(
              post,
              thread.representative.replyText
            )
          : undefined,
      });
    },
    [isPreview, pushPanel]
  );

  const showInitialSkeleton =
    !isPreview &&
    interactionsQuery.status === "LoadingFirstPage" &&
    interactions.length === 0;
  const canLoadMore =
    !isPreview &&
    (interactionsQuery.status === "CanLoadMore" ||
      interactionsQuery.status === "LoadingMore");
  const isLoadingMore =
    !isPreview && interactionsQuery.status === "LoadingMore";

  if (showInitialSkeleton) {
    return <YourInteractionsTabSkeleton />;
  }

  return (
    <section className="space-y-4 pb-4">
      {interactionThreads.length === 0 ? (
        <div className="text-muted-foreground px-4 py-8 text-center text-sm">
          {syncError ??
            (isSyncing
              ? "Syncing latest interactions…"
              : "No public interactions found with this prospect.")}
        </div>
      ) : (
        <div className="divide-y">
          {interactionThreads.map((thread) => {
            const interaction = thread.representative;
            if (platform === "linkedin") {
              const linkedinPost = normalizeLinkedInPost(
                interaction.sourcePostData,
                { fallbackUrl: interaction.sourceUrl }
              );

              return (
                <article key={thread.id} className="space-y-3 p-4">
                  {linkedinPost ? (
                    <LinkedInPostCard
                      post={linkedinPost}
                      prospectId={prospectId}
                      characterLimit={300}
                      readOnly={readOnly}
                      commentBehavior="none"
                      disableExternalNavigation
                      onClick={() =>
                        handleOpenLinkedInThread(thread, linkedinPost)
                      }
                    />
                  ) : (
                    <UnavailableInteractionCard
                      message={
                        interaction.lastHydrationErrorMessage ||
                        "Could not load this LinkedIn post right now."
                      }
                    />
                  )}

                  <footer className="flex flex-wrap items-center gap-2 pl-1">
                    <AvatarStack
                      participants={thread.participants.map((participant) => ({
                        name: participant.name,
                        avatarUrl: participant.avatarUrl,
                      }))}
                      maxVisible={5}
                      size="sm"
                    />

                    {linkedinPost ? (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          handleOpenLinkedInThread(thread, linkedinPost)
                        }
                      >
                        Open thread
                      </Button>
                    ) : null}
                  </footer>
                </article>
              );
            }

            const fallbackTweets =
              buildTwitterInteractionThreadFallbackTweets(thread);
            const fallbackRootTweet =
              fallbackTweets.find(
                (tweet) => tweet.id_str === thread.threadId
              ) ??
              fallbackTweets[0] ??
              null;
            const postId = thread.threadId;
            const hydratedTweet = postId ? tweetsById[postId] : undefined;
            const isUnavailable = thread.interactions.every(
              (item) => item.status !== "active"
            );
            const hydrationResult = postId ? resultsById[postId] : undefined;
            const hydrationSettled = Boolean(hydrationResult || hydrateError);
            const resolvedTweet = mergeConversationTweetWithFallback(
              fallbackRootTweet,
              hydratedTweet
            );
            const displayTweet =
              resolvedTweet && hasRenderableTweetContent(resolvedTweet)
                ? mergeLocalEngagementIntoTweet(resolvedTweet, {
                    overlayCommented: true,
                  })
                : null;
            const shouldShowSkeleton =
              !displayTweet &&
              !isUnavailable &&
              (isHydratingTweets || !hydrationSettled);

            return (
              <article key={thread.id} className="space-y-3 p-4">
                {isUnavailable ? (
                  <UnavailableInteractionCard
                    message={
                      interaction.lastHydrationErrorMessage ||
                      "This post is no longer available."
                    }
                  />
                ) : displayTweet ? (
                  <Tweet
                    tweet={displayTweet}
                    characterLimit={280}
                    showThread={false}
                    readOnly={readOnly}
                  />
                ) : shouldShowSkeleton ? (
                  <TweetSkeleton showThread={false} />
                ) : (
                  <UnavailableInteractionCard
                    message={
                      hydrationResult?.message ??
                      hydrateError ??
                      "Could not load this post right now."
                    }
                  />
                )}

                <footer className="flex flex-wrap items-center gap-2 pl-1">
                  <AvatarStack
                    participants={thread.participants.map((participant) => ({
                      name: participant.name,
                      avatarUrl: participant.avatarUrl,
                    }))}
                    maxVisible={5}
                    size="sm"
                  />

                  <Button
                    variant="outline"
                    size="xs"
                    disabled={readOnly}
                    onClick={() =>
                      handleShowConversation(
                        thread,
                        displayTweet ?? fallbackRootTweet
                      )
                    }
                  >
                    {readOnly
                      ? "Conversation unavailable in setup"
                      : "Show conversation"}
                  </Button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {isSyncing && interactions.length > 0 ? (
        <p className="text-muted-foreground px-4 text-xs" role="status">
          Syncing latest interactions…
        </p>
      ) : null}

      {syncError && interactions.length > 0 ? (
        <p className="text-destructive px-4 text-xs" role="alert">
          {syncError}
        </p>
      ) : null}

      {!isPreview ? (
        <InfiniteScrollTrigger
          hasMore={canLoadMore}
          isLoading={isLoadingMore}
          onLoadMore={() => interactionsQuery.loadMore(INITIAL_PAGE_SIZE)}
          resultCount={interactionThreads.length}
          className="mx-4"
          loadingLabel="Loading more interactions"
          loadMoreLabel="Load more interactions"
          retryLabel="Retry loading interactions"
        />
      ) : null}
    </section>
  );
}

function buildLinkedInInteractionPreviewScenario(
  post: UnifiedPost,
  replyText?: string
): LinkedInCommentThreadPreviewScenario {
  if (!replyText?.trim()) {
    return {
      ...UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS.replies,
      thread: {
        ...UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS.replies.thread,
        resolvedPost: post,
        resolvedPostId: post.id,
      },
    };
  }

  return {
    ...UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS.optimistic,
    thread: {
      ...UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS.optimistic.thread,
      resolvedPost: post,
      resolvedPostId: post.id,
      topLevelComments: {
        ...UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS.optimistic.thread
          .topLevelComments,
        items: [
          {
            ...UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS.optimistic.thread
              .topLevelComments.items[0],
            text: replyText.trim(),
            postId: post.id,
          },
          ...UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS.optimistic.thread.topLevelComments.items.slice(
            1
          ),
        ],
      },
    },
  };
}

export function YourInteractionsTabSkeleton() {
  return (
    <div className="divide-y">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3 px-4 py-3">
          <TweetSkeleton showThread={false} />
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((j) => (
                <Skeleton
                  key={j}
                  className="ring-background size-6 rounded-full ring-2"
                />
              ))}
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
