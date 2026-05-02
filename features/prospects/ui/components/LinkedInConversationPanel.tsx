"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import type { SerializedEditorState } from "lexical";
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
import { useProspectLinkedInPanel } from "../../hooks/useProspectLinkedInPanel";
import { Button } from "@/shared/ui/components/Button";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { ProspectPlatformAvatar } from "@/shared/ui/components/ProspectPlatformAvatar";
import { MessageBubble } from "@/shared/ui/components/MessageBubble";
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
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
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
} from "@/features/composer/types";
import type {
  LinkedInConversationAttachmentSummary,
  LinkedInConversationPanelContext,
  LinkedInConversationMessage,
} from "@/shared/lib/linkedin/conversation";

const LINKEDIN_DM_TEXT_MAX = 8000;

export interface LinkedInConversationPanelProps {
  prospectId: string;
  actionRequestId?: string | null;
  taskId?: string | null;
  taskStatus?: string;
  taskMode?: "approval" | "posted" | null;
  taskApprovalReady?: boolean;
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

function formatMessageTime(timestamp?: string) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isVisualAttachment(type?: string) {
  return type === "img" || type === "image" || type === "video";
}

export function LinkedInConversationPanel({
  prospectId,
  actionRequestId,
  taskId,
  taskStatus,
  taskMode,
  taskApprovalReady = false,
  taskDraft,
  onBack,
  onViewProfile,
  onViewLinkedInProfile,
  className,
  previewData,
}: LinkedInConversationPanelProps) {
  const { currentUser } = useViewerXComposerIdentity();
  const isTaskBacked = Boolean(taskId);
  const isPreview = Boolean(previewData);
  const {
    data,
    loading,
    isRefreshing,
    error,
    send,
    cancel,
    actionRequestStatus,
    isPendingApproval,
    isSendingMessage,
    isSendingActionRequest,
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
  const [currentDraftText, setCurrentDraftText] = React.useState("");
  const lastServerDraftRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    lastServerDraftRef.current = undefined;
  }, [prospectId, actionRequestId]);

  const resolvedData = previewData ?? data;
  const resolvedLoading = isPreview ? false : loading;
  const resolvedError = isPreview ? null : error;
  const profileUrl = resolvedData?.prospect.profileUrl;

  React.useEffect(() => {
    const serverDraft =
      (isTaskBacked ? taskDraft?.content : resolvedData?.draftText) ?? "";
    if (lastServerDraftRef.current === serverDraft) {
      return;
    }
    lastServerDraftRef.current = serverDraft;
    setCurrentDraftText(serverDraft);
  }, [isTaskBacked, resolvedData?.draftText, taskDraft?.content]);

  const initialMediaUploads = React.useMemo<ComposerInitialMediaUpload[]>(
    () =>
      (taskDraft?.mediaUrls ?? []).map((url, index) => ({
        id: `linkedin-task-dm-media-${index}`,
        url,
        serverUrl: url,
        type:
          (taskDraft?.mediaKinds?.[index] ?? "image") === "video"
            ? "video"
            : "image",
        mediaKind: taskDraft?.mediaKinds?.[index] ?? "image",
        description: taskDraft?.mediaDescriptions?.[index] ?? undefined,
      })),
    [taskDraft?.mediaDescriptions, taskDraft?.mediaKinds, taskDraft?.mediaUrls]
  );

  const draftSync = useDebouncedDraftSync({
    enabled: isTaskBacked
      ? taskMode === "approval" &&
        Boolean(taskId) &&
        (taskStatus === "pending" || taskStatus === "executing")
      : Boolean(actionRequestId && data && isPendingApproval),
    value: currentDraftText,
    persistedValue: (isTaskBacked ? taskDraft?.content : data?.draftText) ?? "",
    onSave: async (nextValue) => {
      if (isTaskBacked) {
        if (!taskId) {
          return;
        }
        await updatePendingTaskDraft({
          taskId: taskId as Id<"outreachTasks">,
          expectedType: "dm",
          content: nextValue,
        });
        return;
      }
      if (!actionRequestId || !isPendingApproval) {
        return;
      }

      await updatePendingActionRequestDraft({
        actionRequestId: actionRequestId as Id<"agentActionRequests">,
        content: nextValue,
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
          : isTaskBacked
            ? taskDraft?.mediaUrls
            : resolvedData?.draftAttachments
                ?.map(
                  (attachment: LinkedInConversationAttachmentSummary) =>
                    attachment.url
                )
                .filter((url: string | undefined): url is string =>
                  Boolean(url)
                );

        if (!nextText && !(resolvedMediaUrls && resolvedMediaUrls.length > 0)) {
          return;
        }

        if (isTaskBacked) {
          await approveTaskWithEdits({
            taskId: taskId as Id<"outreachTasks">,
            expectedType: "dm",
            content: nextText,
            mediaUrls: resolvedMediaUrls,
            mediaDescriptions,
            mediaKinds,
          });
          toast.success("DM approved.", {
            description: "Sending in background...",
          });
          return;
        }

        await send(nextText, resolvedMediaUrls, mediaDescriptions);
        setCurrentDraftText("");
      } catch (err) {
        toast.error("Failed to send LinkedIn message", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
      }
    },
    [approveTaskWithEdits, isTaskBacked, resolvedData, send, taskDraft, taskId]
  );

  const handleCancelDraft = React.useCallback(async () => {
    if (isTaskBacked) {
      return;
    }
    await cancel();
    toast.success("Draft cancelled");
  }, [cancel, isTaskBacked]);

  const shouldDisableComposer =
    isPreview ||
    (!isTaskBacked &&
      (!resolvedData ||
        !resolvedData.eligibility.enabled ||
        isSendingActionRequest ||
        isSendingMessage)) ||
    Boolean(taskMode === "posted");
  const taskSubmitBlockedByPlan =
    isTaskBacked && taskMode === "approval" && !taskApprovalReady;
  const shouldDisableTaskSubmit =
    isTaskBacked &&
    !(
      taskMode === "approval" &&
      (taskStatus === "pending" || taskStatus === "executing") &&
      taskApprovalReady
    );
  const draftStatusHelperText = taskSubmitBlockedByPlan
    ? "Approve the plan first to send this message."
    : null;
  const shouldRenderDraftStatusSlot = isTaskBacked || isPendingApproval;
  const inlineDraftStatus =
    draftSync.status === "saving" ? (
      <AsciiSpinnerText
        text="Saving"
        className="text-muted-foreground text-xs"
      />
    ) : draftSync.status === "error" ? (
      <span
        className="block w-full truncate text-xs text-amber-600"
        title="Draft sync failed. We'll retry on your next edit."
      >
        Draft sync failed. We&apos;ll retry on your next edit.
      </span>
    ) : !isTaskBacked && isPendingApproval && isSendingActionRequest ? (
      <AsciiSpinnerText
        text="Sending"
        className="text-muted-foreground text-xs"
      />
    ) : draftStatusHelperText ? (
      <span
        className="text-muted-foreground block w-full truncate text-xs"
        title={draftStatusHelperText}
      >
        {draftStatusHelperText}
      </span>
    ) : null;

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
            <DropdownMenuItem onClick={onViewProfile}>
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
              <ProspectPlatformAvatar platform="linkedin" badgeSize="sm">
                <Avatar className="ring-border size-8 shrink-0 ring-1">
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
          <ScrollArea className="min-h-0 flex-1" viewportClassName="pb-4">
            <PageContent className="space-y-4 px-4 py-4">
              {resolvedLoading ? (
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
              ) : resolvedError ? (
                <div className="rounded-[20px] border px-4 py-3 text-sm">
                  <p className="font-medium">
                    Could not load LinkedIn messages
                  </p>
                  <p className="text-muted-foreground mt-1">{resolvedError}</p>
                </div>
              ) : resolvedData ? (
                <>
                  {resolvedData.warning ? (
                    <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
                      <p className="font-medium">Limited live sync</p>
                      <p className="text-muted-foreground mt-1">
                        {resolvedData.warning.message}
                      </p>
                    </div>
                  ) : null}
                  {isRefreshing ? (
                    <p className="text-muted-foreground text-xs">
                      Refreshing conversation…
                    </p>
                  ) : null}
                  {resolvedData.messages.length === 0 ? (
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
                  ) : (
                    <div className="flex flex-col gap-4">
                      {resolvedData.messages.map(
                        (message: LinkedInConversationMessage) => (
                          <div
                            key={message.id}
                            className={cn(
                              "flex flex-col gap-1",
                              message.direction === "sent"
                                ? "items-end"
                                : "items-start"
                            )}
                          >
                            <MessageBubble variant={message.direction}>
                              <div className="flex flex-col gap-2">
                                {message.attachments?.length ? (
                                  <div className="grid gap-2">
                                    {message.attachments.map(
                                      (
                                        attachment: LinkedInConversationAttachmentSummary,
                                        index: number
                                      ) => (
                                        <div
                                          key={`${attachment.url ?? attachment.type}-${index}`}
                                          className="bg-muted/30 order-1 overflow-hidden rounded-2xl border"
                                        >
                                          {isVisualAttachment(
                                            attachment.type
                                          ) &&
                                          (attachment.previewUrl ||
                                            attachment.url) ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                              src={
                                                attachment.previewUrl ??
                                                attachment.url
                                              }
                                              alt={
                                                attachment.altText ??
                                                "LinkedIn attachment"
                                              }
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
                                {message.text ? (
                                  <div className="order-2 wrap-break-word whitespace-pre-wrap">
                                    {message.text}
                                  </div>
                                ) : null}
                              </div>
                            </MessageBubble>
                            {message.createdAt ? (
                              <div className="text-muted-foreground px-1 text-xs">
                                {formatMessageTime(message.createdAt)}
                                {message.direction === "sent" && message.readAt
                                  ? " · Read"
                                  : ""}
                              </div>
                            ) : null}
                          </div>
                        )
                      )}
                    </div>
                  )}
                  {!resolvedData.eligibility.enabled ? (
                    <div className="rounded-[20px] border px-4 py-3 text-sm">
                      <p className="font-medium">Messaging unavailable</p>
                      <p className="text-muted-foreground mt-1">
                        {resolvedData.eligibility.reasonLabel}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}
            </PageContent>
          </ScrollArea>

          <div className="bg-background shrink-0 px-4 pt-2 pb-4 backdrop-blur-xl">
            {resolvedData?.draftAttachments?.length ? (
              <div className="mb-3 grid gap-2">
                {resolvedData.draftAttachments.map(
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
              key={`linkedin-dm-composer:${prospectId}:${actionRequestId ?? "live"}:${actionRequestStatus ?? "none"}`}
              currentUser={currentUser}
              initialContent={buildSerializedTextState(currentDraftText)}
              initialMediaUploads={initialMediaUploads}
              placeholder="Type here."
              maxLength={LINKEDIN_DM_TEXT_MAX}
              characterCountMode="raw"
              submitButtonText="Send"
              submitButtonVariant="icon"
              toolbarPlacement="bottom"
              showIdentityHeader={false}
              showMediaDescription={false}
              showMediaUpload
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
              className="rounded-xl border p-2"
              onContentChange={(content) => {
                setCurrentDraftText(extractTextFromEditorState(content).trim());
              }}
              onEditorBlur={() => {
                void draftSync.flushNow();
              }}
              onSubmit={handleSend}
              afterEmojiSlot={
                shouldRenderDraftStatusSlot ? (
                  <div
                    className="flex h-8 w-28 shrink-0 items-center justify-start overflow-hidden sm:w-40"
                    aria-live="polite"
                  >
                    {inlineDraftStatus ?? (
                      <span className="block w-full" aria-hidden />
                    )}
                  </div>
                ) : undefined
              }
              submitToolbarStart={
                !isTaskBacked && isPendingApproval ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    type="button"
                    onClick={handleCancelDraft}
                  >
                    Cancel
                  </Button>
                ) : undefined
              }
            />
          </div>
        </div>
      </PageLayout>
    </aside>
  );
}
