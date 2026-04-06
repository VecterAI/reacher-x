"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { SerializedEditorState } from "lexical";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn, extractTextFromEditorState } from "@/shared/lib/utils";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { ReplyComposer } from "@/features/composer/ui/components/ReplyComposer";
import type {
  ComposerInitialMediaUpload,
  ComposerMediaKind,
} from "@/features/composer/types";
import { XReplyFallbackAlert } from "@/features/composer/ui/components/XReplyFallbackAlert";
import { Tweet } from "@/features/webapp/ui/components/tweet";
import { LinkedInPostCard } from "@/features/webapp/ui/components/linkedin/LinkedInPostCard";
import { XConversationPanel } from "@/features/prospects/ui/components/XConversationPanel";
import type { Tweet as TweetType } from "@/features/threads/types";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import type { AgentPanelMode } from "../../lib";
import {
  useActiveUseCaseLabels,
  useConvexReady,
  useQueryWithStatus,
} from "@/shared/hooks";
import { PostCard } from "./PostCard";
import {
  summarizeTwitterPost,
  type TwitterPostRef,
  type TwitterPostSummary,
} from "@/shared/lib/twitter/contracts";
import { toFallbackTweetFromSummary } from "@/shared/lib/twitter/ui";
import {
  X_DM_TEXT_MAX,
  X_POST_WEIGHTED_MAX,
} from "@/shared/lib/twitter/xPostTextLimit";
import type { ComposerCharacterCountMode } from "@/features/composer/types";
import { useViewerXComposerIdentity } from "@/features/composer/hooks/useViewerXComposerIdentity";
import { useDebouncedDraftSync } from "@/features/agent/hooks/useDebouncedDraftSync";

export interface AgentDynamicPanelProps {
  prospectId: string;
  taskId?: string | null;
  actionRequestId?: string | null;
  targetTweetId?: string | null;
  requestedMode?: AgentPanelMode | null;
  requestedKind?: "post" | "dm";
  /** Post data passed from the inline card click, used as fallback when the
   *  backend query hasn't resolved a task yet. */
  fallbackPost?: {
    platform: "twitter" | "linkedin";
    postData?: unknown;
    postRef?: TwitterPostRef;
    postSummary?: TwitterPostSummary;
  };
  onViewProfile?: () => void;
  /** Opens Twitter profile in app; username comes from the DM panel context. */
  onViewTwitterProfile?: (twitterUsername: string) => void;
  onClose: () => void;
  onResolvedTaskId?: (taskId: string) => void;
  onResolvedMode?: (mode: AgentPanelMode) => void;
  className?: string;
}

function buildSerializedTextState(
  text: string
): SerializedEditorState | undefined {
  const value = text.trim();
  if (!value) return undefined;

  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: "ltr",
      children: [
        {
          type: "paragraph",
          format: "",
          indent: 0,
          version: 1,
          direction: "ltr",
          children: [
            {
              type: "text",
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              version: 1,
              text: value,
            },
          ],
        },
      ],
    },
  } as unknown as SerializedEditorState;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm)$/i.test(url);
}

function isGifUrl(url: string): boolean {
  return /\.gif($|\?)/i.test(url);
}

function resolveMediaKind(
  explicitKind: unknown,
  url: string
): ComposerMediaKind {
  if (
    explicitKind === "image" ||
    explicitKind === "gif" ||
    explicitKind === "video"
  ) {
    return explicitKind;
  }

  if (isGifUrl(url)) {
    return "gif";
  }
  return isVideoUrl(url) ? "video" : "image";
}

export function AgentDynamicPanel({
  prospectId,
  taskId,
  actionRequestId,
  targetTweetId,
  requestedMode,
  requestedKind = "post",
  fallbackPost,
  onViewProfile,
  onViewTwitterProfile,
  onClose,
  onResolvedTaskId,
  onResolvedMode,
  className,
}: AgentDynamicPanelProps) {
  const { entitySingular } = useActiveUseCaseLabels();
  const entitySingularLower = entitySingular.toLowerCase();
  const {
    isReady: isConvexReady,
    isLoading: isConvexReadyLoading,
    error: convexReadyError,
  } = useConvexReady();
  const { connectionStatus, currentUser: composerCurrentUser } =
    useViewerXComposerIdentity({ enabled: isConvexReady });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftEditorFocused, setIsDraftEditorFocused] = useState(false);
  const [currentDraftText, setCurrentDraftText] = useState("");
  const isActionRequestPanel = Boolean(actionRequestId);

  const taskPanelDataQuery = useQueryWithStatus(
    api.outreach.getAgentPanelContext,
    isConvexReady && prospectId && !isActionRequestPanel
      ? {
          prospectId: prospectId as Id<"prospects">,
          taskId: taskId ? (taskId as Id<"outreachTasks">) : undefined,
          targetTweetId: targetTweetId || undefined,
        }
      : "skip"
  );
  const taskPanelData = taskPanelDataQuery.data;
  const actionPanelDataQuery = useQueryWithStatus(
    api.twitterActions.getActionRequestPanelContext,
    isConvexReady && actionRequestId
      ? {
          actionRequestId: actionRequestId as Id<"agentActionRequests">,
        }
      : "skip"
  );
  const actionPanelData = actionPanelDataQuery.data;

  const approveTaskWithEdits = useMutation(api.outreach.approveTaskWithEdits);
  const updatePendingTaskDraft = useMutation(
    api.outreach.updatePendingTaskDraft
  );
  const approveActionRequestWithEdits = useMutation(
    api.twitterActions.approveActionRequestWithEdits
  );
  const updatePendingActionRequestDraft = useMutation(
    api.twitterActions.updatePendingActionRequestDraft
  );
  const postComposerLimits = useQuery(
    api.xPostLimits.getViewerPostComposerLimits,
    isConvexReady ? {} : "skip"
  );
  const twitterComposerMaxLength = useMemo(
    () => postComposerLimits?.maxLength ?? X_POST_WEIGHTED_MAX,
    [postComposerLimits?.maxLength]
  );
  const twitterComposerCountMode = useMemo(
    (): ComposerCharacterCountMode =>
      postComposerLimits?.characterCountMode ?? "x_post",
    [postComposerLimits?.characterCountMode]
  );
  const isPanelLoading =
    isConvexReadyLoading ||
    (isConvexReady &&
      (isActionRequestPanel
        ? actionPanelDataQuery.isPending
        : taskPanelDataQuery.isPending));
  const activePanelError = isActionRequestPanel
    ? actionPanelDataQuery.error
    : taskPanelDataQuery.error;

  useEffect(() => {
    if (taskPanelData?.resolvedTaskId && onResolvedTaskId) {
      onResolvedTaskId(taskPanelData.resolvedTaskId);
    }
  }, [taskPanelData?.resolvedTaskId, onResolvedTaskId]);

  useEffect(() => {
    const rawNextMode = isActionRequestPanel
      ? actionPanelData?.mode
      : taskPanelData?.mode;
    const nextMode: AgentPanelMode | undefined =
      rawNextMode === "approval" || rawNextMode === "posted"
        ? rawNextMode
        : undefined;
    if (nextMode && onResolvedMode) {
      onResolvedMode(nextMode);
    }
  }, [
    actionPanelData?.mode,
    isActionRequestPanel,
    onResolvedMode,
    taskPanelData?.mode,
  ]);

  const resolvedMode = isActionRequestPanel
    ? actionPanelData?.mode
    : taskPanelData?.mode;
  const isDmPanel =
    requestedKind === "dm" ||
    actionPanelData?.actionKey === "send_dm" ||
    actionPanelData?.actionKey === "send_dm_in_existing_conversation";
  const mode: AgentPanelMode =
    resolvedMode === "approval" || resolvedMode === "posted"
      ? resolvedMode
      : requestedMode || "approval";

  const replyUsers = useMemo(() => {
    const summary = !isActionRequestPanel
      ? (taskPanelData?.originalPost?.postSummary as
          | TwitterPostSummary
          | undefined)
      : (actionPanelData?.sourcePostSummary as TwitterPostSummary | undefined);
    const fallbackSummary =
      summary ??
      fallbackPost?.postSummary ??
      summarizeTwitterPost(fallbackPost?.postData);

    const screenName = fallbackSummary?.author?.handle || entitySingularLower;
    const name = fallbackSummary?.author?.name || screenName;

    return [{ screenName, name }];
  }, [
    actionPanelData?.sourcePostSummary,
    entitySingularLower,
    fallbackPost?.postData,
    fallbackPost?.postSummary,
    isActionRequestPanel,
    taskPanelData?.originalPost,
  ]);

  const initialContent = useMemo(
    () => buildSerializedTextState(currentDraftText),
    [currentDraftText]
  );
  const initialMediaUploads = useMemo<ComposerInitialMediaUpload[]>(() => {
    const mediaUrls = isActionRequestPanel
      ? actionPanelData?.mediaUrls || []
      : taskPanelData?.draft?.mediaUrls || [];
    const mediaDescriptions = isActionRequestPanel
      ? actionPanelData?.mediaDescriptions || []
      : taskPanelData?.draft?.mediaDescriptions || [];
    const mediaKinds = isActionRequestPanel
      ? actionPanelData?.mediaKinds || []
      : taskPanelData?.draft?.mediaKinds || [];

    return mediaUrls.map((url: string, index: number) => ({
      id: `${isActionRequestPanel ? "action" : "task"}-draft-media-${index}`,
      url,
      serverUrl: url,
      type:
        resolveMediaKind(mediaKinds[index], url) === "video" ? "video" : "image",
      mediaKind: resolveMediaKind(mediaKinds[index], url),
      description: mediaDescriptions[index] || undefined,
    }));
  }, [
    actionPanelData?.mediaDescriptions,
    actionPanelData?.mediaKinds,
    actionPanelData?.mediaUrls,
    isActionRequestPanel,
    taskPanelData?.draft?.mediaDescriptions,
    taskPanelData?.draft?.mediaKinds,
    taskPanelData?.draft?.mediaUrls,
  ]);

  const persistedDraftText = isActionRequestPanel
    ? actionPanelData?.content || ""
    : taskPanelData?.draft?.content || "";

  useEffect(() => {
    if (isDraftEditorFocused) {
      return;
    }
    setCurrentDraftText(persistedDraftText);
  }, [isDraftEditorFocused, persistedDraftText]);

  const draftSync = useDebouncedDraftSync({
    enabled:
      mode === "approval" &&
      ((isActionRequestPanel && Boolean(actionPanelData?.actionRequestId)) ||
        (!isActionRequestPanel && Boolean(taskPanelData?.resolvedTaskId))),
    value: currentDraftText,
    persistedValue: persistedDraftText,
    onSave: async (nextValue) => {
      if (isActionRequestPanel) {
        await updatePendingActionRequestDraft({
          actionRequestId:
            actionPanelData?.actionRequestId as Id<"agentActionRequests">,
          content: nextValue,
        });
        return;
      }

      await updatePendingTaskDraft({
        taskId: taskPanelData?.resolvedTaskId as Id<"outreachTasks">,
        content: nextValue,
      });
    },
  });

  const postedReplyTweet = useMemo(() => {
    if (isActionRequestPanel) {
      if (mode !== "posted" || !actionPanelData) {
        return null;
      }
      const mediaUrls = actionPanelData.mediaUrls || [];
      const mediaDescriptions = actionPanelData.mediaDescriptions || [];
      const mediaKinds = actionPanelData.mediaKinds || [];
      const media =
        mediaUrls.length > 0
          ? mediaUrls.map((url: string, index: number) => {
              const kind = resolveMediaKind(mediaKinds[index], url);
              const video = kind === "video";
              return {
                id_str: `posted-media-${index}`,
                media_url_https: url,
                type: video ? "video" : "photo",
                ext_alt_text: mediaDescriptions[index] || undefined,
                video_info: video
                  ? {
                      variants: [{ content_type: "video/mp4", url }],
                    }
                  : undefined,
              };
            })
          : undefined;
      return {
        id_str:
          actionPanelData.createdTweetId ||
          `posted-${actionPanelData.actionRequestId}`,
        full_text: actionPanelData.content || "",
        user: {
          name: composerCurrentUser.name,
          screen_name: composerCurrentUser.screenName,
          profile_image_url_https: composerCurrentUser.profileImageUrl ?? "",
          verified: Boolean(composerCurrentUser.verified),
        },
        entities: media ? { media } : undefined,
      };
    }

    if (!taskPanelData?.posted) return null;

    const mediaUrls = taskPanelData.posted.mediaUrls || [];
    const mediaDescriptions = taskPanelData.posted.mediaDescriptions || [];
    const mediaKinds = taskPanelData.posted.mediaKinds || [];
    const media =
      mediaUrls.length > 0
        ? mediaUrls.map((url: string, index: number) => {
            const kind = resolveMediaKind(mediaKinds[index], url);
            const video = kind === "video";
            return {
              id_str: `posted-media-${index}`,
              media_url_https: url,
              type: video ? "video" : "photo",
              ext_alt_text: mediaDescriptions[index] || undefined,
              video_info: video
                ? {
                    variants: [{ content_type: "video/mp4", url }],
                  }
                : undefined,
            };
          })
        : undefined;

    const createdAt =
      typeof taskPanelData.posted.postedAt === "number"
        ? new Date(taskPanelData.posted.postedAt).toISOString()
        : undefined;

    return {
      id_str:
        taskPanelData.posted.tweetId ||
        `posted-${taskPanelData.resolvedTaskId}`,
      full_text: taskPanelData.posted.text || "",
      tweet_created_at: createdAt,
      user: {
        name: taskPanelData.posted.author?.name || composerCurrentUser.name,
        screen_name:
          taskPanelData.posted.author?.screenName ||
          composerCurrentUser.screenName,
        profile_image_url_https:
          taskPanelData.posted.author?.profileImageUrl ||
          composerCurrentUser.profileImageUrl ||
          "",
        verified: Boolean(composerCurrentUser.verified),
      },
      entities: media ? { media } : undefined,
    };
  }, [
    actionPanelData,
    composerCurrentUser,
    isActionRequestPanel,
    mode,
    taskPanelData,
  ]);

  const handleSubmit = useCallback(
    async (
      content: SerializedEditorState,
      mediaUrls?: string[],
      mediaDescriptions?: string[],
      mediaKinds?: ComposerMediaKind[]
    ) => {
      setIsSubmitting(true);
      try {
        const editedText = extractTextFromEditorState(content).trim();

        const result = isActionRequestPanel
          ? await approveActionRequestWithEdits({
              actionRequestId:
                actionPanelData?.actionRequestId as Id<"agentActionRequests">,
              content: editedText,
              mediaUrls,
              mediaDescriptions,
              mediaKinds,
            })
          : await approveTaskWithEdits({
              taskId: taskPanelData?.resolvedTaskId as Id<"outreachTasks">,
              content: editedText,
              mediaUrls,
              mediaDescriptions,
              mediaKinds,
              approvalContext: taskPanelData?.originalPost
                ? {
                    panelMode: "approval",
                    platform: taskPanelData.originalPost.platform,
                    sourcePostRef: taskPanelData.originalPost.postRef,
                    sourcePostSummary: taskPanelData.originalPost.postSummary,
                    sourceContext:
                      taskPanelData.originalPost.context || undefined,
                  }
                : undefined,
            });
        if (result?.duplicate) {
          toast.success("Action already approved.");
        } else {
          toast.success(
            isActionRequestPanel ? "Action approved." : "Reply approved.",
            {
              description: "Posting in background...",
            }
          );
        }
      } catch (error) {
        toast.error(
          isActionRequestPanel
            ? "Failed to approve action"
            : "Failed to approve reply",
          {
            description:
              error instanceof Error ? error.message : "Please try again.",
          }
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      actionPanelData,
      approveActionRequestWithEdits,
      approveTaskWithEdits,
      isActionRequestPanel,
      taskPanelData,
    ]
  );

  const panelTitle =
    isActionRequestPanel && actionPanelData?.title
      ? actionPanelData.title
      : mode === "posted"
        ? "Posted reply"
        : "Post";

  if (isDmPanel) {
    return (
      <XConversationPanel
        prospectId={prospectId}
        actionRequestId={actionRequestId}
        onBack={onClose}
        onViewProfile={onViewProfile}
        onViewTwitterProfile={onViewTwitterProfile}
        className={className}
      />
    );
  }

  const renderActionRequestPanel = () => {
    if (!actionPanelData) {
      return null;
    }

    const isDmAction =
      actionPanelData.actionKey === "send_dm" ||
      actionPanelData.actionKey === "send_dm_in_existing_conversation";

    return (
      <div className="px-4">
        {actionPanelData.sourcePostSummary ? (
          <PostCard
            platform="twitter"
            postRef={actionPanelData.sourcePostRef ?? undefined}
            postSummary={actionPanelData.sourcePostSummary}
            context={actionPanelData.sourceContext ?? undefined}
          />
        ) : null}

        {mode === "approval" ? (
          <div className="space-y-3">
            <ReplyComposer
              key={`${actionPanelData.actionRequestId}-${actionPanelData.content || ""}-${(actionPanelData.mediaUrls || []).join("|")}-${(actionPanelData.mediaKinds || []).join("|")}`}
              initialContent={initialContent}
              initialMediaUploads={initialMediaUploads}
              replyTo={{
                tweet: actionPanelData.sourcePostSummary
                  ? (toFallbackTweetFromSummary(
                      actionPanelData.sourcePostSummary as TwitterPostSummary
                    ) as any)
                  : ({ id_str: actionPanelData.sourcePostRef?.postId } as any),
                users: replyUsers,
              }}
              currentUser={composerCurrentUser}
              maxLength={
                isDmAction
                  ? X_DM_TEXT_MAX
                  : (connectionStatus?.postComposerMaxLength ??
                    twitterComposerMaxLength)
              }
              characterCountMode={
                isDmAction
                  ? "raw"
                  : (connectionStatus?.postComposerCountMode ??
                    twitterComposerCountMode)
              }
              placeholder="Edit post before sending"
              disabled={isSubmitting}
              onContentChange={(content) => {
                setCurrentDraftText(extractTextFromEditorState(content).trim());
              }}
              onEditorFocus={() => {
                setIsDraftEditorFocused(true);
              }}
              onEditorBlur={() => {
                setIsDraftEditorFocused(false);
                void draftSync.flushNow();
              }}
              onSubmit={handleSubmit}
            />
            {draftSync.status === "saving" ? (
              <p className="text-muted-foreground text-xs">Saving…</p>
            ) : draftSync.status === "error" ? (
              <p className="text-xs text-amber-600">
                Draft sync failed. We&apos;ll retry on your next edit.
              </p>
            ) : null}
            <XReplyFallbackAlert
              postId={
                actionPanelData.sourcePostRef?.postId ??
                actionPanelData.sourcePostSummary?.ref.postId
              }
              authorHandle={
                actionPanelData.sourcePostRef?.authorHandle ??
                actionPanelData.sourcePostSummary?.author?.handle
              }
            />
          </div>
        ) : postedReplyTweet ? (
          <Tweet
            tweet={postedReplyTweet as TweetType}
            showFullContent
            showThread
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            Post was sent, but preview data is unavailable.
          </p>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="flex flex-col md:w-full">
        <PageHeader title={panelTitle} onBack={onClose} />
        <ScrollArea className="min-h-0 flex-1" viewportClassName="pb-8">
          <PageContent className="space-y-4 py-4">
            {isPanelLoading ? (
              <div className="space-y-3 px-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : convexReadyError || activePanelError ? (
              <div className="px-4">
                <p className="text-sm font-medium">
                  Could not load panel context
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {convexReadyError?.message ||
                    activePanelError?.message ||
                    "Please try again."}
                </p>
              </div>
            ) : isActionRequestPanel ? (
              renderActionRequestPanel()
            ) : !taskPanelData && !fallbackPost ? (
              <p className="text-muted-foreground text-sm">
                No panel context was found for this card yet.
              </p>
            ) : !taskPanelData && fallbackPost ? (
              <div className="px-4">
                {fallbackPost.platform === "twitter" ? (
                  <PostCard
                    platform="twitter"
                    postData={fallbackPost.postData}
                    postRef={fallbackPost.postRef}
                    postSummary={
                      fallbackPost.postSummary ??
                      summarizeTwitterPost(fallbackPost.postData)
                    }
                  />
                ) : (
                  <LinkedInPostCard
                    post={fallbackPost.postData as UnifiedPost}
                    showFullContent
                  />
                )}
                <div className="space-y-3">
                  {fallbackPost.platform === "twitter" ? (
                    <XReplyFallbackAlert
                      postId={
                        fallbackPost.postRef?.postId ??
                        fallbackPost.postSummary?.ref.postId
                      }
                      authorHandle={
                        fallbackPost.postRef?.authorHandle ??
                        fallbackPost.postSummary?.author?.handle
                      }
                    />
                  ) : null}
                  <ReplyComposer
                    replyTo={{
                      tweet:
                        fallbackPost.platform === "twitter" &&
                        fallbackPost.postSummary
                          ? (toFallbackTweetFromSummary(
                              fallbackPost.postSummary
                            ) as any)
                          : (fallbackPost.postData as any),
                      users: replyUsers,
                    }}
                    currentUser={composerCurrentUser}
                    placeholder="Ask the agent to draft a reply first..."
                    disabled
                  />
                </div>
              </div>
            ) : (
              (() => {
                const data = taskPanelData!;
                const platform = data.originalPost?.platform || "twitter";

                return (
                  <div className="px-4">
                    {data.originalPost &&
                      (platform === "twitter" ? (
                        <PostCard
                          platform="twitter"
                          postRef={data.originalPost.postRef}
                          postSummary={data.originalPost.postSummary}
                          context={data.originalPost.context ?? undefined}
                        />
                      ) : null)}

                    {mode === "approval" ? (
                      <div className="space-y-3">
                        {platform === "twitter" ? (
                          <XReplyFallbackAlert
                            postId={
                              data.originalPost?.postRef?.postId ??
                              data.targetTweetId
                            }
                            authorHandle={
                              data.originalPost?.postRef?.authorHandle ??
                              data.originalPost?.postSummary?.author?.handle
                            }
                          />
                        ) : null}
                        <ReplyComposer
                          key={`${data.resolvedTaskId}-${data.draft?.content || ""}-${(data.draft?.mediaUrls || []).join("|")}-${(data.draft?.mediaKinds || []).join("|")}`}
                          initialContent={initialContent}
                          initialMediaUploads={initialMediaUploads}
                          replyTo={{
                            tweet: data.originalPost?.postSummary
                              ? (toFallbackTweetFromSummary(
                                  data.originalPost
                                    .postSummary as TwitterPostSummary
                                ) as any)
                              : ({ id_str: data.targetTweetId } as any),
                            users: replyUsers,
                          }}
                          currentUser={composerCurrentUser}
                          maxLength={
                            connectionStatus?.postComposerMaxLength ??
                            twitterComposerMaxLength
                          }
                          characterCountMode={
                            connectionStatus?.postComposerCountMode ??
                            twitterComposerCountMode
                          }
                          placeholder="Edit reply before posting"
                          disabled={isSubmitting}
                          onContentChange={(content) => {
                            setCurrentDraftText(
                              extractTextFromEditorState(content).trim()
                            );
                          }}
                          onEditorFocus={() => {
                            setIsDraftEditorFocused(true);
                          }}
                          onEditorBlur={() => {
                            setIsDraftEditorFocused(false);
                            void draftSync.flushNow();
                          }}
                          onSubmit={handleSubmit}
                        />
                        {draftSync.status === "saving" ? (
                          <p className="text-muted-foreground text-xs">
                            Saving…
                          </p>
                        ) : draftSync.status === "error" ? (
                          <p className="text-xs text-amber-600">
                            Draft sync failed. We&apos;ll retry on your next
                            edit.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div>
                        {postedReplyTweet ? (
                          <Tweet
                            tweet={postedReplyTweet as TweetType}
                            showFullContent
                            showThread
                          />
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            Reply was posted, but preview data is unavailable.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}
