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

export interface XConversationPanelProps {
  prospectId: string;
  actionRequestId?: string | null;
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
  onBack,
  onViewProfile,
  onViewTwitterProfile,
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
  const profileUrl = data?.prospect.profileUrl;
  const lastServerDraftRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    lastServerDraftRef.current = undefined;
  }, [prospectId, actionRequestId]);

  // Sync local draft only when the server/Convex draft value changes — never when the editor
  // blurs (e.g. emoji popover), or we wipe typed text and the composer resets to stale draft.
  React.useEffect(() => {
    const serverDraft = data?.draftText ?? "";
    if (lastServerDraftRef.current === serverDraft) {
      return;
    }
    lastServerDraftRef.current = serverDraft;
    setCurrentDraftText(serverDraft);
  }, [data?.draftText]);

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
              ?.map((attachment: XDmAttachmentSummary) => attachment.url)
              .filter((url): url is string => Boolean(url));
        const resolvedDescriptions = mediaDescriptions?.length
          ? mediaDescriptions
          : data?.draftAttachments?.map(
              (attachment: XDmAttachmentSummary) => attachment.altText ?? ""
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

  const handleCancelDraft = React.useCallback(async () => {
    await cancel();
    toast.success("Draft cancelled");
  }, [cancel]);

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
                          View Twitter profile
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {data.messages.map((message: XDmMessage) => (
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
                                    (attachment: XDmAttachmentSummary) => (
                                    <div
                                      key={
                                        attachment.mediaKey ?? attachment.url
                                      }
                                      className="bg-muted/30 order-1 overflow-hidden rounded-2xl border"
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
              initialContent={buildSerializedTextState(currentDraftText)}
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
