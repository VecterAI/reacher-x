"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { SerializedEditorState } from "lexical";
import { toast } from "sonner";
import { PageContent } from "@/features/webapp/ui/components/page/PageContent";
import { PageHeader } from "@/features/webapp/ui/components/page/PageHeader";
import { PageLayout } from "@/features/webapp/ui/components/page/PageLayout";
import { useViewerXComposerIdentity } from "@/features/composer/hooks/useViewerXComposerIdentity";
import { BaseComposer } from "@/features/composer/ui/components/BaseComposer";
import { useProspectDmPanel } from "../../hooks/useProspectDmPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import { Button } from "@/shared/ui/components/Button";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
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

function formatMessageTime(timestamp?: string) {
  if (!timestamp) return "";
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  return value.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface XConversationPanelProps {
  prospectId: string;
  actionRequestId?: string | null;
  onBack?: () => void;
  onViewProfile?: () => void;
  className?: string;
}

export function XConversationPanel({
  prospectId,
  actionRequestId,
  onBack,
  onViewProfile,
  className,
}: XConversationPanelProps) {
  const { currentUser } = useViewerXComposerIdentity();
  const { data, loading, error, send, cancel } = useProspectDmPanel({
    prospectId,
    actionRequestId,
    enabled: Boolean(prospectId),
  });
  const updatePendingActionRequestDraft = useMutation(
    api.twitterActions.updatePendingActionRequestDraft
  );
  const [currentDraftText, setCurrentDraftText] = React.useState("");
  const [isComposerFocused, setIsComposerFocused] = React.useState(false);
  const profileUrl = data?.prospect.profileUrl;

  React.useEffect(() => {
    if (isComposerFocused) {
      return;
    }
    setCurrentDraftText(data?.draftText ?? "");
  }, [data?.draftText, isComposerFocused]);

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
              ?.map((attachment) => attachment.url)
              .filter((url): url is string => Boolean(url));
        const resolvedDescriptions = mediaDescriptions?.length
          ? mediaDescriptions
          : data?.draftAttachments?.map(
              (attachment) => attachment.altText ?? ""
            );
        if (!nextText && !(resolvedMediaUrls && resolvedMediaUrls.length > 0)) {
          return;
        }
        await send(nextText, resolvedMediaUrls, resolvedDescriptions);
        toast.success("DM sent on X");
      } catch (err) {
        toast.error("Failed to send DM", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
      }
    },
    [data, send]
  );

  function handleCopyProfile() {
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl).then(
      () => toast.success("Copied profile link"),
      () => toast.error("Unable to copy profile link")
    );
  }

  function handleOpenTwitter() {
    if (!profileUrl) return;
    window.open(profileUrl, "_blank", "noopener,noreferrer");
  }

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
        {profileUrl ? (
          <DropdownMenuItem onClick={handleOpenTwitter}>
            <OpenInNewIcon className="fill-current" aria-hidden />
            View Twitter profile
          </DropdownMenuItem>
        ) : null}
        {profileUrl ? (
          <DropdownMenuItem onClick={handleCopyProfile}>
            <ContentCopyIcon className="fill-current" aria-hidden />
            Copy profile link
          </DropdownMenuItem>
        ) : null}
        {profileUrl ? (
          <DropdownMenuItem onClick={handleOpenTwitter}>
            <OpenInNewIcon className="fill-current" aria-hidden />
            Open on Twitter
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
          title={data?.prospect.displayName ?? "X DM"}
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
                  {data.messages.length === 0 ? (
                    <div className="flex flex-col items-center px-4 pt-8 text-center">
                      <Avatar className="mb-4 size-20">
                        <AvatarImage
                          src={data.prospect.avatarUrl}
                          alt={data.prospect.displayName}
                        />
                        <AvatarFallback>
                          {data.prospect.displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-foreground text-[15px] font-medium">
                        {data.prospect.displayName}
                      </div>
                      {data.prospect.title ? (
                        <div className="text-muted-foreground text-[15px]">
                          {data.prospect.title}
                        </div>
                      ) : null}
                      {onViewProfile ? (
                        <Button
                          variant="outline"
                          size="xs"
                          className="mt-4"
                          onClick={onViewProfile}
                        >
                          View profile
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {data.messages.map((message) => (
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
                            <div className="space-y-2">
                              {message.attachments?.length ? (
                                <div className="grid gap-2">
                                  {message.attachments.map((attachment) => (
                                    <div
                                      key={
                                        attachment.mediaKey ?? attachment.url
                                      }
                                      className="bg-muted/30 overflow-hidden rounded-2xl border"
                                    >
                                      {attachment.previewUrl ||
                                      attachment.url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={
                                            attachment.previewUrl ??
                                            attachment.url
                                          }
                                          alt={
                                            attachment.altText ??
                                            "DM attachment"
                                          }
                                          className="h-auto w-full object-cover"
                                        />
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {message.text ? <div>{message.text}</div> : null}
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

          <div className="border-t px-4 py-3">
            {data?.draftAttachments?.length ? (
              <div className="mb-3 grid gap-2">
                {data.draftAttachments.map((attachment, index) => (
                  <div
                    key={`${attachment.url ?? "draft-attachment"}-${index}`}
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
                ))}
              </div>
            ) : null}
            <BaseComposer
              currentUser={currentUser}
              initialContent={buildSerializedTextState(currentDraftText)}
              placeholder="Type here."
              maxLength={10000}
              characterCountMode="raw"
              submitButtonText="Send"
              showMediaUpload
              maxAttachments={1}
              disabled={!data || !data.eligibility.enabled}
              headerPrimary={<span />}
              showAvatar={false}
              className="rounded-[20px] border px-3 py-2"
              onContentChange={(content) => {
                setCurrentDraftText(extractTextFromEditorState(content).trim());
              }}
              onEditorFocus={() => {
                setIsComposerFocused(true);
              }}
              onEditorBlur={() => {
                setIsComposerFocused(false);
                void draftSync.flushNow();
              }}
              onSubmit={handleSend}
            />
            {draftSync.status === "saving" ? (
              <p className="text-muted-foreground mt-2 text-xs">Saving…</p>
            ) : draftSync.status === "error" ? (
              <p className="mt-2 text-xs text-amber-600">
                Draft sync failed. We&apos;ll retry on your next edit.
              </p>
            ) : null}
            {actionRequestId ? (
              <div className="mt-3 flex items-center justify-end">
                <Button variant="ghost" size="xs" onClick={handleCancelDraft}>
                  Cancel
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </PageLayout>
    </aside>
  );
}
