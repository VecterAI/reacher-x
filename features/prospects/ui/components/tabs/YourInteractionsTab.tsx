/**
 * YourInteractionsTab
 * Displays conversation interactions between the viewer and the prospect.
 * Reads durable rows first, then refreshes discovery in the background.
 */
"use client";

import * as React from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Tweet, TweetSkeleton } from "@/features/webapp/ui/components/tweet";
import { AvatarStack } from "@/shared/ui/components/AvatarStack";
import { usePanelStack } from "../../../contexts/PanelStackContext";
import type { ProspectInteraction } from "@/features/prospects/types";
import { getTwitterPostId } from "@/shared/lib/twitter/contracts";
import { mergeLocalEngagementIntoTweet } from "@/shared/lib/twitter/mergeViewerState";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import { UnavailableInteractionCard } from "./UnavailableInteractionCard";

const INITIAL_PAGE_SIZE = 10;

export interface YourInteractionsTabProps {
  prospectId: string;
  platform: "twitter" | "linkedin";
}

export function YourInteractionsTab({
  prospectId,
  platform,
}: YourInteractionsTabProps) {
  const { pushPanel } = usePanelStack();
  const markedUnavailableRef = React.useRef<Set<string>>(new Set());

  const interactionsQuery = usePaginatedQuery(
    api.interactions.getProspectInteractionsPage,
    platform === "twitter"
      ? {
          prospectId: prospectId as Id<"prospects">,
        }
      : "skip",
    { initialNumItems: INITIAL_PAGE_SIZE }
  );
  const markInteractionUnavailable = useMutation(
    api.interactions.markInteractionUnavailable
  );

  const interactions = React.useMemo(
    () => interactionsQuery.results as ProspectInteraction[],
    [interactionsQuery.results]
  );

  const visibleTwitterPostIds = React.useMemo(
    () =>
      platform === "twitter"
        ? interactions
            .map((interaction) => getTwitterPostId(interaction.originalPost))
            .filter((postId): postId is string => Boolean(postId))
        : [],
    [interactions, platform]
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

    const missingInteractionIds = interactions
      .filter((interaction) => interaction.status === "active")
      .filter((interaction) => {
        const postId = getTwitterPostId(interaction.originalPost);
        if (!postId) {
          return false;
        }
        return resultsById[postId]?.status === "not_found";
      })
      .map((interaction) => interaction.id)
      .filter((interactionId) => !markedUnavailableRef.current.has(interactionId));

    if (missingInteractionIds.length === 0) {
      return;
    }

    for (const interactionId of missingInteractionIds) {
      markedUnavailableRef.current.add(interactionId);
      void markInteractionUnavailable({
        interactionId: interactionId as Id<"twitterInteractions">,
        status: "missing",
        lastHydrationErrorMessage: "This post is no longer available.",
      }).catch(() => {
        markedUnavailableRef.current.delete(interactionId);
      });
    }
  }, [
    hydrateError,
    interactions,
    isHydratingTweets,
    markInteractionUnavailable,
    platform,
    resultsById,
    visibleTwitterPostIds,
  ]);

  const handleShowConversation = (
    interaction: ProspectInteraction,
    sourceTweet: import("@/features/threads/types").Tweet | null
  ) => {
    pushPanel("conversation", {
      threadId: interaction.threadId,
      sourceTweetId:
        interaction.sourcePostRef?.postId ??
        getTwitterPostId(interaction.originalPost) ??
        undefined,
      sourceTweet,
      sourceTweetSummary: interaction.sourcePostSummary ?? undefined,
      replyTweetId:
        interaction.replyPostRef?.postId ??
        interaction.replyPostSummary?.ref.postId ??
        undefined,
      replyTweetSummary: interaction.replyPostSummary ?? undefined,
      overlayCommented: true,
    });
  };

  if (platform !== "twitter") {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        Interactions are currently available for X prospects only.
      </div>
    );
  }

  const showInitialSkeleton =
    interactionsQuery.status === "LoadingFirstPage" &&
    interactions.length === 0;
  const canLoadMore = interactionsQuery.status === "CanLoadMore";

  if (showInitialSkeleton) {
    return <YourInteractionsTabSkeleton />;
  }

  return (
    <section className="space-y-4 pb-4">
      {interactions.length === 0 ? (
        <div className="text-muted-foreground px-4 py-8 text-center text-sm">
          We&apos;ll start tracking new interactions from now. Historical import
          is off.
        </div>
      ) : (
        <div className="divide-y">
          {interactions.map((interaction) => {
            const postId = getTwitterPostId(interaction.originalPost);
            const hydratedTweet = postId ? tweetsById[postId] : undefined;
            const displayTweet =
              hydratedTweet &&
              mergeLocalEngagementIntoTweet(hydratedTweet, {
                overlayCommented: true,
              });
            const isUnavailable = interaction.status !== "active";
            const hydrationResult = postId ? resultsById[postId] : undefined;
            const shouldShowSkeleton =
              !displayTweet &&
              !isUnavailable &&
              (isHydratingTweets || !hydrationResult);

            return (
              <article key={interaction.id} className="space-y-3 p-4">
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
                    participants={interaction.participants.map((participant) => ({
                      name: participant.name,
                      avatarUrl: participant.avatarUrl,
                    }))}
                    maxVisible={5}
                    size="sm"
                  />

                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      handleShowConversation(
                        interaction,
                        displayTweet ?? interaction.originalPost
                      )
                    }
                  >
                    Show conversation
                  </Button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {canLoadMore ? (
        <div className="px-4">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => interactionsQuery.loadMore(INITIAL_PAGE_SIZE)}
          >
            Load more
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function YourInteractionsTabSkeleton() {
  return (
    <div className="divide-y">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3 px-4 py-3">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-16 w-full" />
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
