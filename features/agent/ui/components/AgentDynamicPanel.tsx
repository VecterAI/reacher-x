"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Button } from "@/shared/ui/components/Button";
import { BaseComposer } from "@/features/composer/ui/components/BaseComposer";
import { ComposerSurfaceSkeleton } from "@/features/composer/ui/components/ComposerSurfaceSkeleton";
import { ReplyComposer } from "@/features/composer/ui/components/ReplyComposer";
import type {
  ComposerInitialMediaUpload,
  ComposerMediaKind,
} from "@/features/composer/types";
import { XReplyFallbackAlert } from "@/features/composer/ui/components/XReplyFallbackAlert";
import { Tweet, TweetSkeleton } from "@/features/webapp/ui/components/tweet";
import {
  LinkedInCommentItem,
  LinkedInPostCard,
  LinkedInPostCardSkeleton,
  LinkedInReplyComposer,
} from "@/features/webapp/ui/components/linkedin";
import { XConversationPanel } from "@/features/prospects/ui/components/XConversationPanel";
import { LinkedInConversationPanel } from "@/features/prospects/ui/components/LinkedInConversationPanel";
import { ThreadAwareTwitterReplyBody } from "@/features/prospects/ui/components/ThreadAwareTwitterReplyBody";
import type { Tweet as TweetType } from "@/features/threads/types";
import { normalizeLinkedInPost } from "@/shared/lib/linkedin/post";
import { buildLinkedInCommentPreview } from "@/shared/lib/linkedin/comments";
import { buildPostMentionEntity } from "@/shared/lib/mentions/postMentions";
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
import { resolveOutreachTaskApprovalUiState } from "@/shared/lib/outreach/taskApprovalHelpers";

export interface AgentDynamicPanelProps {
  prospectId: string;
  taskId?: string | null;
  actionRequestId?: string | null;
  targetTweetId?: string | null;
  requestedMode?: AgentPanelMode | null;
  requestedKind?: "post" | "dm";
  requestedDmPlatform?: "twitter" | "linkedin" | null;
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
  onResolvedTaskId?: (taskId: string, targetTweetId?: string | null) => void;
  onResolvedMode?: (mode: AgentPanelMode) => void;
  onMismatchedTaskTarget?: () => void;
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
    explicitKind === "video" ||
    explicitKind === "file"
  ) {
    return explicitKind;
  }

  if (isGifUrl(url)) {
    return "gif";
  }
  return isVideoUrl(url) ? "video" : "image";
}

function ConversationPanelLoadingSkeleton({
  onBack,
  className,
}: {
  onBack: () => void;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-[520px] flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="flex h-full max-w-[520px] flex-col md:w-full md:max-w-[520px]">
        <PageHeader title="Messages" onBack={onBack} />
        <ScrollArea className="min-h-0 flex-1" viewportClassName="pb-4">
          <PageContent className="space-y-4 px-4 py-4">
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-10 w-3/5 self-start rounded-[20px]" />
                <Skeleton className="h-6 w-2/5 self-start rounded-[20px]" />
              </div>
              <div className="flex flex-col gap-1">
                <Skeleton className="bg-foreground/10 h-10 w-1/2 self-end rounded-[20px]" />
              </div>
              <div className="flex flex-col gap-1">
                <Skeleton className="h-10 w-4/5 self-start rounded-[20px]" />
                <Skeleton className="h-6 w-2/5 self-start rounded-[20px]" />
              </div>
              <div className="flex flex-col gap-1">
                <Skeleton className="bg-foreground/10 h-10 w-3/5 self-end rounded-[20px]" />
                <Skeleton className="bg-foreground/10 h-6 w-1/3 self-end rounded-[20px]" />
              </div>
              <div className="flex flex-col gap-1">
                <Skeleton className="h-10 w-1/2 self-start rounded-[20px]" />
              </div>
            </div>
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}

function PostPanelLoadingSkeleton({
  platform,
  mode,
}: {
  platform: "twitter" | "linkedin";
  mode: AgentPanelMode;
}) {
  const showComposer = mode === "approval";

  return (
    <div className="space-y-4 px-4">
      {platform === "linkedin" ? (
        <LinkedInPostCardSkeleton />
      ) : (
        <TweetSkeleton showThread={true} />
      )}

      {showComposer ? (
        <ComposerSurfaceSkeleton submitLabel="Approve" />
      ) : platform === "linkedin" ? (
        <LinkedInPostCardSkeleton />
      ) : (
        <TweetSkeleton showThread={true} hideThreadLine />
      )}
    </div>
  );
}

function ComposerSectionLoadingSkeleton() {
  return (
    <div className="mx-4 space-y-3">
      <ComposerSurfaceSkeleton submitLabel="Approve" />
    </div>
  );
}

function TwitterApprovalLoadingState({
  submitLabel = "Approve",
}: {
  submitLabel?: string;
}) {
  return (
    <div className="space-y-4 px-4">
      <TweetSkeleton showThread={true} />
      <ComposerSurfaceSkeleton submitLabel={submitLabel} />
    </div>
  );
}

export function AgentDynamicPanel({
  prospectId,
  taskId,
  actionRequestId,
  targetTweetId,
  requestedMode,
  requestedKind = "post",
  requestedDmPlatform,
  fallbackPost,
  onViewProfile,
  onViewTwitterProfile,
  onClose,
  onResolvedTaskId,
  onResolvedMode,
  onMismatchedTaskTarget,
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
  const [currentDraftText, setCurrentDraftText] = useState("");
  const isDraftEditorFocusedRef = useRef(false);
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
  const approvePlan = useMutation(api.outreach.approvePlan);
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
      onResolvedTaskId(
        taskPanelData.resolvedTaskId,
        taskPanelData.targetTweetId ?? null
      );
      return;
    }

    if (
      isActionRequestPanel ||
      !taskId ||
      !targetTweetId ||
      taskPanelDataQuery.isPending ||
      taskPanelDataQuery.error ||
      taskPanelData !== null
    ) {
      return;
    }

    onMismatchedTaskTarget?.();
  }, [
    isExplicitDmRequest,
    isActionRequestPanel,
    onMismatchedTaskTarget,
    onResolvedTaskId,
    targetTweetId,
    taskId,
    taskPanelData?.kind,
    taskPanelData?.resolvedTaskId,
    taskPanelData?.targetTweetId,
    taskPanelData,
    taskPanelDataQuery.error,
    taskPanelDataQuery.isPending,
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
  const fallbackLinkedInPost = useMemo(
    () =>
      fallbackPost?.platform === "linkedin"
        ? normalizeLinkedInPost(fallbackPost.postData, {
            fallbackId: targetTweetId ?? undefined,
          })
        : null,
    [fallbackPost, targetTweetId]
  );
  const actionLinkedInPost = useMemo(
    () =>
      actionPanelData?.platform === "linkedin"
        ? normalizeLinkedInPost(actionPanelData.sourcePostData)
        : null,
    [actionPanelData?.platform, actionPanelData?.sourcePostData]
  );
  const taskLinkedInPost = useMemo(
    () =>
      taskPanelPlatform === "linkedin"
        ? normalizeLinkedInPost(taskPanelData?.originalPost?.postData, {
            fallbackId: taskPanelData?.targetTweetId,
          })
        : null,
    [
      taskPanelData?.originalPost?.postData,
      taskPanelData?.targetTweetId,
      taskPanelPlatform,
    ]
  );
  const taskPanelApprovalReady = !isActionRequestPanel
    ? Boolean(taskPanelData?.approvalReady)
    : false;
  const mode: AgentPanelMode =
    resolvedMode === "approval" || resolvedMode === "posted"
      ? resolvedMode
      : requestedMode || "approval";
  const taskApprovalUi =
    !isActionRequestPanel && taskPanelKind === "post"
      ? resolveOutreachTaskApprovalUiState({
          kind: "post",
          platform: taskPanelPlatform,
          mode,
          approvalReady: taskPanelApprovalReady,
          planId: taskPanelData?.planId,
          planStatus: taskPanelData?.planStatus,
        })
      : null;
  const taskSubmitBlockedByPlan = taskApprovalUi?.submitBlockedByPlan ?? false;
  const taskPlanCanBeApproved = taskApprovalUi?.planCanBeApproved ?? false;
  const taskReplySubmitButtonText =
    taskApprovalUi?.submitButtonText ?? "Approve reply";
  const isTaskBackedDmContext = taskPanelKind === "dm";
  const isTaskBackedDmApprovalContext =
    isTaskBackedDmContext && mode === "approval";
  const isLinkedInDmAction =
    actionPanelData?.actionKey === "linkedin_send_message" ||
    actionPanelData?.actionKey ===
      "linkedin_send_message_existing_conversation";
  const isDmPlatformPending =
    isExplicitDmRequest &&
    !actionRequestId &&
    !taskId &&
    requestedDmPlatform !== "twitter" &&
    requestedDmPlatform !== "linkedin";
  const isDmPanel =
    isExplicitDmRequest ||
    taskPanelKind === "dm" ||
    actionPanelData?.actionKey === "send_dm" ||
    actionPanelData?.actionKey === "send_dm_in_existing_conversation" ||
    isLinkedInDmAction;

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

    return mediaUrls.map((url: string, index: number) => {
      const mediaKind = resolveMediaKind(mediaKinds[index], url);
      return {
        id: `${isActionRequestPanel ? "action" : "task"}-draft-media-${index}`,
        url,
        serverUrl: url,
        type:
          mediaKind === "video"
            ? "video"
            : mediaKind === "file"
              ? "file"
              : "image",
        mediaKind,
        description: mediaDescriptions[index] || undefined,
      };
    });
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
    if (isDraftEditorFocusedRef.current) {
      return;
    }
    setCurrentDraftText(persistedDraftText);
  }, [persistedDraftText]);

  useEffect(() => {
    isDraftEditorFocusedRef.current = false;
  }, [actionRequestId, targetTweetId, taskId]);

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
          mediaUrls: actionPanelData?.mediaUrls,
          mediaDescriptions: actionPanelData?.mediaDescriptions,
          mediaKinds: actionPanelData?.mediaKinds,
        });
        return;
      }

      await updatePendingTaskDraft({
        taskId: taskPanelData?.resolvedTaskId as Id<"outreachTasks">,
        expectedType: "comment",
        content: nextValue,
        mediaUrls: taskPanelData?.draft?.mediaUrls,
        mediaDescriptions: taskPanelData?.draft?.mediaDescriptions,
        mediaKinds: taskPanelData?.draft?.mediaKinds,
      });
    },
  });
  const inlineDraftStatus =
    draftSync.status === "saving" ? (
      <span className="text-muted-foreground text-xs">Saving</span>
    ) : draftSync.status === "error" ? (
      <span
        className="block w-full truncate text-xs text-amber-600"
        title="Draft sync failed. We'll retry on your next edit."
      >
        Draft sync failed. We&apos;ll retry on your next edit.
      </span>
    ) : null;
  const shouldRenderDraftStatusSlot =
    mode === "approval" &&
    (Boolean(actionPanelData?.actionRequestId) ||
      Boolean(taskPanelData?.resolvedTaskId));
  const draftStatusSlot =
    shouldRenderDraftStatusSlot && inlineDraftStatus
      ? inlineDraftStatus
      : undefined;

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
  const queuedApprovalDescription = useMemo(() => {
    const platform = isActionRequestPanel
      ? actionPanelData?.platform
      : taskPanelPlatform;
    return platform === "linkedin"
      ? "Queued. We'll notify you if LinkedIn blocks it."
      : "Queued. We'll notify you if X blocks it.";
  }, [actionPanelData?.platform, isActionRequestPanel, taskPanelPlatform]);

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

        if (
          !isActionRequestPanel &&
          taskPanelData?.kind === "post" &&
          mode === "approval" &&
          !taskPanelData.approvalReady &&
          taskPanelData.planStatus === "draft" &&
          taskPanelData.planId
        ) {
          await updatePendingTaskDraft({
            taskId: taskPanelData.resolvedTaskId as Id<"outreachTasks">,
            expectedType: "comment",
            content: editedText,
            mediaUrls,
            mediaDescriptions,
            mediaKinds,
          });
          await approvePlan({
            planId: taskPanelData.planId as Id<"outreachPlans">,
          });
          toast.success("Plan approved.", {
            description: "The reply will be ready for approval next.",
          });
          return;
        }

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
              description: queuedApprovalDescription,
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
      approvePlan,
      approveTaskWithEdits,
      isActionRequestPanel,
      mode,
      queuedApprovalDescription,
      taskPanelData,
      updatePendingTaskDraft,
    ]
  );

  const panelTitle =
    isActionRequestPanel && actionPanelData?.title
      ? actionPanelData.title
      : mode === "posted"
        ? taskPanelPlatform === "linkedin"
          ? "Posted comment"
          : "Posted reply"
        : "Post";
  const loadingPlatform: "twitter" | "linkedin" =
    fallbackPost?.platform ??
    actionPanelData?.platform ??
    taskPanelPlatform ??
    "twitter";
  const renderFallbackTaskPreview = () => {
    if (!fallbackPost) {
      return null;
    }

    const resolvedFallbackTwitterSummary =
      fallbackPost.platform === "twitter"
        ? (fallbackPost.postSummary ??
          summarizeTwitterPost(fallbackPost.postData))
        : undefined;

    if (
      fallbackPost.platform === "twitter" &&
      (fallbackPost.postRef?.postId ??
        resolvedFallbackTwitterSummary?.ref.postId)
    ) {
      return (
        <ThreadAwareTwitterReplyBody
          tweetId={
            fallbackPost.postRef?.postId ??
            resolvedFallbackTwitterSummary!.ref.postId
          }
          initialTweet={
            resolvedFallbackTwitterSummary
              ? (toFallbackTweetFromSummary(
                  resolvedFallbackTwitterSummary
                ) as TweetType)
              : undefined
          }
          renderLoadingState={() => (
            <TwitterApprovalLoadingState submitLabel="Approve" />
          )}
          renderComposerSection={() => <ComposerSectionLoadingSkeleton />}
        />
      );
    }

    return (
      <div className="space-y-4 px-4">
        {fallbackLinkedInPost ? (
          <LinkedInPostCard
            post={fallbackLinkedInPost}
            prospectId={prospectId}
            showFullContent
            readOnly
          />
        ) : (
          <Alert>
            <AlertTitle>Original LinkedIn post unavailable</AlertTitle>
            <AlertDescription>
              The comment draft is still loading and will remain editable.
            </AlertDescription>
          </Alert>
        )}
        <ComposerSurfaceSkeleton submitLabel="Approve" />
      </div>
    );
  };

  if (isDmPlatformPending) {
    return (
      <ConversationPanelLoadingSkeleton
        onBack={onClose}
        className={className}
      />
    );
  }

  if (isDmPanel) {
    const dmPlatform =
      actionPanelData?.platform === "linkedin" ||
      taskPanelPlatform === "linkedin" ||
      requestedDmPlatform === "linkedin"
        ? "linkedin"
        : "twitter";

    if (dmPlatform === "linkedin") {
      return (
        <LinkedInConversationPanel
          prospectId={prospectId}
          actionRequestId={actionRequestId}
          taskId={
            isTaskBackedDmContext
              ? (taskPanelData?.resolvedTaskId ?? null)
              : null
          }
          taskStatus={
            isTaskBackedDmContext ? taskPanelData?.taskStatus : undefined
          }
          taskMode={mode}
          taskApprovalReady={
            isTaskBackedDmApprovalContext && taskPanelApprovalReady
          }
          taskPlanId={
            isTaskBackedDmApprovalContext
              ? (taskPanelData?.planId ?? null)
              : null
          }
          taskPlanStatus={
            isTaskBackedDmApprovalContext
              ? taskPanelData?.planStatus
              : undefined
          }
          taskDraft={
            isTaskBackedDmApprovalContext
              ? (taskPanelData?.draft ?? undefined)
              : undefined
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
        taskStatus={
          isTaskBackedDmContext ? taskPanelData?.taskStatus : undefined
        }
        taskMode={mode}
        taskApprovalReady={
          isTaskBackedDmApprovalContext && taskPanelApprovalReady
        }
        taskPlanId={
          isTaskBackedDmApprovalContext ? (taskPanelData?.planId ?? null) : null
        }
        taskPlanStatus={
          isTaskBackedDmApprovalContext ? taskPanelData?.planStatus : undefined
        }
        taskDraft={
          isTaskBackedDmApprovalContext
            ? (taskPanelData?.draft ?? undefined)
            : undefined
        }
        taskPosted={
          isTaskBackedDmContext
            ? (taskPanelData?.posted ?? undefined)
            : undefined
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
      const sourceLinkedInPost = actionLinkedInPost;
      const linkedInPostMentionEntities = sourceLinkedInPost
        ? ([
            buildPostMentionEntity({
              post: sourceLinkedInPost,
              platformHint: "linkedin",
              prospectId,
            }),
          ].filter(Boolean) as NonNullable<
            ReturnType<typeof buildPostMentionEntity>
          >[])
        : undefined;
      const postedComment =
        mode === "posted" && isCommentAction && actionPanelData.content
          ? buildLinkedInCommentPreview({
              id:
                actionPanelData.createdTweetId ||
                `posted-${actionPanelData.actionRequestId}`,
              postId: sourceLinkedInPost?.id || "linkedin-post",
              text: actionPanelData.content,
              author: {
                name: composerCurrentUser.name,
                avatarUrl: composerCurrentUser.profileImageUrl,
                isViewer: true,
              },
            })
          : null;

      return (
        <div className="space-y-4 px-4">
          {sourceLinkedInPost ? (
            <LinkedInPostCard
              post={sourceLinkedInPost}
              prospectId={prospectId}
              showFullContent
              readOnly
            />
          ) : null}

          {mode === "approval" && isCommentAction ? (
            <LinkedInReplyComposer
              key={`action-request-comment:${actionPanelData.actionRequestId}`}
              prospectId={prospectId}
              placeholder="Add a comment..."
              submitLabel="Approve"
              initialValue={currentDraftText}
              initialMediaUploads={initialMediaUploads}
              disabled={isSubmitting}
              localMentionEntities={linkedInPostMentionEntities}
              surfaceLabel="linkedin_comment_approval"
              onContentChange={(content) => {
                setCurrentDraftText(extractTextFromEditorState(content).trim());
              }}
              onEditorFocus={() => {
                isDraftEditorFocusedRef.current = true;
              }}
              onEditorBlur={() => {
                isDraftEditorFocusedRef.current = false;
                void draftSync.flushNow();
              }}
              onSubmit={handleSubmit}
              beforeCounterSlot={draftStatusSlot}
            />
          ) : mode === "approval" && isInviteAction ? (
            <div className="rounded-[24px] border p-3">
              <BaseComposer
                key={`action-request-composer:${actionPanelData.actionRequestId}`}
                currentUser={composerCurrentUser}
                initialContent={initialContent}
                initialMediaUploads={initialMediaUploads}
                maxLength={8000}
                characterCountMode="raw"
                submitButtonText="Approve"
                placeholder="Add an invitation note"
                disabled={isSubmitting}
                inlineAutocompleteContext={{
                  surfaceLabel: "linkedin_invite_approval",
                  platform: "linkedin",
                  prospectId,
                  maxLength: 8000,
                  characterCountMode: "raw",
                }}
                entityMentions={{
                  prospectId,
                  remoteAllowedKinds: ["prospect", "attachment"],
                  localEntities: linkedInPostMentionEntities,
                  personTextMode: "label",
                }}
                onContentChange={(content: SerializedEditorState) => {
                  setCurrentDraftText(
                    extractTextFromEditorState(content).trim()
                  );
                }}
                onEditorFocus={() => {
                  isDraftEditorFocusedRef.current = true;
                }}
                onEditorBlur={() => {
                  isDraftEditorFocusedRef.current = false;
                  void draftSync.flushNow();
                }}
                onSubmit={handleSubmit}
                beforeCounterSlot={draftStatusSlot}
              />
            </div>
          ) : null}

          {postedComment ? (
            <div className="border-border/70 border-l pl-4">
              <LinkedInCommentItem
                comment={postedComment}
                sourcePost={sourceLinkedInPost ?? undefined}
                prospectId={prospectId}
                disabled
              />
            </div>
          ) : null}

          {!isCommentAction ? (
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
          ) : null}
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
        renderLoadingState={() => (
          <TwitterApprovalLoadingState submitLabel="Approve" />
        )}
        renderComposerSection={(tweet) => (
          <div className="mx-4 space-y-3">
            <ReplyComposer
              key={`action-request-reply:${actionPanelData.actionRequestId}`}
              prospectId={prospectId}
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
              submitButtonText="Approve"
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
                isDraftEditorFocusedRef.current = true;
              }}
              onEditorBlur={() => {
                isDraftEditorFocusedRef.current = false;
                void draftSync.flushNow();
              }}
              onSubmit={handleSubmit}
              beforeCounterSlot={draftStatusSlot}
            />
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
              fallbackPost && !isActionRequestPanel ? (
                renderFallbackTaskPreview()
              ) : (
                <PostPanelLoadingSkeleton
                  platform={loadingPlatform}
                  mode={mode}
                />
              )
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
                summarizeTwitterPost(fallbackPost.postData)?.ref.postId ??
                fallbackPost.postSummary?.ref.postId) ? (
                <ThreadAwareTwitterReplyBody
                  tweetId={
                    fallbackPost.postRef?.postId ??
                    summarizeTwitterPost(fallbackPost.postData)?.ref.postId ??
                    fallbackPost.postSummary!.ref.postId
                  }
                  initialTweet={
                    (fallbackPost.postSummary ??
                    summarizeTwitterPost(fallbackPost.postData))
                      ? (toFallbackTweetFromSummary(
                          (fallbackPost.postSummary ??
                            summarizeTwitterPost(
                              fallbackPost.postData
                            )) as TwitterPostSummary
                        ) as TweetType)
                      : undefined
                  }
                  renderLoadingState={() => (
                    <TwitterApprovalLoadingState submitLabel="Reply" />
                  )}
                  renderComposerSection={(tweet) => (
                    <div className="mx-4 space-y-3">
                      <ReplyComposer
                        prospectId={prospectId}
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
                <div className="space-y-4 px-4">
                  {fallbackLinkedInPost ? (
                    <LinkedInPostCard
                      post={fallbackLinkedInPost}
                      prospectId={prospectId}
                      showFullContent
                      readOnly
                    />
                  ) : (
                    <Alert>
                      <AlertTitle>
                        Original LinkedIn post unavailable
                      </AlertTitle>
                      <AlertDescription>
                        The saved post could not be reconstructed.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Alert>
                    <AlertTitle>No editable comment draft found</AlertTitle>
                    <AlertDescription>
                      Return to the plan and regenerate this task before
                      approving it.
                    </AlertDescription>
                  </Alert>
                </div>
              )
            ) : (
              (() => {
                const data = taskPanelData!;
                const platform = data.platform;
                const sourceLinkedInPost = taskLinkedInPost;
                const originalTweetSummary = data.originalPost?.postSummary as
                  | TwitterPostSummary
                  | undefined;
                const originalTweetId =
                  data.originalPost?.postRef?.postId ??
                  originalTweetSummary?.ref.postId ??
                  data.targetTweetId;

                if (platform === "linkedin") {
                  const linkedInPostMentionEntities = sourceLinkedInPost
                    ? ([
                        buildPostMentionEntity({
                          post: sourceLinkedInPost,
                          platformHint: "linkedin",
                          prospectId,
                        }),
                      ].filter(Boolean) as NonNullable<
                        ReturnType<typeof buildPostMentionEntity>
                      >[])
                    : undefined;

                  return (
                    <div className="space-y-4 px-4">
                      {sourceLinkedInPost ? (
                        <LinkedInPostCard
                          post={sourceLinkedInPost}
                          prospectId={prospectId}
                          showFullContent
                          readOnly
                        />
                      ) : (
                        <Alert>
                          <AlertTitle>
                            Original LinkedIn post unavailable
                          </AlertTitle>
                          <AlertDescription>
                            You can still review and edit the saved comment
                            draft below.
                          </AlertDescription>
                        </Alert>
                      )}

                      {mode === "approval" ? (
                        <LinkedInReplyComposer
                          key={`task-linkedin-comment:${data.resolvedTaskId}`}
                          prospectId={prospectId}
                          placeholder="Add a comment..."
                          submitLabel={taskReplySubmitButtonText}
                          initialValue={currentDraftText}
                          initialMediaUploads={initialMediaUploads}
                          submitDisabled={
                            taskSubmitBlockedByPlan && !taskPlanCanBeApproved
                          }
                          disabled={isSubmitting}
                          localMentionEntities={linkedInPostMentionEntities}
                          surfaceLabel="linkedin_comment_task_approval"
                          onContentChange={(content) => {
                            setCurrentDraftText(
                              extractTextFromEditorState(content).trim()
                            );
                          }}
                          onEditorFocus={() => {
                            isDraftEditorFocusedRef.current = true;
                          }}
                          onEditorBlur={() => {
                            isDraftEditorFocusedRef.current = false;
                            void draftSync.flushNow();
                          }}
                          onSubmit={handleSubmit}
                          beforeCounterSlot={draftStatusSlot}
                        />
                      ) : data.posted?.text ? (
                        <div className="border-border/70 border-l pl-4">
                          <LinkedInCommentItem
                            comment={buildLinkedInCommentPreview({
                              id:
                                data.posted.messageId ||
                                data.posted.tweetId ||
                                `posted-${data.resolvedTaskId}`,
                              postId:
                                data.targetTweetId ||
                                sourceLinkedInPost?.id ||
                                "linkedin-post",
                              text: data.posted.text,
                              createdAt:
                                postedReplyTweet?.tweet_created_at ?? undefined,
                              author: {
                                name:
                                  data.posted.author?.name ||
                                  composerCurrentUser.name,
                                avatarUrl:
                                  data.posted.author?.profileImageUrl ||
                                  composerCurrentUser.profileImageUrl,
                                isViewer: true,
                              },
                            })}
                            sourcePost={sourceLinkedInPost ?? undefined}
                            prospectId={prospectId}
                            disabled
                          />
                        </div>
                      ) : (
                        <Alert>
                          <AlertTitle>Posted comment unavailable</AlertTitle>
                          <AlertDescription>
                            The comment was posted, but its preview text is
                            unavailable.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  );
                }

                return mode === "approval" && originalTweetId ? (
                  <ThreadAwareTwitterReplyBody
                    tweetId={originalTweetId}
                    initialTweet={
                      originalTweetSummary
                        ? (toFallbackTweetFromSummary(
                            originalTweetSummary
                          ) as TweetType)
                        : undefined
                    }
                    renderLoadingState={() => (
                      <TwitterApprovalLoadingState
                        submitLabel={taskReplySubmitButtonText}
                      />
                    )}
                    renderComposerSection={(tweet) => (
                      <div className="mx-4 space-y-3">
                        <ReplyComposer
                          key={`task-reply:${data.resolvedTaskId}`}
                          prospectId={prospectId}
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
                          submitButtonText={taskReplySubmitButtonText}
                          submitDisabled={
                            taskSubmitBlockedByPlan && !taskPlanCanBeApproved
                          }
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
                            isDraftEditorFocusedRef.current = true;
                          }}
                          onEditorBlur={() => {
                            isDraftEditorFocusedRef.current = false;
                            void draftSync.flushNow();
                          }}
                          onSubmit={handleSubmit}
                          beforeCounterSlot={draftStatusSlot}
                        />
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
