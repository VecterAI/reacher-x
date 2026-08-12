"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import type { SerializedEditorState } from "lexical";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageContent } from "@/features/webapp/ui/components/page/PageContent";
import { PageHeader } from "@/features/webapp/ui/components/page/PageHeader";
import { PageLayout } from "@/features/webapp/ui/components/page/PageLayout";
import { useViewerXComposerIdentity } from "@/features/composer/hooks/useViewerXComposerIdentity";
import { buildSerializedTextState } from "@/features/composer/lib/buildSerializedTextState";
import { BaseComposer } from "@/features/composer/ui/components/BaseComposer";
import {
  DM_COMPOSER_CONTENT_EDITABLE_CLASS,
  DM_COMPOSER_PLACEHOLDER_CLASS,
} from "@/features/composer/ui/dmComposerClasses";
import { formatDmMessageTime } from "../../lib/formatDmMessageTime";
import { mergeXChatConversationMessages } from "../../lib/xChatConversationMessages";
import { useProspectDmPanel } from "../../hooks/useProspectDmPanel";
import { ConversationHistoryPagination } from "./ConversationHistoryPagination";
import { XChatConversationUnlock } from "./XChatConversationUnlock";
import { XDmConversationMenu } from "./XDmConversationMenu";
import { Button } from "@/shared/ui/components/Button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Spinner } from "@/shared/ui/components/Spinner";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { ProspectPlatformAvatar } from "@/shared/ui/components/ProspectPlatformAvatar";
import { MessageBubble } from "@/shared/ui/components/MessageBubble";
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
import type { XDmAttachmentSummary, XDmMessage } from "@/shared/lib/twitter/dm";
import type {
  ComposerInitialMediaUpload,
  ComposerMediaKind,
} from "@/features/composer/types";
import { XDmAttachmentGallery } from "./XDmAttachmentGallery";
import { useXChatBrowserSession } from "@/features/agent/lib/xChatBrowserSession";

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
  const {
    data,
    loading,
    isRefreshing,
    isLoadingOlder,
    loadOlderError,
    error,
    loadOlder,
    send,
    cancel,
    actionRequestStatus,
    isPendingApproval,
    isSendingActionRequest,
  } = useProspectDmPanel({
    prospectId,
    actionRequestId,
    enabled: Boolean(prospectId),
  });
  const xChatSession = useXChatBrowserSession({
    prospectId,
    participantUserId: data?.participantUserId,
  });
  const updatePendingActionRequestDraft = useMutation(
    api.socialActions.updatePendingActionRequestDraft
  );
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
    ((taskStatus !== "pending" && taskStatus !== "executing") ||
      (taskApprovalUi.submitBlockedByPlan &&
        !taskApprovalUi.planCanBeApproved));

  const handleSend = React.useCallback(
    async (
      content: SerializedEditorState,
      mediaUrls?: string[],
      mediaDescriptions?: string[],
      mediaKinds?: ComposerMediaKind[]
    ) => {
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
        if (!nextText && !(resolvedMediaUrls && resolvedMediaUrls.length > 0)) {
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
            description: "Queued. We'll notify you if X/Twitter blocks it.",
          });
          return;
        }
        await send(nextText, resolvedMediaUrls, resolvedDescriptions);
        setLocalDraftState({
          sourceKey: draftSourceKey,
          serverValue: serverDraft,
          text: "",
        });
        toast.success("DM sent on X/Twitter");
      } catch (err) {
        toast.error("Failed to send DM", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
      }
    },
    [
      approvePlan,
      approveTaskWithEdits,
      data,
      draftSourceKey,
      isTaskApprovalComposer,
      isTaskBacked,
      send,
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

  const shouldDisableComposer =
    !isTaskApprovalComposer &&
    (!data || !data.eligibility.enabled || isSendingActionRequest);
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
              <ProspectPlatformAvatar platform="twitter" badgeSize="sm">
                <Avatar className="ring-border size-8 shrink-0 ring-1">
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
          <ScrollArea className="min-h-0 flex-1" viewportClassName="pb-4">
            <PageContent className="space-y-4 px-4 py-4">
              {loading ? (
                <div
                  role="status"
                  aria-label="Loading X/Twitter conversation"
                  className="flex min-h-48 items-center justify-center"
                >
                  <Spinner variant="circle" className="size-5" />
                </div>
              ) : error ? (
                <div className="rounded-[20px] border px-4 py-3 text-sm">
                  <p className="font-medium">
                    Could not load X/Twitter conversation
                  </p>
                  <p className="text-muted-foreground mt-1">{error}</p>
                </div>
              ) : data ? (
                <>
                  {data.warning ? (
                    <Alert>
                      <AlertTitle>Limited live sync</AlertTitle>
                      <AlertDescription>
                        {data.warning.message}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {isRefreshing ? (
                    <span className="sr-only" aria-live="polite">
                      Refreshing conversation
                    </span>
                  ) : null}
                  <XChatConversationUnlock
                    prospectId={prospectId}
                    participantUserId={data.participantUserId}
                  />
                  {data.history?.boundary === "x_30_day_limit" &&
                  !data.history.hasMore ? (
                    <p className="text-muted-foreground text-center text-xs">
                      Legacy X/Twitter DM history is limited to the past 30
                      days.
                    </p>
                  ) : null}
                  {loadOlderError ? (
                    <p
                      role="alert"
                      className="text-muted-foreground text-center text-xs"
                    >
                      Could not load earlier messages. Try again.
                    </p>
                  ) : null}
                  <ConversationHistoryPagination
                    conversationKey={`${prospectId}:${data.conversationId ?? "pending"}`}
                    messageCount={data.messages.length}
                    hasMore={
                      data.eligibility.enabled && data.history?.hasMore === true
                    }
                    isLoading={isLoadingOlder}
                    loadMoreError={loadOlderError}
                    onLoadMore={() => void loadOlder()}
                  />
                  {renderedMessages.length === 0 ? (
                    <div className="mx-auto flex w-full max-w-sm flex-col items-center px-4 pt-6 text-center">
                      <ProspectPlatformAvatar platform="twitter" badgeSize="lg">
                        <Avatar className="ring-border size-12 shrink-0 ring-1">
                          <AvatarImage
                            src={data.prospect.avatarUrl}
                            alt={data.prospect.displayName}
                          />
                          <AvatarFallback>
                            {data.prospect.displayName.charAt(0).toUpperCase()}
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
                  ) : (
                    <div className="flex flex-col gap-4">
                      {renderedMessages.map((message: XDmMessage) => (
                        <div
                          key={message.id}
                          className={cn(
                            "flex flex-col gap-2",
                            message.direction === "sent"
                              ? "items-end"
                              : "items-start"
                          )}
                        >
                          {message.attachments?.length ? (
                            <XDmAttachmentGallery
                              attachments={message.attachments}
                            />
                          ) : null}
                          {message.text ? (
                            <MessageBubble variant={message.direction}>
                              <div className="wrap-break-word whitespace-pre-wrap">
                                {message.text}
                              </div>
                            </MessageBubble>
                          ) : null}
                          {message.createdAt ? (
                            <div className="text-muted-foreground px-1 text-xs">
                              {formatDmMessageTime(message.createdAt)}
                              {message.direction === "sent" && message.readAt
                                ? " · Read"
                                : ""}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                  {!data.eligibility.enabled ? (
                    <Alert>
                      <AlertTitle>DM unavailable</AlertTitle>
                      <AlertDescription className="space-y-3">
                        <p>{data.eligibility.reasonLabel}</p>
                        {data.eligibility.reasonCode === "missing_connection" ||
                        data.eligibility.reasonCode === "missing_scopes" ? (
                          <div>
                            <Button
                              size="xs"
                              onClick={() =>
                                router.push("/settings/connected-accounts")
                              }
                            >
                              {data.eligibility.reasonCode === "missing_scopes"
                                ? "Reconnect account"
                                : "Connect account"}
                            </Button>
                          </div>
                        ) : null}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </>
              ) : null}
            </PageContent>
          </ScrollArea>

          <div className="bg-background shrink-0 px-4 pt-2 pb-4 backdrop-blur-xl">
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
              toolbarPlacement="bottom"
              showIdentityHeader={false}
              showMediaDescription={false}
              showMediaUpload
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
                remoteAllowedKinds: ["prospect", "post", "attachment"],
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
        </div>
      </PageLayout>
    </aside>
  );
}
