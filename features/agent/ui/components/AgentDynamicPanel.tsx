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
import { Button } from "@/shared/ui/components/Button";
import { BaseComposer } from "@/features/composer/ui/components/BaseComposer";
import { ReplyComposer } from "@/features/composer/ui/components/ReplyComposer";
import type {
  ComposerInitialMediaUpload,
  ComposerMediaKind,
} from "@/features/composer/types";
import { XReplyFallbackAlert } from "@/features/composer/ui/components/XReplyFallbackAlert";
import { Tweet } from "@/features/webapp/ui/components/tweet";
import { LinkedInPostCard } from "@/features/webapp/ui/components/linkedin/LinkedInPostCard";
import { XConversationPanel } from "@/features/prospects/ui/components/XConversationPanel";
import { LinkedInConversationPanel } from "@/features/prospects/ui/components/LinkedInConversationPanel";
import { ThreadAwareTwitterReplyBody } from "@/features/prospects/ui/components/ThreadAwareTwitterReplyBody";
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
  const isExplicitDmRequest = !isActionRequestPanel && requestedKind === "dm";

  const taskPanelDataQuery = useQueryWithStatus(
    api.outreach.getAgentPanelContext,
    isConvexReady &&
      prospectId &&
      !isActionRequestPanel &&
      (!isExplicitDmRequest || Boolean(taskId))
      ? {
          prospectId: prospectId as Id<"prospects">,
          taskId: taskId ? (taskId as Id<"outreachTasks">) : undefined,
          targetTweetId: targetTweetId || undefined,
        }
      : "skip"
  );
  const taskPanelData = taskPanelDataQuery.data;
  const actionPanelDataQuery = useQueryWithStatus(
    api.socialActions.getActionRequestPanelContext,
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
  const approveActionRequest = useMutation(
    api.socialActions.approveActionRequest
  );
  const approveActionRequestWithEdits = useMutation(
    api.socialActions.approveActionRequestWithEdits
  );
  const updatePendingActionRequestDraft = useMutation(
    api.socialActions.updatePendingActionRequestDraft
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
    if (
      taskPanelData?.resolvedTaskId &&
      onResolvedTaskId &&
      (!isExplicitDmRequest || taskPanelData.kind === "dm")
    ) {
      onResolvedTaskId(taskPanelData.resolvedTaskId);
    }
  }, [
    isExplicitDmRequest,
    onResolvedTaskId,
    taskPanelData?.kind,
    taskPanelData?.resolvedTaskId,
  ]);

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
  const taskPanelKind = !isActionRequestPanel ? taskPanelData?.kind : undefined;
  const taskPanelPlatform = !isActionRequestPanel
    ? taskPanelData?.platform
    : undefined;
  const taskPanelApprovalReady = !isActionRequestPanel
    ? Boolean(taskPanelData?.approvalReady)
    : false;
  const isTaskBackedDmContext = taskPanelKind === "dm";
  const isLinkedInDmAction =
    actionPanelData?.actionKey === "linkedin_send_message" ||
    actionPanelData?.actionKey ===
      "linkedin_send_message_existing_conversation";
  const isDmPanel =
    isExplicitDmRequest ||
    taskPanelKind === "dm" ||
    actionPanelData?.actionKey === "send_dm" ||
    actionPanelData?.actionKey === "send_dm_in_existing_conversation" ||
    isLinkedInDmAction;
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
        resolveMediaKind(mediaKinds[index], url) === "video"
          ? "video"
          : "image",
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
        expectedType: "comment",
        content: nextValue,
      });
    },
  });

  const taskDraftHelperText =
    !isActionRequestPanel &&
    taskPanelKind === "post" &&
    mode === "approval" &&
    !taskPanelApprovalReady
      ? "Approve the plan first to send this reply."
      : null;

  const renderDraftSyncStatusLine = (helperText?: string | null) => (
    <div className="min-h-4 text-xs">
      {draftSync.status === "saving" ? (
        <p className="text-muted-foreground">Saving…</p>
      ) : draftSync.status === "error" ? (
        <p className="text-amber-600">
          Draft sync failed. We&apos;ll retry on your next edit.
        </p>
      ) : helperText ? (
        <p className="text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );

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
              expectedType: "comment",
              content: editedText,
              mediaUrls,
              mediaDescriptions,
              mediaKinds,
              approvalContext:
                taskPanelData?.kind === "post" && taskPanelData?.originalPost
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
            isActionRequestPanel
              ? "Action approved."
              : taskPanelData?.kind === "dm"
                ? "DM approved."
                : "Reply approved.",
            {
              description:
                taskPanelData?.kind === "dm"
                  ? "Sending in background..."
                  : "Posting in background...",
            }
          );
        }
      } catch (error) {
        toast.error(
          isActionRequestPanel
            ? "Failed to approve action"
            : taskPanelData?.kind === "dm"
              ? "Failed to approve DM"
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
    const dmPlatform =
      actionPanelData?.platform === "linkedin" ||
      taskPanelPlatform === "linkedin"
        ? "linkedin"
        : "twitter";

    if (dmPlatform === "linkedin") {
      return (
        <LinkedInConversationPanel
          prospectId={prospectId}
          actionRequestId={actionRequestId}
          taskId={
            isTaskBackedDmContext ? (taskPanelData?.resolvedTaskId ?? null) : null
          }
          taskStatus={
            isTaskBackedDmContext ? taskPanelData?.taskStatus : undefined
          }
          taskMode={mode}
          taskApprovalReady={isTaskBackedDmContext && taskPanelApprovalReady}
          taskDraft={
            isTaskBackedDmContext ? (taskPanelData?.draft ?? undefined) : undefined
          }
          onBack={onClose}
          onViewProfile={onViewProfile}
          className={className}
        />
      );
    }

    return (
      <XConversationPanel
        prospectId={prospectId}
        actionRequestId={actionRequestId}
        taskId={
          isTaskBackedDmContext ? (taskPanelData?.resolvedTaskId ?? null) : null
        }
        taskStatus={isTaskBackedDmContext ? taskPanelData?.taskStatus : undefined}
        taskMode={mode}
        taskApprovalReady={isTaskBackedDmContext && taskPanelApprovalReady}
        taskDraft={
          isTaskBackedDmContext ? (taskPanelData?.draft ?? undefined) : undefined
        }
        taskPosted={
          isTaskBackedDmContext ? (taskPanelData?.posted ?? undefined) : undefined
        }
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

    if (actionPanelData.platform === "linkedin") {
      const isCommentAction =
        actionPanelData.actionKey === "linkedin_comment_on_post";
      const isInviteAction =
        actionPanelData.actionKey === "linkedin_invite_user";
      const isEditable = isCommentAction || isInviteAction;
      const sourceLinkedInPost = actionPanelData.sourcePostData as
        | UnifiedPost
        | undefined;

      return (
        <div className="space-y-4 px-4">
          {sourceLinkedInPost ? (
            <LinkedInPostCard
              post={sourceLinkedInPost}
              showFullContent
              readOnly
            />
          ) : null}

          {mode === "approval" && isEditable ? (
            <div className="rounded-[24px] border p-3">
              <BaseComposer
                key={`${actionPanelData.actionRequestId}-${actionPanelData.content || ""}-${(actionPanelData.mediaUrls || []).join("|")}-${(actionPanelData.mediaKinds || []).join("|")}`}
                currentUser={composerCurrentUser}
                initialContent={initialContent}
                initialMediaUploads={initialMediaUploads}
                maxLength={8000}
                characterCountMode="raw"
                submitButtonText="Approve"
                placeholder={
                  isCommentAction
                    ? "Edit LinkedIn comment before sending"
                    : "Add an invitation note"
                }
                disabled={isSubmitting}
                inlineAutocompleteContext={{
                  surfaceLabel: isCommentAction
                    ? "linkedin_comment_approval"
                    : "linkedin_invite_approval",
                  platform: "linkedin",
                  prospectId,
                  maxLength: 8000,
                  characterCountMode: "raw",
                }}
                onContentChange={(content: SerializedEditorState) => {
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
              <div className="mt-2">{renderDraftSyncStatusLine(null)}</div>
            </div>
          ) : null}

          <div className="rounded-[20px] border px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">{actionPanelData.title}</p>
              {actionPanelData.description ? (
                <p className="text-muted-foreground text-sm">
                  {actionPanelData.description}
                </p>
              ) : null}
              {mode === "posted" && actionPanelData.content ? (
                <p className="bg-muted/40 rounded-xl border px-3 py-2 text-sm whitespace-pre-wrap">
                  {actionPanelData.content}
                </p>
              ) : null}
            </div>

            {mode === "approval" && !isEditable ? (
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  disabled={isSubmitting}
                  onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      await approveActionRequest({
                        actionRequestId:
                          actionPanelData.actionRequestId as Id<"agentActionRequests">,
                      });
                      toast.success("Action approved.", {
                        description: "Executing in background...",
                      });
                    } catch (error) {
                      toast.error("Failed to approve action", {
                        description:
                          error instanceof Error
                            ? error.message
                            : "Please try again.",
                      });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  Approve action
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    const isDmAction =
      actionPanelData.actionKey === "send_dm" ||
      actionPanelData.actionKey === "send_dm_in_existing_conversation";

    const sourceTweetId =
      actionPanelData.sourcePostRef?.postId ??
      actionPanelData.sourcePostSummary?.ref.postId;

    return mode === "approval" && sourceTweetId ? (
      <ThreadAwareTwitterReplyBody
        tweetId={sourceTweetId}
        initialTweet={
          actionPanelData.sourcePostSummary
            ? (toFallbackTweetFromSummary(
                actionPanelData.sourcePostSummary as TwitterPostSummary
              ) as TweetType)
            : undefined
        }
        renderComposerSection={(tweet) => (
          <div className="mx-4 space-y-3">
            <ReplyComposer
              key={`${actionPanelData.actionRequestId}-${actionPanelData.content || ""}-${(actionPanelData.mediaUrls || []).join("|")}-${(actionPanelData.mediaKinds || []).join("|")}`}
              initialContent={initialContent}
              initialMediaUploads={initialMediaUploads}
              replyTo={{
                tweet,
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
              inlineAutocompleteContext={{
                surfaceLabel: isDmAction ? "x_dm_approval" : "x_reply_approval",
                platform: "twitter",
                prospectId,
              }}
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
            {renderDraftSyncStatusLine(null)}
            <XReplyFallbackAlert
              postId={sourceTweetId}
              authorHandle={
                actionPanelData.sourcePostRef?.authorHandle ??
                actionPanelData.sourcePostSummary?.author?.handle
              }
            />
          </div>
        )}
      />
    ) : (
      <div className="px-4">
        {actionPanelData.sourcePostSummary ? (
          <PostCard
            platform="twitter"
            postRef={actionPanelData.sourcePostRef ?? undefined}
            postSummary={actionPanelData.sourcePostSummary}
            context={actionPanelData.sourceContext ?? undefined}
          />
        ) : null}

        {postedReplyTweet ? (
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
              fallbackPost.platform === "twitter" &&
              (fallbackPost.postRef?.postId ??
                fallbackPost.postSummary?.ref.postId) ? (
                <ThreadAwareTwitterReplyBody
                  tweetId={
                    fallbackPost.postRef?.postId ??
                    fallbackPost.postSummary!.ref.postId
                  }
                  initialTweet={
                    fallbackPost.postSummary
                      ? (toFallbackTweetFromSummary(
                          fallbackPost.postSummary
                        ) as TweetType)
                      : undefined
                  }
                  renderComposerSection={(tweet) => (
                    <div className="mx-4 space-y-3">
                      <ReplyComposer
                        replyTo={{
                          tweet,
                          users: replyUsers,
                        }}
                        currentUser={composerCurrentUser}
                        placeholder="Ask the agent to draft a reply first..."
                        disabled
                      />
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
                    </div>
                  )}
                />
              ) : (
                <div className="px-4">
                  <LinkedInPostCard
                    post={fallbackPost.postData as UnifiedPost}
                    showFullContent
                    commentBehavior="none"
                  />
                </div>
              )
            ) : (
              (() => {
                const data = taskPanelData!;
                const platform = data.originalPost?.platform || "twitter";
                const originalTweetSummary = data.originalPost?.postSummary as
                  | TwitterPostSummary
                  | undefined;
                const originalTweetId =
                  data.originalPost?.postRef?.postId ??
                  originalTweetSummary?.ref.postId ??
                  data.targetTweetId;

                return mode === "approval" &&
                  platform === "twitter" &&
                  originalTweetId ? (
                  <ThreadAwareTwitterReplyBody
                    tweetId={originalTweetId}
                    initialTweet={
                      originalTweetSummary
                        ? (toFallbackTweetFromSummary(
                            originalTweetSummary
                          ) as TweetType)
                        : undefined
                    }
                    renderComposerSection={(tweet) => (
                      <div className="mx-4 space-y-3">
                        <ReplyComposer
                          key={`${data.resolvedTaskId}-${data.draft?.content || ""}-${(data.draft?.mediaUrls || []).join("|")}-${(data.draft?.mediaKinds || []).join("|")}`}
                          initialContent={initialContent}
                          initialMediaUploads={initialMediaUploads}
                          replyTo={{
                            tweet,
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
                          inlineAutocompleteContext={{
                            surfaceLabel: "x_reply_task_approval",
                            platform: "twitter",
                            prospectId,
                          }}
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
                        {renderDraftSyncStatusLine(taskDraftHelperText)}
                        <XReplyFallbackAlert
                          postId={originalTweetId}
                          authorHandle={
                            data.originalPost?.postRef?.authorHandle ??
                            data.originalPost?.postSummary?.author?.handle
                          }
                        />
                      </div>
                    )}
                  />
                ) : (
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

                    {mode === "approval" ? null : (
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
