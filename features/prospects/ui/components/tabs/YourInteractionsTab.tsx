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
import {
  LinkedInPostCard,
  type LinkedInCommentThreadPreviewScenario,
} from "@/features/webapp/ui/components/linkedin";
import { AvatarStack } from "@/shared/ui/components/AvatarStack";
import { usePanelStack } from "../../../contexts/PanelStackContext";
import type { ProspectInteraction } from "@/features/prospects/types";
import { getTwitterPostId } from "@/shared/lib/twitter/contracts";
import { mergeLocalEngagementIntoTweet } from "@/shared/lib/twitter/mergeViewerState";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { UnavailableInteractionCard } from "./UnavailableInteractionCard";
import { UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS } from "@/features/prospects/lib/uiPreviewData";

const INITIAL_PAGE_SIZE = 10;

export interface YourInteractionsTabProps {
  prospectId: string;
  platform: "twitter" | "linkedin";
  readOnly?: boolean;
  previewInteractions?: ProspectInteraction[];
}

export function YourInteractionsTab({
  prospectId,
  platform,
  readOnly = false,
  previewInteractions,
}: YourInteractionsTabProps) {
  const { pushPanel } = usePanelStack();
  const markedUnavailableRef = React.useRef<Set<string>>(new Set());
  const isPreview = Array.isArray(previewInteractions);

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

  const interactions = React.useMemo(
    () =>
      isPreview
        ? previewInteractions
        : (interactionsQuery.results as ProspectInteraction[]),
    [interactionsQuery.results, isPreview, previewInteractions]
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
      .filter(
        (interactionId) => !markedUnavailableRef.current.has(interactionId)
      );

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

  const handleOpenLinkedInThread = React.useCallback(
    (interaction: ProspectInteraction, post: UnifiedPost) => {
      pushPanel("linkedin-post-thread", {
        post,
        previewScenario: isPreview
          ? buildLinkedInInteractionPreviewScenario(post, interaction.replyText)
          : undefined,
      });
    },
    [isPreview, pushPanel]
  );

  const showInitialSkeleton =
    !isPreview &&
    interactionsQuery.status === "LoadingFirstPage" &&
    interactions.length === 0;
  const canLoadMore = !isPreview && interactionsQuery.status === "CanLoadMore";

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
            if (platform === "linkedin") {
              const linkedinPost = normalizeLinkedInInteractionPost(
                interaction.sourcePostData,
                interaction.sourceUrl
              );

              return (
                <article key={interaction.id} className="space-y-3 p-4">
                  {linkedinPost ? (
                    <LinkedInPostCard
                      post={linkedinPost}
                      prospectId={prospectId}
                      characterLimit={300}
                      readOnly={readOnly}
                      commentBehavior="none"
                      disableExternalNavigation
                      onClick={() =>
                        handleOpenLinkedInThread(interaction, linkedinPost)
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
                      participants={interaction.participants.map(
                        (participant) => ({
                          name: participant.name,
                          avatarUrl: participant.avatarUrl,
                        })
                      )}
                      maxVisible={5}
                      size="sm"
                    />

                    {linkedinPost ? (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          handleOpenLinkedInThread(interaction, linkedinPost)
                        }
                      >
                        Open thread
                      </Button>
                    ) : null}
                  </footer>
                </article>
              );
            }

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
                    participants={interaction.participants.map(
                      (participant) => ({
                        name: participant.name,
                        avatarUrl: participant.avatarUrl,
                      })
                    )}
                    maxVisible={5}
                    size="sm"
                  />

                  <Button
                    variant="outline"
                    size="xs"
                    disabled={readOnly}
                    onClick={() =>
                      handleShowConversation(
                        interaction,
                        displayTweet ?? interaction.originalPost
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

function normalizeLinkedInInteractionPost(
  value: unknown,
  fallbackUrl?: string
): UnifiedPost | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    record.platform === "linkedin" &&
    typeof record.id === "string" &&
    typeof record.text === "string"
  ) {
    return {
      ...(record as unknown as UnifiedPost),
      url:
        typeof (record as unknown as UnifiedPost).url === "string"
          ? (record as unknown as UnifiedPost).url
          : fallbackUrl,
    };
  }

  const author =
    typeof record.author === "object" && record.author !== null
      ? (record.author as Record<string, unknown>)
      : undefined;
  const postedAt =
    typeof record.postedAt === "object" && record.postedAt !== null
      ? (record.postedAt as Record<string, unknown>)
      : undefined;
  const engagements =
    typeof record.engagements === "object" && record.engagements !== null
      ? (record.engagements as Record<string, unknown>)
      : undefined;
  const mediaContent = Array.isArray(record.mediaContent)
    ? record.mediaContent
    : [];

  const id =
    typeof record.postID === "string"
      ? record.postID
      : typeof record.urn === "string"
        ? record.urn
        : undefined;
  if (!id) {
    return null;
  }

  return {
    id,
    platform: "linkedin",
    url: typeof record.postURL === "string" ? record.postURL : fallbackUrl,
    author: {
      id:
        typeof author?.id === "string"
          ? author.id
          : typeof author?.urn === "string"
            ? author.urn
            : undefined,
      name: typeof author?.name === "string" ? author.name : undefined,
      avatarUrl:
        typeof author?.profilePictureURL === "string"
          ? author.profilePictureURL
          : undefined,
      profileUrl: typeof author?.url === "string" ? author.url : undefined,
      headline:
        typeof author?.headline === "string" ? author.headline : undefined,
    },
    text: typeof record.text === "string" ? record.text : "",
    createdAt: typeof postedAt?.timestamp === "number" ? postedAt.timestamp : 0,
    metrics: {
      reactions:
        typeof engagements?.totalReactions === "number"
          ? engagements.totalReactions
          : 0,
      comments:
        typeof engagements?.commentsCount === "number"
          ? engagements.commentsCount
          : 0,
      reposts:
        typeof engagements?.repostsCount === "number"
          ? engagements.repostsCount
          : 0,
    },
    media: mediaContent
      .map((item) => {
        const media =
          typeof item === "object" && item !== null
            ? (item as Record<string, unknown>)
            : null;
        if (!media || typeof media.url !== "string") {
          return null;
        }
        const type =
          media.type === "image" || media.type === "video"
            ? media.type
            : "link";
        return {
          type,
          url: media.url,
        };
      })
      .filter(Boolean) as NonNullable<UnifiedPost["media"]>,
    raw: value,
  };
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
