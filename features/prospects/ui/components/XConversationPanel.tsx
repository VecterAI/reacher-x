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
import { formatDmMessageTime } from "../../lib/formatDmMessageTime";
import { useProspectDmPanel } from "../../hooks/useProspectDmPanel";
import { XDmConversationMenu } from "./XDmConversationMenu";
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
import { extractTwitterUsername } from "@/shared/lib/utils/url/socialProfiles";
import { NewReleasesIcon } from "@/shared/ui/components/icons";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useDebouncedDraftSync } from "@/features/agent/hooks/useDebouncedDraftSync";
import { X_DM_TEXT_MAX } from "@/shared/lib/twitter/xPostTextLimit";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import type { XDmAttachmentSummary, XDmMessage } from "@/shared/lib/twitter/dm";
import type {
  ComposerInitialMediaUpload,
  ComposerMediaKind,
} from "@/features/composer/types";
import { XDmAttachmentGallery } from "./XDmAttachmentGallery";

export interface XConversationPanelProps {
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
  taskDraft,
  taskPosted,
  onBack,
  onViewProfile,
  onViewTwitterProfile,
  className,
}: XConversationPanelProps) {
  const { currentUser } = useViewerXComposerIdentity();
  const isTaskBacked = Boolean(taskId);
  const {
    data,
    loading,
    isRefreshing,
    error,
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
  const updatePendingActionRequestDraft = useMutation(
    api.socialActions.updatePendingActionRequestDraft
  );
  const updatePendingTaskDraft = useMutation(
    api.outreach.updatePendingTaskDraft
  );
  const approveTaskWithEdits = useMutation(api.outreach.approveTaskWithEdits);
  const [currentDraftText, setCurrentDraftText] = React.useState("");
  const profileUrl = data?.prospect.profileUrl;
  const lastServerDraftRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    lastServerDraftRef.current = undefined;
  }, [prospectId, actionRequestId]);

  // Sync local draft only when the server/Convex draft value changes — never when the editor
  // blurs (e.g. emoji popover), or we wipe typed text and the composer resets to stale draft.
  React.useEffect(() => {
    const serverDraft =
      (isTaskBacked ? taskDraft?.content : data?.draftText) ?? "";
    if (lastServerDraftRef.current === serverDraft) {
      return;
    }
    lastServerDraftRef.current = serverDraft;
    setCurrentDraftText(serverDraft);
  }, [data?.draftText, isTaskBacked, taskDraft?.content]);

  const initialMediaUploads = React.useMemo<ComposerInitialMediaUpload[]>(
    () =>
      (taskDraft?.mediaUrls ?? []).map((url, index) => ({
        id: `task-dm-media-${index}`,
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

  const renderedMessages = React.useMemo(() => {
    if (!data?.messages.length) {
      return data?.messages ?? [];
    }

    if (
      taskMode !== "posted" ||
      !taskPosted?.messageId ||
      !taskPosted.mediaUrls?.length
    ) {
      return data.messages;
    }

    const taskPostedMediaUrls = taskPosted.mediaUrls;

    return data.messages.map((message) => {
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
  }, [data, taskMode, taskPosted]);

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
            : data?.draftAttachments
                ?.map((attachment: XDmAttachmentSummary) => attachment.url)
                .filter((url: string | undefined): url is string =>
                  Boolean(url)
                );
        const resolvedDescriptions = mediaDescriptions?.length
          ? mediaDescriptions
          : isTaskBacked
            ? taskDraft?.mediaDescriptions
            : data?.draftAttachments?.map(
                (attachment: XDmAttachmentSummary) => attachment.altText ?? ""
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
            mediaDescriptions: resolvedDescriptions,
            mediaKinds,
          });
          toast.success("DM approved.", {
            description: "Sending in background...",
          });
          return;
        }
        await send(nextText, resolvedMediaUrls, resolvedDescriptions);
        setCurrentDraftText("");
        toast.success("DM sent on X/Twitter");
      } catch (err) {
        toast.error("Failed to send DM", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
      }
    },
    [approveTaskWithEdits, data, isTaskBacked, send, taskDraft, taskId]
  );

  const handleCancelDraft = React.useCallback(async () => {
    if (isTaskBacked) {
      return;
    }
    await cancel();
    toast.success("Draft cancelled");
  }, [cancel, isTaskBacked]);

  const shouldDisableComposer =
    (!isTaskBacked &&
      (!data || !data.eligibility.enabled || isSendingActionRequest)) ||
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
          title={data?.prospect.displayName ?? "X DM"}
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
              ) : error ? (
                <div className="rounded-[20px] border px-4 py-3 text-sm">
                  <p className="font-medium">Could not load X conversation</p>
                  <p className="text-muted-foreground mt-1">{error}</p>
                </div>
              ) : data ? (
                <>
                  {data.warning ? (
                    <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
                      <p className="font-medium">Limited live sync</p>
                      <p className="text-muted-foreground mt-1">
                        {data.warning.message}
                      </p>
                    </div>
                  ) : null}
                  {isRefreshing ? (
                    <p className="text-muted-foreground text-xs">
                      Refreshing conversation…
                    </p>
                  ) : null}
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
                    <div className="rounded-[20px] border px-4 py-3 text-sm">
                      <p className="font-medium">DM unavailable</p>
                      <p className="text-muted-foreground mt-1">
                        {data.eligibility.reasonLabel}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}
            </PageContent>
          </ScrollArea>

          <div className="bg-background shrink-0 px-4 pt-2 pb-4 backdrop-blur-xl">
            {data?.draftAttachments?.length ? (
              <div className="mb-3 grid gap-2">
                {data.draftAttachments.map(
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
              key={`x-dm-composer:${prospectId}:${actionRequestId ?? "live"}:${actionRequestStatus ?? "none"}`}
              currentUser={currentUser}
              initialContent={buildSerializedTextState(currentDraftText)}
              initialMediaUploads={initialMediaUploads}
              placeholder="Type here."
              maxLength={X_DM_TEXT_MAX}
              characterCountMode="raw"
              submitButtonText="Send"
              submitButtonVariant="icon"
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
