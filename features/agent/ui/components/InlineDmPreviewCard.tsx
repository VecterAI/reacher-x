"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/components/Button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { ProspectPlatformAvatar } from "@/shared/ui/components/ProspectPlatformAvatar";
import { MessageBubble } from "@/shared/ui/components/MessageBubble";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { cn } from "@/shared/lib/utils";
import { useProspectDmPanel } from "@/features/prospects/hooks/useProspectDmPanel";
import { XDmConversationMenu } from "@/features/prospects/ui/components/XDmConversationMenu";
import { formatDmMessageTime } from "@/features/prospects/lib/formatDmMessageTime";
import { buildSerializedTextState } from "@/features/composer/lib/buildSerializedTextState";
import { useViewerXComposerIdentity } from "@/features/composer/hooks/useViewerXComposerIdentity";
import { BaseComposer } from "@/features/composer/ui/components/BaseComposer";
import {
  DM_COMPOSER_PLACEHOLDER_CLASS,
  DM_COMPOSER_PREVIEW_CONTENT_EDITABLE_CLASS,
} from "@/features/composer/ui/dmComposerClasses";
import {
  ChangeHistoryIcon,
  NewReleasesIcon,
  OpenInNewIcon,
} from "@/shared/ui/components/icons";
import { extractTwitterUsername } from "@/shared/lib/utils/url/socialProfiles";
import { X_DM_TEXT_MAX } from "@/shared/lib/twitter/xPostTextLimit";
import type { XDmAttachmentSummary } from "@/shared/lib/twitter/dm";

export interface InlineDmPreviewCardProps {
  prospectId: string;
  actionRequestId: string;
  onOpenPanel: () => void;
  className?: string;
}

export function InlineDmPreviewCard({
  prospectId,
  actionRequestId,
  onOpenPanel,
  className,
}: InlineDmPreviewCardProps) {
  const { currentUser } = useViewerXComposerIdentity();
  const { data, loading, error, send, cancel } = useProspectDmPanel({
    prospectId,
    actionRequestId,
    enabled: Boolean(prospectId && actionRequestId),
  });

  const profileUrl = data?.prospect.profileUrl;

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

  async function handleSend() {
    if (!data?.draftText?.trim()) {
      return;
    }
    try {
      await send(
        data.draftText ?? "",
        data.draftAttachments
          ?.map((attachment: XDmAttachmentSummary) => attachment.url)
          .filter(
            (url: string | undefined): url is string => typeof url === "string"
          ),
        data.draftAttachments?.map(
          (attachment: XDmAttachmentSummary) => attachment.altText ?? ""
        )
      );
      toast.success("DM sent on X");
    } catch (err) {
      toast.error("Failed to send DM", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  async function handleCancel() {
    await cancel();
    toast.success("Draft cancelled");
  }

  if (loading) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="border-border space-y-3 overflow-hidden rounded-xl border p-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className={cn("border-border rounded-xl border p-2 text-sm", className)}
      >
        <p className="font-medium">Could not load DM draft</p>
        <p className="text-muted-foreground mt-1">
          {error ?? "Please try again."}
        </p>
      </div>
    );
  }

  /** Last two messages for compact inline preview (matches product mock). */
  const previewMessages = data.messages.slice(-2);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="border-border overflow-hidden rounded-xl border">
        <header className="border-border flex items-start justify-between gap-2 border-b px-2 pt-2 pb-1">
          <div className="flex min-w-0 flex-1 items-start gap-2">
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
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-0.5">
                <span
                  className="truncate text-sm font-medium"
                  title={data.prospect.displayName}
                >
                  {data.prospect.displayName}
                </span>
                {data.prospect.verified ? (
                  <NewReleasesIcon
                    className="mr-0.5 size-3 shrink-0 fill-current"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              {data.prospect.title ? (
                <p
                  className="text-muted-foreground truncate text-sm"
                  title={data.prospect.title}
                >
                  {data.prospect.title}
                </p>
              ) : null}
            </div>
          </div>
          <XDmConversationMenu
            profileUrl={profileUrl}
            resolvedTwitterUsername={resolvedTwitterUsername}
          />
        </header>

        <div className="space-y-4 px-2 pt-4 pb-2">
          {previewMessages.length > 0 ? (
            <div className="flex flex-col gap-4">
              {previewMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col gap-1",
                    message.direction === "sent" ? "items-end" : "items-start"
                  )}
                >
                  <MessageBubble variant={message.direction}>
                    <div className="flex flex-col gap-2">
                      {message.attachments?.length ? (
                        <div className="grid gap-2">
                          {message.attachments.map((attachment) => (
                            <div
                              key={attachment.mediaKey ?? attachment.url}
                              className="bg-muted/30 order-1 overflow-hidden rounded-2xl border"
                            >
                              {attachment.previewUrl || attachment.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={attachment.previewUrl ?? attachment.url}
                                  alt={attachment.altText ?? "DM attachment"}
                                  className="h-auto w-full object-cover"
                                />
                              ) : null}
                            </div>
                          ))}
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
                      {formatDmMessageTime(message.createdAt)}
                      {message.direction === "sent" && message.readAt
                        ? " · Read"
                        : ""}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {data.warning ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-2 text-sm">
              <p className="font-medium">Limited live sync</p>
              <p className="text-muted-foreground mt-1">
                {data.warning.message}
              </p>
            </div>
          ) : null}

          {data.draftAttachments?.length ? (
            <div className="grid gap-2">
              {data.draftAttachments.map(
                (attachment: XDmAttachmentSummary, index: number) => (
                  <div
                    key={`${attachment.url ?? "draft-media"}-${index}`}
                    className="bg-muted/30 overflow-hidden rounded-2xl border"
                  >
                    {attachment.previewUrl || attachment.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={attachment.previewUrl ?? attachment.url}
                        alt={attachment.altText ?? "Draft DM attachment"}
                        className="h-auto w-full object-cover"
                      />
                    ) : null}
                  </div>
                )
              )}
            </div>
          ) : null}

          <BaseComposer
            currentUser={currentUser}
            initialContent={buildSerializedTextState(data.draftText ?? "")}
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
            disabled
            toolbarConfig={{
              showBold: false,
              showItalic: false,
              showEmoji: true,
              showMedia: true,
            }}
            showAvatar={false}
            editorAreaClassName="min-h-0 text-sm"
            contentEditableClassName={
              DM_COMPOSER_PREVIEW_CONTENT_EDITABLE_CLASS
            }
            composerPlaceholderClassName={DM_COMPOSER_PLACEHOLDER_CLASS}
            className="border-border text-muted-foreground pointer-events-none rounded-lg border p-2 opacity-90 select-none"
          />

          {!data.eligibility.enabled ? (
            <div className="rounded-lg border px-2 py-2 text-sm">
              <p className="font-medium">DM unavailable</p>
              <p className="text-muted-foreground mt-1">
                {data.eligibility.reasonLabel}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <InlineFeatureStrip
        leading={
          <>
            <div className="border-border rounded-md border p-1">
              <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
            </div>
            <span className="text-sm font-medium">Input →</span>
          </>
        }
        trailing={
          <>
            <Button variant="ghost" size="xs" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              size="xs"
              onClick={handleSend}
              disabled={!data.eligibility.enabled}
            >
              Send
            </Button>
            <Button variant="outline" size="xsIcon" onClick={onOpenPanel}>
              <OpenInNewIcon className="fill-current" />
            </Button>
          </>
        }
      />
    </div>
  );
}
