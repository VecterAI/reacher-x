"use client";

import * as React from "react";
import { useAction, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import type { SerializedEditorState } from "lexical";
import { toast } from "sonner";
import { getOutboundMessageFailure } from "@/shared/lib/platforms/outboundMessageFailure";
import { PageHeader } from "@/features/webapp/ui/components/page/PageHeader";
import { PageLayout } from "@/features/webapp/ui/components/page/PageLayout";
import { useViewerXComposerIdentity } from "@/features/composer/hooks/useViewerXComposerIdentity";
import { buildSerializedTextState } from "@/features/composer/lib/buildSerializedTextState";
import { BaseComposer } from "@/features/composer/ui/components/BaseComposer";
import {
  DM_COMPOSER_CONTENT_EDITABLE_CLASS,
  DM_COMPOSER_PLACEHOLDER_CLASS,
} from "@/features/composer/ui/dmComposerClasses";
import { useProspectLinkedInPanel } from "../../hooks/useProspectLinkedInPanel";
import { enrichLinkedInReplyTargetFromAttachmentCache } from "../../hooks/useLinkedInConversationAttachment";
import { getOutboundMessageMediaMetadata } from "../../lib/outboundMessageOperations";
import { ConversationMessageViewport } from "./ConversationMessageViewport";
import { Button } from "@/shared/ui/components/Button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Spinner } from "@/shared/ui/components/Spinner";
import { MessageScrollerItem } from "@/shared/ui/components/MessageScroller";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { ProspectPlatformAvatar } from "@/shared/ui/components/ProspectPlatformAvatar";
import { cn } from "@/shared/lib/utils";
import { extractTextFromEditorState } from "@/shared/lib/utils";
import {
  ContentCopyIcon,
  MoreHorizIcon,
  OpenInNewIcon,
  PersonIcon,
} from "@/shared/ui/components/icons";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useDebouncedDraftSync } from "@/features/agent/hooks/useDebouncedDraftSync";
import { resolveOutreachTaskApprovalUiState } from "@/shared/lib/outreach/taskApprovalHelpers";
import { resolveTaskDmComposerState } from "@/shared/lib/outreach/taskDmComposerHelpers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import type {
  ComposerInitialMediaUpload,
  ComposerMediaKind,
  MediaUpload,
} from "@/features/composer/types";
import type {
  LinkedInConversationAttachmentSummary,
  LinkedInConversationPanelContext,
} from "@/shared/lib/linkedin/conversation";
import {
  isLinkedInConversationFeatureDisabled,
  LINKEDIN_DM_TEXT_MAX,
} from "@/shared/lib/linkedin/conversation";
import { resolveLinkedInRecoveryAction } from "@/shared/lib/linkedin/recovery";
import { ConversationMessageList } from "./conversation-message/ConversationMessageList";
import { ConversationComposerReplyTarget } from "./conversation-message/ConversationReplyPreview";
import type { RichConversationMessage } from "./conversation-message/types";

export interface LinkedInConversationPanelProps {
  prospectId: string;
  actionRequestId?: string | null;
  taskId?: string | null;
  taskStatus?: string;
  taskMode?: "approval" | "posted" | null;
  taskApprovalReady?: boolean;
  taskPlanId?: string | null;
  taskPlanStatus?: string | null;
  taskDraft?: {
    content?: string;
    mediaUrls?: string[];
    mediaDescriptions?: string[];
    mediaKinds?: ComposerMediaKind[];
  };
  onBack?: () => void;
  onViewProfile?: () => void;
  onViewLinkedInProfile?: () => void;
  className?: string;
  previewData?: LinkedInConversationPanelContext;
}

function isVisualAttachment(type?: string) {
  return type === "img" || type === "image" || type === "video";
}

const VOICE_NOTE_UPLOAD_TIMEOUT_MS = 60_000;

export function LinkedInConversationPanel({
  prospectId,
  actionRequestId,
  taskId,
  taskStatus,
  taskMode,
  taskApprovalReady = false,
  taskPlanId,
  taskPlanStatus,
  taskDraft,
  onBack,
  onViewProfile,
  onViewLinkedInProfile,
  className,
  previewData,
}: LinkedInConversationPanelProps) {
  const [scrollToLatestRequest, setScrollToLatestRequest] = React.useState(0);
  const router = useRouter();
  const { currentUser } = useViewerXComposerIdentity();
  const isTaskBacked = Boolean(taskId);
  const isPreview = Boolean(previewData);
  const {
    data,
    loading,
    isRefreshing,
    isLoadingOlder,
    loadOlderError,
    error,
    loadOlder,
    send,
    sendPrepared,
    retrySend,
    reactToMessage,
    pendingReactionMessageIds,
    cancel,
    actionRequestStatus,
    isPendingApproval,
    isSendingActionRequest,
    refetch,
  } = useProspectLinkedInPanel({
    prospectId,
    actionRequestId,
    enabled: Boolean(prospectId) && !isPreview,
  });
  const updatePendingActionRequestDraft = useMutation(
    api.socialActions.updatePendingActionRequestDraft
  );
  const updatePendingTaskDraft = useMutation(
    api.outreach.updatePendingTaskDraft
  );
  const approveTaskWithEdits = useMutation(api.outreach.approveTaskWithEdits);
  const approvePlan = useMutation(api.outreach.approvePlan);
  const generateVoiceNoteUploadUrl = useMutation(
    api.outboundVoiceNotes.generateUploadUrl
  );
  const finalizeVoiceNoteUpload = useAction(
    api.outboundVoiceNotes.finalizeUpload
  );

  const resolvedData = previewData ?? data;
  const resolvedLoading = isPreview ? false : loading;
  const resolvedError = isPreview ? null : error;
  const profileUrl = resolvedData?.prospect.profileUrl;
  const taskComposerState = React.useMemo(
    () =>
      resolveTaskDmComposerState({
        taskId,
        taskMode,
        taskStatus,
        taskDraft,
      }),
    [taskDraft, taskId, taskMode, taskStatus]
  );
  const taskDraftForComposer = taskComposerState.draft;
  const isTaskApprovalComposer = taskComposerState.behavior === "task-approval";
  const serverDraft =
    (isTaskBacked ? taskDraftForComposer?.content : resolvedData?.draftText) ??
    "";
  const draftSourceKey = isTaskBacked
    ? taskComposerState.resetKey
    : `${prospectId}:${actionRequestId ?? "live"}`;
  const [localDraftState, setLocalDraftState] = React.useState<{
    sourceKey: string;
    serverValue: string;
    text: string;
  } | null>(null);
  const currentDraftText =
    localDraftState?.sourceKey === draftSourceKey &&
    localDraftState.serverValue === serverDraft
      ? localDraftState.text
      : serverDraft;
  const [replyingTo, setReplyingTo] =
    React.useState<RichConversationMessage | null>(null);
  const handleReply = React.useCallback(
    (message: RichConversationMessage) => {
      setReplyingTo(
        enrichLinkedInReplyTargetFromAttachmentCache({ message, prospectId })
      );
    },
    [prospectId]
  );
  const messagingRecoveryAction = resolveLinkedInRecoveryAction(
    resolvedData?.eligibility.reasonCode
  );
  const warningRecoveryAction = resolveLinkedInRecoveryAction(
    resolvedData?.warning?.code
  );

  const initialMediaUploads = React.useMemo<ComposerInitialMediaUpload[]>(
    () =>
      (taskDraftForComposer?.mediaUrls ?? []).map((url, index) => {
        const mediaKind = taskDraftForComposer?.mediaKinds?.[index] ?? "image";
        return {
          id: `linkedin-task-dm-media-${index}`,
          url,
          serverUrl: url,
          type:
            mediaKind === "video"
              ? "video"
              : mediaKind === "file"
                ? "file"
                : "image",
          mediaKind,
          description:
            taskDraftForComposer?.mediaDescriptions?.[index] ?? undefined,
        };
      }),
    [taskDraftForComposer]
  );
  const visiblePanelDraftAttachments = isTaskBacked
    ? undefined
    : resolvedData?.draftAttachments;
  const composerResetKey = isTaskBacked
    ? taskComposerState.resetKey
    : `${actionRequestId ?? "live"}:${actionRequestStatus ?? "none"}`;

  const draftSync = useDebouncedDraftSync({
    enabled: isTaskBacked
      ? isTaskApprovalComposer &&
        Boolean(taskId) &&
        (taskStatus === "pending" || taskStatus === "executing")
      : Boolean(actionRequestId && data && isPendingApproval),
    value: currentDraftText,
    persistedValue: serverDraft,
    onSave: async (nextValue) => {
      if (isTaskApprovalComposer) {
        if (!taskId) {
          return;
        }
        await updatePendingTaskDraft({
          taskId: taskId as Id<"outreachTasks">,
          expectedType: "dm",
          content: nextValue,
          mediaUrls: taskDraftForComposer?.mediaUrls,
          mediaDescriptions: taskDraftForComposer?.mediaDescriptions,
          mediaKinds: taskDraftForComposer?.mediaKinds,
        });
        return;
      }
      if (isTaskBacked) {
        return;
      }
      if (!actionRequestId || !isPendingApproval) {
        return;
      }

      await updatePendingActionRequestDraft({
        actionRequestId: actionRequestId as Id<"agentActionRequests">,
        content: nextValue,
        mediaUrls:
          resolvedData?.draftAttachments
            ?.map(
              (attachment: LinkedInConversationAttachmentSummary) =>
                attachment.url
            )
            .filter((url: string | undefined): url is string => Boolean(url)) ??
          undefined,
        mediaDescriptions: resolvedData?.draftAttachments?.map(
          (attachment: LinkedInConversationAttachmentSummary) =>
            attachment.altText ?? ""
        ),
      });
    },
  });

  const handleCopyProfile = React.useCallback(() => {
    if (!profileUrl) {
      return;
    }
    navigator.clipboard.writeText(profileUrl).then(
      () => toast.success("Copied profile link"),
      () => toast.error("Unable to copy profile link")
    );
  }, [profileUrl]);

  const handleOpenLinkedIn = React.useCallback(() => {
    if (!profileUrl) {
      return;
    }
    window.open(profileUrl, "_blank", "noopener,noreferrer");
  }, [profileUrl]);
  const taskApprovalUi = resolveOutreachTaskApprovalUiState({
    kind: "dm",
    mode: taskMode,
    approvalReady: taskApprovalReady,
    planId: taskPlanId,
    planStatus: taskPlanStatus,
  });
  const shouldDisableTaskSubmit =
    isTaskApprovalComposer &&
    ((taskStatus !== "pending" && taskStatus !== "executing") ||
      (taskApprovalUi.submitBlockedByPlan &&
        !taskApprovalUi.planCanBeApproved));

  const handleSend = React.useCallback(
    async (
      content: SerializedEditorState,
      mediaUrls?: string[],
      mediaDescriptions?: string[],
      mediaKinds?: ComposerMediaKind[],
      completedUploads?: MediaUpload[]
    ) => {
      try {
        const nextText = extractTextFromEditorState(content).trim();
        const resolvedMediaUrls = mediaUrls?.length
          ? mediaUrls
          : isTaskApprovalComposer
            ? taskDraftForComposer?.mediaUrls
            : isTaskBacked
              ? undefined
              : resolvedData?.draftAttachments
                  ?.map(
                    (attachment: LinkedInConversationAttachmentSummary) =>
                      attachment.url
                  )
                  .filter((url: string | undefined): url is string =>
                    Boolean(url)
                  );
        const resolvedDescriptions = mediaDescriptions?.length
          ? mediaDescriptions
          : isTaskApprovalComposer
            ? taskDraftForComposer?.mediaDescriptions
            : isTaskBacked
              ? undefined
              : resolvedData?.draftAttachments?.map(
                  (attachment: LinkedInConversationAttachmentSummary) =>
                    attachment.altText ?? ""
                );
        const resolvedMediaKinds = mediaKinds?.length
          ? mediaKinds
          : isTaskApprovalComposer
            ? taskDraftForComposer?.mediaKinds
            : undefined;

        if (
          !nextText &&
          !(resolvedMediaUrls && resolvedMediaUrls.length > 0) &&
          !completedUploads?.length
        ) {
          return;
        }

        if (isTaskApprovalComposer) {
          if (!taskId) {
            return;
          }
          if (
            taskApprovalUi.submitBlockedByPlan &&
            taskApprovalUi.planCanBeApproved
          ) {
            await updatePendingTaskDraft({
              taskId: taskId as Id<"outreachTasks">,
              expectedType: "dm",
              content: nextText,
              mediaUrls: resolvedMediaUrls,
              mediaDescriptions: resolvedDescriptions,
              mediaKinds: resolvedMediaKinds,
            });
            await approvePlan({
              planId: taskPlanId as Id<"outreachPlans">,
            });
            toast.success("Plan approved.", {
              description: "The DM will be ready for approval next.",
            });
            return;
          }
          await approveTaskWithEdits({
            taskId: taskId as Id<"outreachTasks">,
            expectedType: "dm",
            content: nextText,
            mediaUrls: resolvedMediaUrls,
            mediaDescriptions: resolvedDescriptions,
            mediaKinds: resolvedMediaKinds,
          });
          toast.success("DM approved.", {
            description: "Queued. We'll notify you if LinkedIn blocks it.",
          });
          return;
        }

        const replyTarget = replyingTo;
        setReplyingTo(null);
        try {
          const voiceUpload = completedUploads?.find(
            (upload) => upload.isVoiceNote
          );
          const outboundFileNames = completedUploads?.map(
            (upload) => upload.file.name
          );
          const outboundMetadata =
            getOutboundMessageMediaMetadata(completedUploads);
          if (voiceUpload) {
            if (completedUploads?.length !== 1 || nextText) {
              throw new Error("Send a LinkedIn voice note by itself.");
            }
            const optimisticPreviewUrl = URL.createObjectURL(voiceUpload.file);
            const releaseOptimisticPreview = () =>
              URL.revokeObjectURL(optimisticPreviewUrl);
            const sendRequest = sendPrepared({
              optimisticMessage: {
                text: "",
                mediaUrls: [optimisticPreviewUrl],
                mediaDescriptions: [""],
                mediaKinds: ["file"],
                mediaFileNames: [voiceUpload.file.name],
                mediaMetadata: [
                  {
                    durationMs: voiceUpload.durationMs,
                    mimeType: voiceUpload.file.type,
                    fileSize: voiceUpload.file.size,
                  },
                ],
                quoteId: replyTarget?.id,
              },
              prepare: async () => {
                const upload = await generateVoiceNoteUploadUrl({
                  prospectId: prospectId as Id<"prospects">,
                });
                const uploadResponse = await fetch(upload.uploadUrl, {
                  method: "POST",
                  headers: { "Content-Type": voiceUpload.file.type },
                  body: voiceUpload.file,
                  signal: AbortSignal.timeout(VOICE_NOTE_UPLOAD_TIMEOUT_MS),
                });
                if (!uploadResponse.ok) {
                  throw new Error("Voice note upload failed. Try again.");
                }
                const uploaded = (await uploadResponse.json()) as {
                  storageId?: string;
                };
                if (!uploaded.storageId) {
                  throw new Error(
                    "Voice note upload was incomplete. Try again."
                  );
                }
                const staged = await finalizeVoiceNoteUpload({
                  prospectId: prospectId as Id<"prospects">,
                  storageId: uploaded.storageId as Id<"_storage">,
                  uploadIntentId: upload.uploadIntentId,
                });
                return {
                  text: "",
                  mediaUrls: [staged.mediaUrl],
                  mediaDescriptions: [""],
                  mediaKinds: ["file"],
                  mediaFileNames: [staged.fileName],
                  mediaMetadata: [
                    {
                      durationMs: staged.durationMs,
                      mimeType: staged.mimeType,
                      fileSize: staged.fileSize,
                    },
                  ],
                  voiceNoteCacheId: staged.cacheId,
                  quoteId: replyTarget?.id,
                };
              },
              releaseOptimisticPreview,
            });
            setScrollToLatestRequest((request) => request + 1);
            await sendRequest;
            setLocalDraftState({
              sourceKey: draftSourceKey,
              serverValue: serverDraft,
              text: "",
            });
            return;
          }
          const sendRequest = send(
            nextText,
            resolvedMediaUrls,
            resolvedDescriptions,
            resolvedMediaKinds,
            outboundFileNames,
            outboundMetadata,
            replyTarget?.id
          );
          setScrollToLatestRequest((request) => request + 1);
          await sendRequest;
          setLocalDraftState({
            sourceKey: draftSourceKey,
            serverValue: serverDraft,
            text: "",
          });
        } catch (error) {
          if (replyTarget) {
            setReplyingTo((current) => current ?? replyTarget);
          }
          throw error;
        }
      } catch (err) {
        toast.error("Failed to send LinkedIn message", {
          description: getOutboundMessageFailure({
            error: err,
            platform: "linkedin",
          }).message,
        });
        throw err;
      }
    },
    [
      approvePlan,
      approveTaskWithEdits,
      draftSourceKey,
      finalizeVoiceNoteUpload,
      generateVoiceNoteUploadUrl,
      isTaskApprovalComposer,
      isTaskBacked,
      resolvedData,
      replyingTo,
      prospectId,
      send,
      sendPrepared,
      serverDraft,
      taskApprovalUi.planCanBeApproved,
      taskApprovalUi.submitBlockedByPlan,
      taskDraftForComposer,
      taskId,
      taskPlanId,
      updatePendingTaskDraft,
    ]
  );

  const handleCancelDraft = React.useCallback(async () => {
    if (isTaskBacked) {
      return;
    }
    await cancel();
    toast.success("Draft cancelled");
  }, [cancel, isTaskBacked]);

  const handleReaction = React.useCallback(
    async (message: RichConversationMessage, emoji: string) => {
      try {
        await reactToMessage(message.id, emoji);
      } catch (reactionError) {
        toast.error("Could not add LinkedIn reaction", {
          description:
            reactionError instanceof Error
              ? reactionError.message
              : "Please try again.",
        });
      }
    },
    [reactToMessage]
  );

  const handleRetrySend = React.useCallback(
    async (message: RichConversationMessage) => {
      if (!message.outboundClientRequestId) return;
      try {
        await retrySend(message.outboundClientRequestId);
      } catch (error) {
        toast.error("Could not retry LinkedIn message", {
          description: getOutboundMessageFailure({
            error,
            platform: "linkedin",
          }).message,
        });
      }
    },
    [retrySend]
  );

  const shouldDisableComposer =
    isPreview ||
    (!isTaskApprovalComposer &&
      (!resolvedData ||
        !resolvedData.eligibility.enabled ||
        isSendingActionRequest));
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
    ) : !isTaskBacked && isPendingApproval && isSendingActionRequest ? (
      <span className="text-muted-foreground text-xs">Sending</span>
    ) : null;
  const shouldRenderDraftStatusSlot =
    isTaskApprovalComposer || isPendingApproval;
  const draftStatusSlot =
    shouldRenderDraftStatusSlot && inlineDraftStatus
      ? inlineDraftStatus
      : undefined;

  const headerActions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="xsIcon" aria-label="Conversation menu">
          <MoreHorizIcon className="fill-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {resolvedData?.prospect.profileUrl ? (
          <DropdownMenuItem
            onClick={onViewLinkedInProfile ?? handleOpenLinkedIn}
          >
            <OpenInNewIcon className="fill-current" aria-hidden />
            View LinkedIn profile
          </DropdownMenuItem>
        ) : null}
        {resolvedData?.prospect.profileUrl ? (
          <DropdownMenuItem onClick={handleCopyProfile}>
            <ContentCopyIcon className="fill-current" aria-hidden />
            Copy profile link
          </DropdownMenuItem>
        ) : null}
        {onViewProfile ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onViewProfile()}>
              <PersonIcon className="fill-current" aria-hidden />
              View profile
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-[520px] flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="flex h-full max-w-[520px] flex-col md:w-full md:max-w-[520px]">
        <PageHeader
          title={resolvedData?.prospect.displayName ?? "LinkedIn messages"}
          titleLeading={
            resolvedData ? (
              <ProspectPlatformAvatar platform="linkedin" badgeSize="xs">
                <Avatar className="ring-border size-7 shrink-0 ring-1">
                  <AvatarImage
                    src={resolvedData.prospect.avatarUrl}
                    alt={resolvedData.prospect.displayName}
                  />
                  <AvatarFallback>
                    {resolvedData.prospect.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </ProspectPlatformAvatar>
            ) : null
          }
          onBack={onBack}
          actions={headerActions}
        />
        <div className="flex min-h-0 flex-1 flex-col">
          {resolvedLoading ? (
            <div
              role="status"
              aria-label="Loading LinkedIn conversation"
              className="flex min-h-48 flex-1 items-center justify-center"
            >
              <Spinner variant="circle" className="size-5" />
            </div>
          ) : resolvedError ? (
            <Alert className="m-4">
              <AlertTitle>Could not load LinkedIn messages</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{resolvedError}</p>
                <div>
                  <Button size="xs" onClick={() => void refetch()}>
                    Retry
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : resolvedData ? (
            <>
              {resolvedData.warning ? (
                <div className="shrink-0 px-4 pt-3">
                  <Alert>
                    <AlertTitle>Limited live sync</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>{resolvedData.warning.message}</p>
                      {warningRecoveryAction ? (
                        <div>
                          <Button
                            size="xs"
                            onClick={() =>
                              router.push(warningRecoveryAction.href)
                            }
                          >
                            {warningRecoveryAction.label}
                          </Button>
                        </div>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : null}
              {isRefreshing ? (
                <span className="sr-only" aria-live="polite">
                  Refreshing conversation
                </span>
              ) : null}
              <ConversationMessageViewport
                conversationKey={`${prospectId}:${resolvedData.conversationId ?? "pending"}`}
                messageCount={resolvedData.messages.length}
                historyRequestKey={resolvedData.history?.nextCursor}
                hasMore={!isPreview && resolvedData.history?.hasMore === true}
                isLoadingOlder={!isPreview && isLoadingOlder}
                loadOlderError={!isPreview && loadOlderError}
                onLoadOlder={() => void loadOlder()}
                scrollToLatestRequest={scrollToLatestRequest}
              >
                {resolvedData.messages.length === 0 ? (
                  <MessageScrollerItem messageId="conversation-empty">
                    <div className="mx-auto flex w-full max-w-sm flex-col items-center px-4 pt-6 text-center">
                      <ProspectPlatformAvatar
                        platform="linkedin"
                        badgeSize="lg"
                      >
                        <Avatar className="ring-border size-12 shrink-0 ring-1">
                          <AvatarImage
                            src={resolvedData.prospect.avatarUrl}
                            alt={resolvedData.prospect.displayName}
                          />
                          <AvatarFallback>
                            {resolvedData.prospect.displayName
                              .charAt(0)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </ProspectPlatformAvatar>
                      <div className="mt-2 min-w-0">
                        <h2
                          className="text-foreground truncate text-sm font-medium"
                          title={resolvedData.prospect.displayName}
                        >
                          {resolvedData.prospect.displayName}
                        </h2>
                        {resolvedData.prospect.title ? (
                          <p className="text-muted-foreground mt-0.5 text-sm">
                            {resolvedData.prospect.title}
                          </p>
                        ) : null}
                      </div>
                      {resolvedData.prospect.profileUrl ? (
                        <Button
                          variant="outline"
                          size="xs"
                          className="mt-2"
                          onClick={onViewLinkedInProfile ?? handleOpenLinkedIn}
                        >
                          View LinkedIn profile
                        </Button>
                      ) : null}
                    </div>
                  </MessageScrollerItem>
                ) : (
                  <ConversationMessageList
                    scrollerItems
                    prospectId={prospectId}
                    messages={resolvedData.messages}
                    platform="linkedin"
                    participantAvatarUrl={resolvedData.prospect.avatarUrl}
                    participantName={resolvedData.prospect.displayName}
                    onReply={
                      isLinkedInConversationFeatureDisabled(
                        resolvedData.disabledFeatures,
                        "reply"
                      )
                        ? undefined
                        : handleReply
                    }
                    onReactionClick={
                      isPreview ||
                      isLinkedInConversationFeatureDisabled(
                        resolvedData.disabledFeatures,
                        "reaction"
                      )
                        ? undefined
                        : handleReaction
                    }
                    isReactionPending={(message) =>
                      pendingReactionMessageIds.has(message.id)
                    }
                    onRetry={isPreview ? undefined : handleRetrySend}
                  />
                )}
                {!resolvedData.eligibility.enabled ? (
                  <MessageScrollerItem messageId="conversation-unavailable">
                    <Alert className="mt-2">
                      <AlertTitle>Messaging unavailable</AlertTitle>
                      <AlertDescription className="space-y-3">
                        <p>{resolvedData.eligibility.reasonLabel}</p>
                        {messagingRecoveryAction ? (
                          <div>
                            <Button
                              size="xs"
                              onClick={() =>
                                router.push(messagingRecoveryAction.href)
                              }
                            >
                              {messagingRecoveryAction.label}
                            </Button>
                          </div>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  </MessageScrollerItem>
                ) : null}
              </ConversationMessageViewport>
            </>
          ) : null}

          <div className="bg-background shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
            {replyingTo ? (
              <div className="mb-2">
                <ConversationComposerReplyTarget
                  quote={{
                    id: replyingTo.id,
                    text: replyingTo.text,
                    direction: replyingTo.direction,
                    senderName:
                      replyingTo.direction === "sent"
                        ? "You"
                        : (resolvedData?.prospect.displayName ??
                          "Original message"),
                    attachmentType: replyingTo.attachments?.[0]?.type,
                    attachments: replyingTo.attachments,
                    sharedPost: replyingTo.sharedPost,
                  }}
                  participantName={resolvedData?.prospect.displayName}
                  onDismiss={() => setReplyingTo(null)}
                />
              </div>
            ) : null}
            {visiblePanelDraftAttachments?.length ? (
              <div className="mb-3 grid gap-2">
                {visiblePanelDraftAttachments.map(
                  (
                    attachment: LinkedInConversationAttachmentSummary,
                    index: number
                  ) => (
                    <div
                      key={`${attachment.url ?? "draft-attachment"}-${index}`}
                      className="bg-muted/30 overflow-hidden rounded-2xl border"
                    >
                      {isVisualAttachment(attachment.type) &&
                      (attachment.previewUrl || attachment.url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={attachment.previewUrl ?? attachment.url}
                          alt={attachment.altText ?? "Draft attachment"}
                          className="h-auto w-full object-cover"
                        />
                      ) : (
                        <div className="text-muted-foreground px-3 py-2 text-sm">
                          {attachment.type || "Attachment"}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            ) : null}
            <BaseComposer
              key={`linkedin-dm-composer:${prospectId}:${composerResetKey}`}
              currentUser={currentUser}
              initialContent={buildSerializedTextState(currentDraftText)}
              initialMediaUploads={initialMediaUploads}
              placeholder="Type here."
              maxLength={LINKEDIN_DM_TEXT_MAX}
              characterCountMode="raw"
              submitButtonText={
                isTaskApprovalComposer
                  ? taskApprovalUi.submitButtonText
                  : "Send"
              }
              submitButtonVariant={isTaskApprovalComposer ? "text" : "icon"}
              submitOnEnter={!isTaskApprovalComposer}
              submitMode={isTaskApprovalComposer ? "confirmed" : "optimistic"}
              toolbarPlacement="bottom"
              showIdentityHeader={false}
              showMediaDescription={false}
              showMediaUpload
              allowedMediaKinds={["image", "gif", "video", "file"]}
              voiceNotePlatform={
                isTaskApprovalComposer ? undefined : "linkedin"
              }
              maxAttachments={4}
              disabled={shouldDisableComposer}
              submitDisabled={shouldDisableTaskSubmit}
              toolbarConfig={{
                showBold: false,
                showItalic: false,
                showEmoji: true,
                showMedia: true,
              }}
              showAvatar={false}
              editorAreaClassName="min-h-10 text-sm"
              contentEditableClassName={DM_COMPOSER_CONTENT_EDITABLE_CLASS}
              composerPlaceholderClassName={DM_COMPOSER_PLACEHOLDER_CLASS}
              inlineAutocompleteContext={{
                surfaceLabel: "linkedin_dm_composer",
                platform: "linkedin",
                prospectId,
                maxLength: LINKEDIN_DM_TEXT_MAX,
                characterCountMode: "raw",
              }}
              entityMentions={{
                prospectId,
                attachmentDestination: {
                  platform: "linkedin",
                  surface: "dm",
                },
                remoteAllowedKinds: ["prospect", "post", "attachment"],
                personTextMode: "label",
              }}
              className="rounded-xl border p-2"
              onContentChange={(content) => {
                setLocalDraftState({
                  sourceKey: draftSourceKey,
                  serverValue: serverDraft,
                  text: extractTextFromEditorState(content).trim(),
                });
              }}
              onEditorBlur={() => {
                void draftSync.flushNow();
              }}
              onSubmit={handleSend}
              beforeCounterSlot={draftStatusSlot}
              submitToolbarStart={
                !isTaskBacked && isPendingApproval ? (
                  <>
                    <Button
                      variant="ghost"
                      size="xs"
                      type="button"
                      onClick={handleCancelDraft}
                    >
                      Cancel
                    </Button>
                  </>
                ) : undefined
              }
            />
          </div>
        </div>
      </PageLayout>
    </aside>
  );
}
