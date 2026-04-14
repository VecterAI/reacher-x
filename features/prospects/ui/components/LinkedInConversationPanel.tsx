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
  LinkedInConversationAttachmentSummary,
  LinkedInConversationMessage,
} from "@/shared/lib/linkedin/conversation";

const LINKEDIN_DM_TEXT_MAX = 8000;

export interface LinkedInConversationPanelProps {
  prospectId: string;
  actionRequestId?: string | null;
  onBack?: () => void;
  onViewProfile?: () => void;
  className?: string;
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
  onBack,
  onViewProfile,
  className,
}: LinkedInConversationPanelProps) {
  const { currentUser } = useViewerXComposerIdentity();
  const { data, loading, error, send, cancel } = useProspectLinkedInPanel({
    prospectId,
    actionRequestId,
    enabled: Boolean(prospectId),
  });
  const updatePendingActionRequestDraft = useMutation(
    api.socialActions.updatePendingActionRequestDraft
  );
  const [currentDraftText, setCurrentDraftText] = React.useState("");
  const lastServerDraftRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    lastServerDraftRef.current = undefined;
  }, [prospectId, actionRequestId]);

  React.useEffect(() => {
    const serverDraft = data?.draftText ?? "";
    if (lastServerDraftRef.current === serverDraft) {
      return;
    }
    lastServerDraftRef.current = serverDraft;
    setCurrentDraftText(serverDraft);
  }, [data?.draftText]);

  const draftSync = useDebouncedDraftSync({
    enabled: Boolean(actionRequestId && data),
    value: currentDraftText,
    persistedValue: data?.draftText ?? "",
    onSave: async (nextValue) => {
      if (!actionRequestId) {
        return;
      }

      await updatePendingActionRequestDraft({
        actionRequestId: actionRequestId as Id<"agentActionRequests">,
        content: nextValue,
      });
    },
  });

  const handleCopyProfile = React.useCallback(() => {
    if (!data?.prospect.profileUrl) {
      return;
    }
    navigator.clipboard.writeText(data.prospect.profileUrl).then(
      () => toast.success("Copied profile link"),
      () => toast.error("Unable to copy profile link")
    );
  }, [data?.prospect.profileUrl]);

  const handleOpenLinkedIn = React.useCallback(() => {
    if (!data?.prospect.profileUrl) {
      return;
    }
    window.open(data.prospect.profileUrl, "_blank", "noopener,noreferrer");
  }, [data?.prospect.profileUrl]);

  const handleSend = React.useCallback(
    async (
      content: SerializedEditorState,
      mediaUrls?: string[],
      mediaDescriptions?: string[]
    ) => {
      try {
        const nextText = extractTextFromEditorState(content).trim();
        const resolvedMediaUrls = mediaUrls?.length
          ? mediaUrls
          : data?.draftAttachments
              ?.map(
                (attachment: LinkedInConversationAttachmentSummary) =>
                  attachment.url
              )
              .filter((url): url is string => Boolean(url));

        if (!nextText && !(resolvedMediaUrls && resolvedMediaUrls.length > 0)) {
          return;
        }

        await send(nextText, resolvedMediaUrls, mediaDescriptions);
        toast.success("Message sent on LinkedIn");
      } catch (err) {
        toast.error("Failed to send LinkedIn message", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
      }
    },
    [data, send]
  );

  const handleCancelDraft = React.useCallback(async () => {
    await cancel();
    toast.success("Draft cancelled");
  }, [cancel]);

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
        {data?.prospect.profileUrl ? (
          <DropdownMenuItem onClick={handleOpenLinkedIn}>
            <OpenInNewIcon className="fill-current" aria-hidden />
            View LinkedIn profile
          </DropdownMenuItem>
        ) : null}
        {data?.prospect.profileUrl ? (
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
          title={data?.prospect.displayName ?? "LinkedIn messages"}
          titleLeading={
            data ? (
              <ProspectPlatformAvatar platform="linkedin" badgeSize="sm">
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
          onBack={onBack}
          actions={headerActions}
        />
        <div className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1" viewportClassName="pb-4">
            <PageContent className="space-y-4 px-4 py-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-[20px]" />
                  <Skeleton className="ml-auto h-16 w-2/3 rounded-[20px]" />
                  <Skeleton className="h-48 w-full rounded-[24px]" />
                </div>
              ) : error ? (
                <div className="rounded-[20px] border px-4 py-3 text-sm">
                  <p className="font-medium">Could not load LinkedIn messages</p>
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
                  {data.messages.length === 0 ? (
                    <div className="mx-auto flex w-full max-w-sm flex-col items-center px-4 pt-6 text-center">
                      <ProspectPlatformAvatar platform="linkedin" badgeSize="lg">
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
                        <h2
                          className="text-foreground truncate text-sm font-medium"
                          title={data.prospect.displayName}
                        >
                          {data.prospect.displayName}
                        </h2>
                        {data.prospect.title ? (
                          <p className="text-muted-foreground mt-0.5 text-sm">
                            {data.prospect.title}
                          </p>
                        ) : null}
                      </div>
                      {data.prospect.profileUrl ? (
                        <Button
                          variant="outline"
                          size="xs"
                          className="mt-2"
                          onClick={handleOpenLinkedIn}
                        >
                          View LinkedIn profile
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {data.messages.map(
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
                                      {isVisualAttachment(attachment.type) &&
                                      (attachment.previewUrl || attachment.url) ? (
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
                  {!data.eligibility.enabled ? (
                    <div className="rounded-[20px] border px-4 py-3 text-sm">
                      <p className="font-medium">Messaging unavailable</p>
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
              currentUser={currentUser}
              initialContent={buildSerializedTextState(currentDraftText)}
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
              disabled={!data || !data.eligibility.enabled}
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
              className="rounded-xl border p-2"
              onContentChange={(content) => {
                setCurrentDraftText(extractTextFromEditorState(content).trim());
              }}
              onEditorBlur={() => {
                void draftSync.flushNow();
              }}
              onSubmit={handleSend}
              afterEmojiSlot={
                actionRequestId ? (
                  <div className="flex h-8 w-26 shrink-0 items-center justify-start">
                    {draftSync.status === "saving" ? (
                      <AsciiSpinnerText
                        text="Saving"
                        className="text-muted-foreground text-xs"
                      />
                    ) : (
                      <span className="block w-full" aria-hidden />
                    )}
                  </div>
                ) : undefined
              }
              submitToolbarStart={
                actionRequestId ? (
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
            {draftSync.status === "error" ? (
              <p className="mt-2 text-xs text-amber-600">
                Draft sync failed. We&apos;ll retry on your next edit.
              </p>
            ) : null}
          </div>
        </div>
      </PageLayout>
    </aside>
  );
}
