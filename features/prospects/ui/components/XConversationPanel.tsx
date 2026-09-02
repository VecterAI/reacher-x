"use client";

import * as React from "react";
import { getOutboundMessageFailure } from "@/shared/lib/platforms/outboundMessageFailure";
import { useAction, useMutation, useQuery } from "convex/react";
import type { SerializedEditorState } from "lexical";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/features/webapp/ui/components/page/PageHeader";
import { PageLayout } from "@/features/webapp/ui/components/page/PageLayout";
import { useViewerXComposerIdentity } from "@/features/composer/hooks/useViewerXComposerIdentity";
import { buildSerializedTextState } from "@/features/composer/lib/buildSerializedTextState";
import { BaseComposer } from "@/features/composer/ui/components/BaseComposer";
import {
  DM_COMPOSER_CONTENT_EDITABLE_CLASS,
  DM_COMPOSER_PLACEHOLDER_CLASS,
} from "@/features/composer/ui/dmComposerClasses";
import { mergeXChatConversationMessages } from "../../lib/xChatConversationMessages";
import { getOutboundMessageMediaMetadata } from "../../lib/outboundMessageOperations";
import {
  createRevisionRefreshCoordinator,
  shouldRefreshXChatConversationRevision,
} from "../../lib/revisionRefreshCoordinator";
import { useProspectDmPanel } from "../../hooks/useProspectDmPanel";
import { useTwitterConversationTyping } from "../../hooks/useTwitterConversationTyping";
import { ConversationMessageViewport } from "./ConversationMessageViewport";
import { XChatConversationUnlock } from "./XChatConversationUnlock";
import { XDmEligibilityAlert } from "./XDmEligibilityAlert";
import { XDmConversationMenu } from "./XDmConversationMenu";
import { Button } from "@/shared/ui/components/Button";
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
import { extractTwitterUsername } from "@/shared/lib/utils/url/socialProfiles";
import { NewReleasesIcon } from "@/shared/ui/components/icons";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useDebouncedDraftSync } from "@/features/agent/hooks/useDebouncedDraftSync";
import { resolveOutreachTaskApprovalUiState } from "@/shared/lib/outreach/taskApprovalHelpers";
import { resolveTaskDmComposerState } from "@/shared/lib/outreach/taskDmComposerHelpers";
import { X_DM_TEXT_MAX } from "@/shared/lib/twitter/xPostTextLimit";
import type { XDmAttachmentSummary } from "@/shared/lib/twitter/dm";
import type {
  ComposerInitialMediaUpload,
  ComposerMediaKind,
  MediaUpload,
} from "@/features/composer/types";
import { materializeBrowserMediaFile } from "@/features/composer/lib/browserMediaFile";
import {
  appendXChatEventPageInBrowser,
  bindPreparedXChatMessageInBrowser,
  confirmXChatReactionInBrowser,
  confirmXChatTextMessageInBrowser,
  failPendingXChatTextMessageInBrowser,
  getPendingXChatMessageForRetry,
  publishPendingXChatTextMessageInBrowser,
  getXChatRateLimitState,
  getXChatBrowserSession,
  prepareXChatEncryptedMediaInBrowser,
  prepareXChatMediaMessageInBrowser,
  prepareXChatReactionInBrowser,
  preparePersistedXChatReplyMessageInBrowser,
  preparePersistedXChatTextMessageInBrowser,
  publishPreparingXChatMessageInBrowser,
  useXChatBrowserSession,
  useXChatBrowserSessionState,
} from "@/features/agent/lib/xChatBrowserSession";
import { ConversationMessageList } from "./conversation-message/ConversationMessageList";
import { ConversationTypingIndicator } from "./conversation-message/ConversationTypingIndicator";
import { ConversationComposerReplyTarget } from "./conversation-message/ConversationReplyPreview";
import type { RichConversationMessage } from "./conversation-message/types";

export interface XConversationPanelProps {
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
  taskPosted?: {
    messageId?: string;
    mediaUrls?: string[];
    mediaDescriptions?: string[];
  } | null;
  onBack?: () => void;
  /** In-app prospect profile (stack / CRM). */
  onViewProfile?: () => void;
  /** In-app Twitter/X profile — pass resolved handle from DM context (CRM prospect may not have it). */
  onViewTwitterProfile?: (twitterUsername: string) => void;
  className?: string;
}

function isEncryptedXChatMessage(message: RichConversationMessage) {
  return message.id.startsWith("xchat:");
}

function canReactToEncryptedXChatMessage(message: RichConversationMessage) {
  return isEncryptedXChatMessage(message) && Boolean(message.sequenceId);
}

export function XConversationPanel({
  prospectId,
  actionRequestId,
  taskId,
  taskStatus,
  taskMode,
  taskApprovalReady = false,
  taskPlanId,
  taskPlanStatus,
  taskDraft,
  taskPosted,
  onBack,
  onViewProfile,
  onViewTwitterProfile,
  className,
}: XConversationPanelProps) {
  const router = useRouter();
  const { currentUser } = useViewerXComposerIdentity();
  const isTaskBacked = Boolean(taskId);
  const xChatSessionState = useXChatBrowserSessionState(prospectId);
  const {
    data,
    loading,
    isRefreshing,
    isLoadingOlder,
    loadOlderError,
    error,
    loadOlder,
    send,
    retrySend,
    cancel,
    actionRequestStatus,
    isPendingApproval,
    isSendingActionRequest,
    conversationRevisionKey,
    conversationRevisionLoaded,
    conversationRevisionLatestMessageId,
  } = useProspectDmPanel({
    prospectId,
    actionRequestId,
    enabled: Boolean(prospectId),
    refreshContextOnRevision: xChatSessionState.status !== "unlocked",
  });
  const xChatSession = useXChatBrowserSession({
    prospectId,
    viewerUserId: data?.viewerUserId,
    participantUserId: data?.participantUserId,
  });
  const isParticipantTyping = useTwitterConversationTyping({
    prospectId,
    enabled: Boolean(prospectId && data),
  });
  const [scrollToLatestRequest, setScrollToLatestRequest] = React.useState(0);
  const [replyingTo, setReplyingTo] =
    React.useState<RichConversationMessage | null>(null);
  const [xChatOlderLoadState, setXChatOlderLoadState] = React.useState<{
    prospectId: string;
    requestId: number;
    status: "idle" | "loading" | "error";
  }>({ prospectId, requestId: 0, status: "idle" });
  const xChatLoadRequestRef = React.useRef(0);
  const xChatNewestRefreshCoordinatorRef = React.useRef<ReturnType<
    typeof createRevisionRefreshCoordinator
  > | null>(null);
  const observedXChatRevisionRef = React.useRef<{
    prospectId: string;
    revision: string | null;
    latestMessageId: string | null;
  } | null>(null);
  const appliedRealtimeEventPageRef = React.useRef<{
    prospectId: string;
    key: string;
  } | null>(null);
  const isLoadingOlderXChat =
    xChatOlderLoadState.prospectId === prospectId &&
    xChatOlderLoadState.status === "loading";
  const loadOlderXChatError =
    xChatOlderLoadState.prospectId === prospectId &&
    xChatOlderLoadState.status === "error";
  const updatePendingActionRequestDraft = useMutation(
    api.socialActions.updatePendingActionRequestDraft
  );
  const submitXChatEncryptedMessage = useAction(
    api.x.submitXChatEncryptedMessage
  );
  const xChatSendTailsRef = React.useRef(new Map<string, Promise<void>>());
  const submitXChatMessageInOrder = React.useCallback(
    (payload: {
      prospectId: Id<"prospects">;
      clientRequestId: string;
      conversationId: string;
      messageId: string;
      encodedMessageCreateEvent: string;
      encodedMessageEventSignature: string;
      taskId?: Id<"outreachTasks">;
    }) => {
      const queueKey = String(payload.prospectId);
      const previous = xChatSendTailsRef.current.get(queueKey);
      const request = (previous ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => submitXChatEncryptedMessage(payload));
      const tail = request.then(
        () => undefined,
        () => undefined
      );
      xChatSendTailsRef.current.set(queueKey, tail);
      void tail.then(() => {
        if (xChatSendTailsRef.current.get(queueKey) === tail) {
          xChatSendTailsRef.current.delete(queueKey);
        }
      });
      return request;
    },
    [submitXChatEncryptedMessage]
  );
  const generateXChatEncryptedMediaUploadUrl = useMutation(
    api.xChatSendOperations.generateEncryptedMediaUploadUrl
  );
  const uploadXChatEncryptedMedia = useAction(api.x.uploadXChatEncryptedMedia);
  const getXChatEventPage = useAction(api.x.getXChatEventPage);
  const markXChatConversationRead = useAction(api.x.markXChatConversationRead);
  const realtimeXChatEventPage = useQuery(
    api.xChatRealtimeEvents.getForProspect,
    prospectId ? { prospectId: prospectId as Id<"prospects"> } : "skip"
  );
  const getXChatEncryptedMedia = useAction(api.x.getXChatEncryptedMedia);
  const updatePendingTaskDraft = useMutation(
    api.outreach.updatePendingTaskDraft
  );
  const approveTaskWithEdits = useMutation(api.outreach.approveTaskWithEdits);
  const approvePlan = useMutation(api.outreach.approvePlan);
  const profileUrl = data?.prospect.profileUrl;
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
    (isTaskBacked ? taskDraftForComposer?.content : data?.draftText) ?? "";
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

  const initialMediaUploads = React.useMemo<ComposerInitialMediaUpload[]>(
    () =>
      (taskDraftForComposer?.mediaUrls ?? []).map((url, index) => ({
        id: `task-dm-media-${index}`,
        url,
        serverUrl: url,
        type:
          (taskDraftForComposer?.mediaKinds?.[index] ?? "image") === "video"
            ? "video"
            : "image",
        mediaKind: taskDraftForComposer?.mediaKinds?.[index] ?? "image",
        description:
          taskDraftForComposer?.mediaDescriptions?.[index] ?? undefined,
      })),
    [taskDraftForComposer]
  );
  const visiblePanelDraftAttachments = isTaskBacked
    ? undefined
    : data?.draftAttachments;
  const composerResetKey = isTaskBacked
    ? taskComposerState.resetKey
    : `${actionRequestId ?? "live"}:${actionRequestStatus ?? "none"}`;

  const resolvedTwitterUsername = React.useMemo(() => {
    const p = data?.prospect;
    const fromProspect = p?.username?.trim();
    if (fromProspect) return fromProspect.replace(/^@/, "");
    const fromConversation = data?.participantUsername?.trim();
    if (fromConversation) return fromConversation.replace(/^@/, "");
    if (p?.profileUrl) {
      return extractTwitterUsername(p.profileUrl);
    }
    return undefined;
  }, [data]);

  const messagesWithXChat = React.useMemo(
    () => mergeXChatConversationMessages(data?.messages ?? [], xChatSession),
    [data?.messages, xChatSession]
  );
  const isXChatUnlocked =
    xChatSessionState.status === "unlocked" && Boolean(xChatSession);
  const shouldGateConversation =
    data?.eligibility.enabled !== false &&
    xChatSessionState.status !== "unavailable" &&
    !isXChatUnlocked;
  const isInitialXChatCheck =
    xChatSessionState.status === "unknown" ||
    xChatSessionState.status === "checking";

  const renderedMessages = React.useMemo(() => {
    if (!messagesWithXChat.length) {
      return messagesWithXChat;
    }

    if (
      taskMode !== "posted" ||
      !taskPosted?.messageId ||
      !taskPosted.mediaUrls?.length
    ) {
      return messagesWithXChat;
    }

    const taskPostedMediaUrls = taskPosted.mediaUrls;

    return messagesWithXChat.map((message) => {
      if (message.id !== taskPosted.messageId) {
        return message;
      }

      const mergedAttachments = taskPostedMediaUrls.map((mediaUrl, index) => {
        const existingAttachment = message.attachments?.[index];
        return {
          ...existingAttachment,
          type: existingAttachment?.type ?? "image",
          url: existingAttachment?.url ?? mediaUrl,
          previewUrl: existingAttachment?.previewUrl ?? mediaUrl,
          altText:
            existingAttachment?.altText ??
            taskPosted.mediaDescriptions?.[index],
        };
      });

      return {
        ...message,
        attachments:
          mergedAttachments.length > 0
            ? mergedAttachments
            : message.attachments,
      };
    });
  }, [messagesWithXChat, taskMode, taskPosted]);

  const latestReceivedXChatSequenceId = React.useMemo(
    () =>
      renderedMessages
        .toReversed()
        .find(
          (message) =>
            message.direction === "received" &&
            message.id.startsWith("xchat:") &&
            Boolean(message.sequenceId)
        )?.sequenceId,
    [renderedMessages]
  );
  const acknowledgedXChatReadRef = React.useRef<{
    prospectId: string;
    sequenceId: string;
  } | null>(null);
  const xChatReadInFlightRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!isXChatUnlocked || !latestReceivedXChatSequenceId) return;
    const sequenceId = latestReceivedXChatSequenceId;
    const operationKey = `${prospectId}:${sequenceId}`;
    const markReadWhenVisible = () => {
      if (
        document.visibilityState !== "visible" ||
        xChatReadInFlightRef.current === operationKey ||
        (acknowledgedXChatReadRef.current?.prospectId === prospectId &&
          acknowledgedXChatReadRef.current.sequenceId === sequenceId)
      ) {
        return;
      }
      xChatReadInFlightRef.current = operationKey;
      void markXChatConversationRead({
        prospectId: prospectId as Id<"prospects">,
        seenUntilSequenceId: sequenceId,
      })
        .then(() => {
          acknowledgedXChatReadRef.current = { prospectId, sequenceId };
        })
        .catch((readError) => {
          console.warn(
            "[XConversationPanel] Unable to mark XChat conversation read",
            readError instanceof Error ? readError.message : String(readError)
          );
        })
        .finally(() => {
          if (xChatReadInFlightRef.current === operationKey) {
            xChatReadInFlightRef.current = null;
          }
        });
    };

    markReadWhenVisible();
    document.addEventListener("visibilitychange", markReadWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", markReadWhenVisible);
    };
  }, [
    isXChatUnlocked,
    latestReceivedXChatSequenceId,
    markXChatConversationRead,
    prospectId,
  ]);

  const handleLoadOlder = React.useCallback(async () => {
    if (xChatSession?.hasMore) {
      if (!xChatSession.nextCursor || isLoadingOlderXChat) return;
      const requestId = ++xChatLoadRequestRef.current;
      setXChatOlderLoadState({
        prospectId,
        requestId,
        status: "loading",
      });
      try {
        const page = await getXChatEventPage({
          prospectId: prospectId as Id<"prospects">,
          cursor: xChatSession.nextCursor,
        });
        await appendXChatEventPageInBrowser({
          prospectId,
          page,
          getEncryptedMedia: async (mediaHashKey) =>
            await getXChatEncryptedMedia({
              prospectId: prospectId as Id<"prospects">,
              mediaHashKey,
            }),
        });
      } catch (loadError) {
        console.warn(
          "[XConversationPanel] Unable to load older XChat messages",
          loadError instanceof Error ? loadError.message : String(loadError)
        );
        setXChatOlderLoadState((current) =>
          current.requestId === requestId && current.prospectId === prospectId
            ? { ...current, status: "error" }
            : current
        );
      } finally {
        setXChatOlderLoadState((current) =>
          current.requestId === requestId &&
          current.prospectId === prospectId &&
          current.status === "loading"
            ? { ...current, status: "idle" }
            : current
        );
      }
      return;
    }
    await loadOlder();
  }, [
    getXChatEncryptedMedia,
    getXChatEventPage,
    isLoadingOlderXChat,
    loadOlder,
    prospectId,
    xChatSession,
  ]);

  const refreshNewestXChatPage = React.useCallback(async () => {
    const page = await getXChatEventPage({
      prospectId: prospectId as Id<"prospects">,
    });
    await appendXChatEventPageInBrowser({
      prospectId,
      page,
      pagination: "newest",
      getEncryptedMedia: async (mediaHashKey) =>
        await getXChatEncryptedMedia({
          prospectId: prospectId as Id<"prospects">,
          mediaHashKey,
        }),
    });
  }, [getXChatEncryptedMedia, getXChatEventPage, prospectId]);

  const realtimeEventPageKey = realtimeXChatEventPage
    ? `${realtimeXChatEventPage.conversationId}:${realtimeXChatEventPage.events.length}:${realtimeXChatEventPage.events.at(-1)?.id ?? "unknown"}`
    : null;
  const realtimeEventCoversRevision = Boolean(
    conversationRevisionLatestMessageId &&
    realtimeXChatEventPage?.events.some(
      (event) => event.id === conversationRevisionLatestMessageId
    )
  );
  const decryptedSessionCoversRevision = Boolean(
    conversationRevisionLatestMessageId &&
    xChatSession?.loadedEventIds?.includes(conversationRevisionLatestMessageId)
  );
  const latestMessageCoversRevision =
    realtimeEventCoversRevision || decryptedSessionCoversRevision;

  React.useEffect(() => {
    if (
      !isXChatUnlocked ||
      !realtimeXChatEventPage ||
      realtimeXChatEventPage.events.length === 0 ||
      !realtimeEventPageKey
    ) {
      return;
    }
    const applied = appliedRealtimeEventPageRef.current;
    if (
      applied?.prospectId === prospectId &&
      applied.key === realtimeEventPageKey
    ) {
      return;
    }
    appliedRealtimeEventPageRef.current = {
      prospectId,
      key: realtimeEventPageKey,
    };
    void appendXChatEventPageInBrowser({
      prospectId,
      page: {
        ...realtimeXChatEventPage,
        hasMore: false,
      },
      pagination: "newest",
      getEncryptedMedia: async (mediaHashKey) =>
        await getXChatEncryptedMedia({
          prospectId: prospectId as Id<"prospects">,
          mediaHashKey,
        }),
    }).catch((realtimeError) => {
      if (
        appliedRealtimeEventPageRef.current?.prospectId === prospectId &&
        appliedRealtimeEventPageRef.current.key === realtimeEventPageKey
      ) {
        appliedRealtimeEventPageRef.current = null;
      }
      console.warn(
        "[XConversationPanel] Unable to apply realtime XChat event",
        realtimeError instanceof Error
          ? realtimeError.message
          : String(realtimeError)
      );
      if (conversationRevisionKey) {
        xChatNewestRefreshCoordinatorRef.current?.request(
          conversationRevisionKey
        );
      }
    });
  }, [
    conversationRevisionKey,
    getXChatEncryptedMedia,
    isXChatUnlocked,
    prospectId,
    realtimeEventPageKey,
    realtimeXChatEventPage,
  ]);

  React.useEffect(() => {
    const coordinator = createRevisionRefreshCoordinator({
      refresh: refreshNewestXChatPage,
      canRefresh: () => Boolean(getXChatBrowserSession({ prospectId })),
      getRetryAt: (refreshError) =>
        getXChatRateLimitState(refreshError)?.retryAt,
      onError: (refreshError) => {
        console.warn(
          "[XConversationPanel] Unable to refresh XChat messages",
          refreshError instanceof Error
            ? refreshError.message
            : String(refreshError)
        );
      },
    });
    xChatNewestRefreshCoordinatorRef.current = coordinator;
    return () => {
      coordinator.dispose();
      if (xChatNewestRefreshCoordinatorRef.current === coordinator) {
        xChatNewestRefreshCoordinatorRef.current = null;
      }
    };
  }, [prospectId, refreshNewestXChatPage]);

  React.useEffect(() => {
    if (!conversationRevisionLoaded) return;
    const previous = observedXChatRevisionRef.current;
    const current = {
      revision: conversationRevisionKey,
      latestMessageId: conversationRevisionLatestMessageId,
    };
    if (!previous || previous.prospectId !== prospectId) {
      observedXChatRevisionRef.current = {
        prospectId,
        ...current,
      };
      // If the reactive revision first resolves after unlock, the decrypt
      // bundle may predate it. Queue one deduplicated newest-page refresh.
      if (
        isXChatUnlocked &&
        current.revision &&
        shouldRefreshXChatConversationRevision({
          current,
          latestMessageCovered: latestMessageCoversRevision,
        })
      ) {
        xChatNewestRefreshCoordinatorRef.current?.request(current.revision);
      }
      return;
    }

    if (
      previous.revision === conversationRevisionKey ||
      !conversationRevisionKey
    ) {
      return;
    }
    // Keep the last observed revision while locked. When unlock completes this
    // effect runs again and requests the revision that arrived during unlock.
    if (!isXChatUnlocked) return;

    observedXChatRevisionRef.current = {
      prospectId,
      ...current,
    };
    if (
      current.revision &&
      shouldRefreshXChatConversationRevision({
        previous,
        current,
        latestMessageCovered: latestMessageCoversRevision,
      })
    ) {
      xChatNewestRefreshCoordinatorRef.current?.request(current.revision);
    }
  }, [
    conversationRevisionKey,
    conversationRevisionLoaded,
    conversationRevisionLatestMessageId,
    isXChatUnlocked,
    latestMessageCoversRevision,
    prospectId,
  ]);

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
          data?.draftAttachments
            ?.map((attachment: XDmAttachmentSummary) => attachment.url)
            .filter((url: string | undefined): url is string => Boolean(url)) ??
          undefined,
        mediaDescriptions: data?.draftAttachments?.map(
          (attachment: XDmAttachmentSummary) => attachment.altText ?? ""
        ),
      });
    },
  });
  const taskApprovalUi = resolveOutreachTaskApprovalUiState({
    kind: "dm",
    mode: taskMode,
    approvalReady: taskApprovalReady,
    planId: taskPlanId,
    planStatus: taskPlanStatus,
  });
  const shouldDisableTaskSubmit =
    isTaskApprovalComposer &&
    (!data?.eligibility.enabled ||
      (taskStatus !== "pending" && taskStatus !== "executing") ||
      (taskApprovalUi.submitBlockedByPlan &&
        !taskApprovalUi.planCanBeApproved));

  const handleSend = React.useCallback(
    async (
      content: SerializedEditorState,
      mediaUrls?: string[],
      mediaDescriptions?: string[],
      mediaKinds?: ComposerMediaKind[],
      mediaUploads?: MediaUpload[]
    ) => {
      const replyTarget = replyingTo;
      let didClearReplyTarget = false;
      let didTransferMediaPreview = false;
      try {
        const nextText = extractTextFromEditorState(content).trim();
        const resolvedMediaUrls = mediaUrls?.length
          ? mediaUrls
          : isTaskApprovalComposer
            ? taskDraftForComposer?.mediaUrls
            : isTaskBacked
              ? undefined
              : data?.draftAttachments
                  ?.map((attachment: XDmAttachmentSummary) => attachment.url)
                  .filter((url: string | undefined): url is string =>
                    Boolean(url)
                  );
        const resolvedDescriptions = mediaDescriptions?.length
          ? mediaDescriptions
          : isTaskApprovalComposer
            ? taskDraftForComposer?.mediaDescriptions
            : isTaskBacked
              ? undefined
              : data?.draftAttachments?.map(
                  (attachment: XDmAttachmentSummary) => attachment.altText ?? ""
                );
        const resolvedMediaKinds = mediaKinds?.length
          ? mediaKinds
          : isTaskApprovalComposer
            ? taskDraftForComposer?.mediaKinds
            : undefined;
        if (
          !nextText &&
          !(resolvedMediaUrls && resolvedMediaUrls.length > 0) &&
          !mediaUploads?.length
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
          if (isXChatUnlocked) {
            // Validate and persist the exact approved draft before any
            // provider write. The encrypted submit then completes the task
            // only after its durable XChat send ledger reaches `sent`.
            await updatePendingTaskDraft({
              taskId: taskId as Id<"outreachTasks">,
              expectedType: "dm",
              content: nextText,
              mediaUrls: resolvedMediaUrls,
              mediaDescriptions: resolvedDescriptions,
              mediaKinds: resolvedMediaKinds,
            });
          } else {
            await approveTaskWithEdits({
              taskId: taskId as Id<"outreachTasks">,
              expectedType: "dm",
              content: nextText,
              mediaUrls: resolvedMediaUrls,
              mediaDescriptions: resolvedDescriptions,
              mediaKinds: resolvedMediaKinds,
            });
            toast.success("DM approved.", {
              description: "Queued. We'll notify you if X/Twitter blocks it.",
            });
            return;
          }
        }
        if (isXChatUnlocked) {
          if (replyTarget) {
            setReplyingTo(null);
            didClearReplyTarget = true;
          }
          let encryptedMessage;
          const selectedMedia = mediaUploads?.[0]
            ? await materializeBrowserMediaFile(mediaUploads[0])
            : undefined;
          let pendingMessageId: string | undefined;
          let pendingMediaClientRequestId: string | undefined;
          let preparedAttachmentMetadata:
            | {
                mediaKey?: string;
                width?: number;
                height?: number;
                durationMs?: number;
              }
            | undefined;
          if (selectedMedia) {
            const localPreviewUrl = selectedMedia.url;
            if (!localPreviewUrl) {
              throw new Error("The attachment preview is unavailable.");
            }
            const pending = publishPreparingXChatMessageInBrowser({
              prospectId,
              text: nextText,
              attachments: [
                {
                  id: selectedMedia.id,
                  type: selectedMedia.mediaKind,
                  url: localPreviewUrl,
                  previewUrl: localPreviewUrl,
                  fileName: selectedMedia.file.name,
                  mimeType: selectedMedia.file.type,
                  fileSize: selectedMedia.file.size,
                  width: selectedMedia.width,
                  height: selectedMedia.height,
                  durationMs: selectedMedia.durationMs,
                  isGif: selectedMedia.mediaKind === "gif",
                  isVoiceNote: selectedMedia.isVoiceNote,
                  unavailable: false,
                },
              ],
              quotedMessage: replyTarget
                ? {
                    id: replyTarget.id,
                    text: replyTarget.text,
                    direction: replyTarget.direction,
                    attachmentType: replyTarget.attachments?.[0]?.type,
                    attachments: replyTarget.attachments,
                  }
                : undefined,
              objectUrls: [localPreviewUrl],
            });
            pendingMessageId = pending.messageId;
            pendingMediaClientRequestId = pending.clientRequestId;
            didTransferMediaPreview = true;
            setScrollToLatestRequest((request) => request + 1);
          }
          try {
            if (selectedMedia) {
              const encryptedMedia = await prepareXChatEncryptedMediaInBrowser({
                prospectId,
                file: selectedMedia.file,
                durationMs: selectedMedia.durationMs,
              });
              preparedAttachmentMetadata = {
                width: encryptedMedia.width || selectedMedia.width,
                height: encryptedMedia.height || selectedMedia.height,
                durationMs: selectedMedia.durationMs,
              };
              try {
                const uploadUrl = await generateXChatEncryptedMediaUploadUrl({
                  prospectId: prospectId as Id<"prospects">,
                });
                const uploadBuffer = new ArrayBuffer(
                  encryptedMedia.ciphertext.byteLength
                );
                new Uint8Array(uploadBuffer).set(encryptedMedia.ciphertext);
                let uploadResponse: Response;
                try {
                  uploadResponse = await fetch(uploadUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/octet-stream" },
                    body: new Blob([uploadBuffer]),
                  });
                } finally {
                  new Uint8Array(uploadBuffer).fill(0);
                }
                if (!uploadResponse.ok) {
                  throw new Error(
                    "Encrypted X/Twitter Chat media upload failed."
                  );
                }
                const uploaded = (await uploadResponse.json()) as {
                  storageId?: string;
                };
                if (!uploaded.storageId) {
                  throw new Error(
                    "Encrypted X/Twitter Chat media upload was incomplete."
                  );
                }
                const { mediaHashKey } = await uploadXChatEncryptedMedia({
                  prospectId: prospectId as Id<"prospects">,
                  conversationId: encryptedMedia.conversationId,
                  storageId: uploaded.storageId as Id<"_storage">,
                });
                preparedAttachmentMetadata = {
                  ...preparedAttachmentMetadata,
                  mediaKey: mediaHashKey,
                };
                const { ciphertext: _ciphertext, ...mediaDescriptor } =
                  encryptedMedia;
                encryptedMessage = prepareXChatMediaMessageInBrowser({
                  prospectId,
                  text: nextText,
                  mediaHashKey,
                  media: mediaDescriptor,
                  clientRequestId: pendingMediaClientRequestId,
                  replyToMessageId: replyTarget?.id,
                  replyToSequenceId: replyTarget?.sequenceId,
                });
              } finally {
                encryptedMedia.ciphertext.fill(0);
              }
              bindPreparedXChatMessageInBrowser({
                prospectId,
                preparingMessageId: pendingMessageId!,
                message: encryptedMessage,
                attachmentMetadata: preparedAttachmentMetadata,
              });
              pendingMessageId = encryptedMessage.messageId;
            } else {
              encryptedMessage = replyTarget
                ? await preparePersistedXChatReplyMessageInBrowser({
                    prospectId,
                    text: nextText,
                    replyToMessageId: replyTarget.id,
                    replyToSequenceId: replyTarget.sequenceId,
                  })
                : await preparePersistedXChatTextMessageInBrowser({
                    prospectId,
                    text: nextText,
                  });
              publishPendingXChatTextMessageInBrowser({
                prospectId,
                message: encryptedMessage,
                text: nextText,
                quotedMessage: replyTarget
                  ? {
                      id: replyTarget.id,
                      text: replyTarget.text,
                      direction: replyTarget.direction,
                      attachmentType: replyTarget.attachments?.[0]?.type,
                      attachments: replyTarget.attachments,
                    }
                  : undefined,
              });
              pendingMessageId = encryptedMessage.messageId;
              setScrollToLatestRequest((request) => request + 1);
            }
            await submitXChatMessageInOrder({
              prospectId: prospectId as Id<"prospects">,
              ...encryptedMessage,
              ...(isTaskApprovalComposer && taskId
                ? { taskId: taskId as Id<"outreachTasks"> }
                : {}),
            });
          } catch (error) {
            if (pendingMessageId) {
              const failure = getOutboundMessageFailure({
                error,
                platform: "twitter",
              });
              failPendingXChatTextMessageInBrowser({
                prospectId,
                messageId: pendingMessageId,
                errorMessage: failure.message,
              });
            }
            throw error;
          }
          confirmXChatTextMessageInBrowser({
            prospectId,
            message: encryptedMessage,
            text: nextText,
          });
          if (selectedMedia) {
            await refreshNewestXChatPage();
          }
          if (isTaskApprovalComposer) {
            toast.success("DM approved and sent through X/Twitter Chat.");
          }
          setLocalDraftState({
            sourceKey: draftSourceKey,
            serverValue: serverDraft,
            text: "",
          });
          return selectedMedia
            ? { retainMediaObjectUrls: true as const }
            : undefined;
        }
        const sendRequest = send(
          nextText,
          resolvedMediaUrls,
          resolvedDescriptions,
          resolvedMediaKinds,
          mediaUploads?.map((upload) => upload.file.name),
          getOutboundMessageMediaMetadata(mediaUploads)
        );
        // Move to the live edge before the provider response appends the row.
        // MessageScroller then keeps following that self-initiated update.
        setScrollToLatestRequest((request) => request + 1);
        await sendRequest;
        setLocalDraftState({
          sourceKey: draftSourceKey,
          serverValue: serverDraft,
          text: "",
        });
      } catch (err) {
        if (didClearReplyTarget && replyTarget) {
          setReplyingTo((current) => current ?? replyTarget);
        }
        toast.error("Failed to send DM", {
          description: getOutboundMessageFailure({
            error: err,
            platform: "twitter",
          }).message,
        });
        if (didTransferMediaPreview) {
          return { retainMediaObjectUrls: true as const };
        }
        // BaseComposer preserves editor/media state when submission rejects.
        throw err;
      }
    },
    [
      approvePlan,
      approveTaskWithEdits,
      data,
      draftSourceKey,
      isTaskApprovalComposer,
      isTaskBacked,
      isXChatUnlocked,
      generateXChatEncryptedMediaUploadUrl,
      prospectId,
      refreshNewestXChatPage,
      replyingTo,
      send,
      serverDraft,
      submitXChatMessageInOrder,
      uploadXChatEncryptedMedia,
      taskApprovalUi.planCanBeApproved,
      taskApprovalUi.submitBlockedByPlan,
      taskDraftForComposer,
      taskId,
      taskPlanId,
      updatePendingTaskDraft,
    ]
  );

  const handleXChatReaction = React.useCallback(
    async (message: RichConversationMessage, emoji: string) => {
      if (!isXChatUnlocked || !message.sequenceId) return;
      const remove = Boolean(
        message.reactions?.find((reaction) => reaction.emoji === emoji)
          ?.reactedByViewer
      );
      try {
        const encryptedReaction = prepareXChatReactionInBrowser({
          prospectId,
          targetMessageSequenceId: message.sequenceId,
          emoji,
          remove,
        });
        await submitXChatEncryptedMessage({
          prospectId: prospectId as Id<"prospects">,
          ...encryptedReaction,
        });
        confirmXChatReactionInBrowser({
          prospectId,
          targetMessageSequenceId: message.sequenceId,
          emoji,
          remove,
        });
      } catch (reactionError) {
        toast.error("Could not update X/Twitter Chat reaction", {
          description:
            reactionError instanceof Error
              ? reactionError.message
              : "Please try again.",
        });
      }
    },
    [isXChatUnlocked, prospectId, submitXChatEncryptedMessage]
  );

  const handleRetrySend = React.useCallback(
    async (message: RichConversationMessage) => {
      if (!message.outboundClientRequestId) return;
      try {
        if (message.id.startsWith("xchat:") && isXChatUnlocked) {
          const prepared = getPendingXChatMessageForRetry({
            prospectId,
            clientRequestId: message.outboundClientRequestId,
          });
          if (!prepared) {
            throw new Error(
              "This encrypted retry expired. Check X/Twitter before sending it again."
            );
          }
          publishPendingXChatTextMessageInBrowser({
            prospectId,
            message: prepared,
            text: message.text,
          });
          try {
            await submitXChatMessageInOrder({
              prospectId: prospectId as Id<"prospects">,
              ...prepared,
            });
            confirmXChatTextMessageInBrowser({
              prospectId,
              message: prepared,
              text: message.text,
            });
          } catch (error) {
            const failure = getOutboundMessageFailure({
              error,
              platform: "twitter",
            });
            failPendingXChatTextMessageInBrowser({
              prospectId,
              messageId: prepared.messageId,
              errorMessage: failure.message,
            });
            throw error;
          }
          return;
        }
        await retrySend(message.outboundClientRequestId);
      } catch (error) {
        toast.error("Could not retry DM", {
          description: getOutboundMessageFailure({
            error,
            platform: "twitter",
          }).message,
        });
      }
    },
    [isXChatUnlocked, prospectId, retrySend, submitXChatMessageInOrder]
  );

  const handleCancelDraft = React.useCallback(async () => {
    if (isTaskBacked) {
      return;
    }
    await cancel();
    toast.success("Draft cancelled");
  }, [cancel, isTaskBacked]);

  const shouldDisableComposer =
    !data || !data.eligibility.enabled || isSendingActionRequest;
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
    <XDmConversationMenu
      profileUrl={profileUrl}
      resolvedTwitterUsername={resolvedTwitterUsername}
      onViewTwitterProfile={onViewTwitterProfile}
      onViewProfile={onViewProfile}
    />
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
          title={data?.prospect.displayName ?? "X/Twitter DM"}
          titleLeading={
            data ? (
              <ProspectPlatformAvatar platform="twitter" badgeSize="xs">
                <Avatar className="ring-border size-7 shrink-0 ring-1">
                  <AvatarImage
                    src={data.prospect.avatarUrl}
                    alt={data.prospect.displayName}
                  />
                  <AvatarFallback>
                    {data.prospect.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </ProspectPlatformAvatar>
            ) : null
          }
          titleSuffix={
            data?.prospect.verified ? (
              <NewReleasesIcon
                className="mr-0.5 size-3 shrink-0 fill-current"
                aria-hidden="true"
              />
            ) : null
          }
          onBack={onBack}
          actions={headerActions}
        />
        <div className="flex min-h-0 flex-1 flex-col">
          <XChatConversationUnlock
            prospectId={prospectId}
            viewerUserId={data?.viewerUserId}
            participantUserId={data?.participantUserId}
            recipientName={data?.prospect.displayName}
            recipientUsername={resolvedTwitterUsername}
            senderUsername={currentUser.screenName}
            className={cn(
              (!data || !shouldGateConversation || isInitialXChatCheck) &&
                "hidden"
            )}
          />
          {loading || (data && isInitialXChatCheck) ? (
            <div
              role="status"
              aria-label="Loading X/Twitter conversation"
              className="flex min-h-48 flex-1 items-center justify-center"
            >
              <Spinner variant="circle" className="size-5" />
            </div>
          ) : error ? (
            <div className="m-4 rounded-[20px] border px-4 py-3 text-sm">
              <p className="font-medium">
                Could not load X/Twitter conversation
              </p>
              <p className="text-muted-foreground mt-1">{error}</p>
            </div>
          ) : data ? (
            shouldGateConversation ? null : (
              <>
                {isRefreshing ? (
                  <span className="sr-only" aria-live="polite">
                    Refreshing conversation
                  </span>
                ) : null}
                <ConversationMessageViewport
                  conversationKey={`${prospectId}:${data.conversationId ?? "pending"}`}
                  messageCount={renderedMessages.length}
                  historyRequestKey={
                    xChatSession?.hasMore
                      ? xChatSession.nextCursor
                      : data.history?.nextCursor
                  }
                  hasMore={
                    data.eligibility.enabled &&
                    (xChatSession?.hasMore === true ||
                      data.history?.hasMore === true)
                  }
                  isLoadingOlder={isLoadingOlder || isLoadingOlderXChat}
                  loadOlderError={loadOlderError || loadOlderXChatError}
                  onLoadOlder={() => void handleLoadOlder()}
                  scrollToLatestRequest={scrollToLatestRequest}
                >
                  {data.history?.boundary === "x_30_day_limit" &&
                  !data.history.hasMore ? (
                    <MessageScrollerItem messageId="legacy-history-boundary">
                      <p className="text-muted-foreground mb-4 text-center text-xs">
                        Legacy X/Twitter DM history is limited to the past 30
                        days.
                      </p>
                    </MessageScrollerItem>
                  ) : null}
                  {renderedMessages.length === 0 ? (
                    <MessageScrollerItem messageId="conversation-empty">
                      <div className="mx-auto flex w-full max-w-sm flex-col items-center px-4 pt-6 text-center">
                        <ProspectPlatformAvatar
                          platform="twitter"
                          badgeSize="lg"
                        >
                          <Avatar className="ring-border size-12 shrink-0 ring-1">
                            <AvatarImage
                              src={data.prospect.avatarUrl}
                              alt={data.prospect.displayName}
                            />
                            <AvatarFallback>
                              {data.prospect.displayName
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </ProspectPlatformAvatar>
                        <div className="mt-2 min-w-0">
                          <div className="flex min-w-0 items-center justify-center gap-0.5 overflow-hidden">
                            <h2
                              className="text-foreground truncate text-sm font-medium"
                              title={data.prospect.displayName}
                            >
                              {data.prospect.displayName}
                            </h2>
                            {data.prospect.verified ? (
                              <NewReleasesIcon
                                className="mr-0.5 size-3.5 shrink-0 fill-current"
                                aria-hidden="true"
                              />
                            ) : null}
                          </div>
                          {data.prospect.title ? (
                            <p className="text-muted-foreground mt-0.5 text-sm">
                              {data.prospect.title}
                            </p>
                          ) : null}
                        </div>
                        {onViewTwitterProfile && resolvedTwitterUsername ? (
                          <Button
                            variant="outline"
                            size="xs"
                            className="mt-2"
                            onClick={() =>
                              onViewTwitterProfile(resolvedTwitterUsername)
                            }
                          >
                            View X/Twitter profile
                          </Button>
                        ) : null}
                      </div>
                    </MessageScrollerItem>
                  ) : (
                    <ConversationMessageList
                      scrollerItems
                      prospectId={prospectId}
                      messages={renderedMessages}
                      platform="twitter"
                      participantAvatarUrl={data.prospect.avatarUrl}
                      participantName={data.prospect.displayName}
                      onReply={isXChatUnlocked ? setReplyingTo : undefined}
                      canReplyToMessage={isEncryptedXChatMessage}
                      onReactionClick={
                        isXChatUnlocked ? handleXChatReaction : undefined
                      }
                      canReactToMessage={canReactToEncryptedXChatMessage}
                      onRetry={handleRetrySend}
                    />
                  )}
                  {isParticipantTyping ? (
                    <MessageScrollerItem
                      messageId="twitter-conversation-typing"
                      scrollAnchor
                    >
                      <ConversationTypingIndicator
                        participantAvatarUrl={data.prospect.avatarUrl}
                        participantName={data.prospect.displayName}
                      />
                    </MessageScrollerItem>
                  ) : null}
                  {!data.eligibility.enabled ? (
                    <MessageScrollerItem messageId="conversation-unavailable">
                      <XDmEligibilityAlert
                        eligibility={data.eligibility}
                        onManageAccount={() =>
                          router.push("/settings/connected-accounts")
                        }
                      />
                    </MessageScrollerItem>
                  ) : null}
                </ConversationMessageViewport>
              </>
            )
          ) : null}

          {data && !shouldGateConversation ? (
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
                          : data.prospect.displayName,
                      attachmentType: replyingTo.attachments?.[0]?.type,
                      attachments: replyingTo.attachments,
                      sharedPost: replyingTo.sharedPost,
                    }}
                    participantName={data.prospect.displayName}
                    onDismiss={() => setReplyingTo(null)}
                  />
                </div>
              ) : null}
              {visiblePanelDraftAttachments?.length ? (
                <div className="mb-3 grid gap-2">
                  {visiblePanelDraftAttachments.map(
                    (attachment: XDmAttachmentSummary, index: number) => (
                      <div
                        key={`${attachment.url ?? "draft-attachment"}-${index}`}
                        className="bg-muted/30 border-border overflow-hidden rounded-2xl border"
                      >
                        {attachment.previewUrl || attachment.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={attachment.previewUrl ?? attachment.url}
                            alt={attachment.altText ?? "Draft DM attachment"}
                            className="block h-auto w-full object-cover"
                          />
                        ) : null}
                      </div>
                    )
                  )}
                </div>
              ) : null}
              <BaseComposer
                key={`x-dm-composer:${prospectId}:${composerResetKey}`}
                currentUser={currentUser}
                initialContent={buildSerializedTextState(currentDraftText)}
                initialMediaUploads={initialMediaUploads}
                placeholder="Type here."
                maxLength={X_DM_TEXT_MAX}
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
                deferMediaUpload={isXChatUnlocked}
                allowedMediaKinds={["image", "gif", "video"]}
                voiceNotePlatform={
                  isXChatUnlocked && !isTaskApprovalComposer
                    ? "twitter"
                    : undefined
                }
                maxAttachments={1}
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
                  surfaceLabel: "x_dm_composer",
                  platform: "twitter",
                  prospectId,
                  maxLength: X_DM_TEXT_MAX,
                  characterCountMode: "raw",
                }}
                entityMentions={{
                  prospectId,
                  attachmentDestination: {
                    platform: "twitter",
                    surface: "dm",
                  },
                  remoteAllowedKinds: isXChatUnlocked
                    ? ["prospect", "post"]
                    : ["prospect", "post", "attachment"],
                  personTextMode: "handle",
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
          ) : null}
        </div>
      </PageLayout>
    </aside>
  );
}
