"use client";
import * as React from "react";
import { OpenGraphPreview } from "@/features/composer/ui/components/OpenGraphPreview";
import {
  clearCachedLinkedInConversationAttachment,
  getCachedLinkedInConversationAttachment,
  useLinkedInConversationAttachment,
} from "@/features/prospects/hooks/useLinkedInConversationAttachment";
import { getConversationAttachmentKind } from "@/features/prospects/lib/conversationAttachmentDownload";
import type { Media } from "@/features/threads/types";
import type { UnifiedMedia } from "@/shared/lib/platforms/types";
import { findLinkedInPostUrl } from "@/shared/lib/linkedin/comments";
import { isRenderableLinkedInMediaUrl } from "@/shared/lib/linkedin/post";
import {
  getCurrentUTCTimestamp,
  parseIsoToTimestamp,
} from "@/shared/lib/utils/time/timeUtils";
import {
  getFirstHttpUrl,
  getSharedXPostFromText,
  isSameXPostReference,
} from "../../../lib/conversationMessagePresentation";
import { ConversationFileAttachment } from "./ConversationFileAttachment";
import { ConversationVoiceNote } from "./ConversationVoiceNote";
import { ConversationUnavailableAttachment } from "./ConversationUnavailableAttachment";
import { ConversationSharedPost } from "./ConversationSharedPost";
import { ConversationLinkedInPost } from "./ConversationLinkedInPost";
import { ConversationAttachmentSkeleton } from "./ConversationAttachmentSkeleton";
import { TweetMedia } from "@/features/threads/ui/components/TweetMedia";
import { LinkedInMediaGrid } from "@/features/webapp/ui/components/linkedin/LinkedInMediaGrid";
import { MediaUnavailablePlaceholder } from "@/shared/ui/components/MediaUnavailablePlaceholder";
import { LinkIcon } from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";
import type {
  ConversationAttachment,
  ConversationMessagePlatform,
  SharedConversationPost,
} from "./types";

const LINKEDIN_ATTACHMENT_AUTO_RETRY_DELAYS_MS = [1_500, 4_000] as const;

function ConversationLinkPreviewFallback({ url }: { url: string }) {
  const hostname = new URL(url).hostname;
  return (
    <div className="space-y-3">
      <MediaUnavailablePlaceholder
        title="Link preview unavailable"
        className="aspect-video min-h-0 justify-center"
      />
      <div className="text-muted-foreground mt-2 flex h-4 items-center gap-2 text-sm">
        <LinkIcon className="size-4 fill-current" aria-hidden="true" />
        <span className="truncate">{hostname}</span>
      </div>
    </div>
  );
}

function hasUsableAttachmentUrl(attachment: ConversationAttachment): boolean {
  const browserUrl = [attachment.url, attachment.previewUrl].find(
    (url): url is string =>
      typeof url === "string" && isRenderableLinkedInMediaUrl(url)
  );
  if (!browserUrl) {
    return false;
  }
  const expiresAt = attachment.urlExpiresAt
    ? parseIsoToTimestamp(attachment.urlExpiresAt)
    : undefined;
  return expiresAt === undefined || expiresAt > getCurrentUTCTimestamp();
}

function DeferredLinkedInAttachment({
  attachment,
  direction,
  messageId,
  prospectId,
}: {
  attachment: ConversationAttachment;
  direction: "sent" | "received";
  messageId: string;
  prospectId: string;
}) {
  const { resolveAttachment } = useLinkedInConversationAttachment();
  const attachmentId = attachment.id;
  const [shouldLoad, setShouldLoad] = React.useState(false);
  const [resolved, setResolved] = React.useState(() =>
    attachmentId
      ? getCachedLinkedInConversationAttachment({
          prospectId,
          messageId,
          attachmentId,
        })
      : null
  );
  const [failed, setFailed] = React.useState(false);
  const [loadAttempt, setLoadAttempt] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const retry = React.useCallback(() => {
    if (attachmentId) {
      clearCachedLinkedInConversationAttachment({
        prospectId,
        messageId,
        attachmentId,
      });
    }
    setResolved(null);
    setFailed(false);
    setLoadAttempt(0);
    setShouldLoad(true);
  }, [attachmentId, messageId, prospectId]);

  React.useEffect(() => {
    if (resolved || failed || !attachmentId) return;
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [attachmentId, failed, resolved]);

  React.useEffect(() => {
    if (!shouldLoad || !attachmentId || resolved || failed) return;
    let active = true;
    let retryTimeoutId: number | undefined;
    void resolveAttachment({ prospectId, messageId, attachmentId })
      .then((result) => {
        if (active) setResolved(result);
      })
      .catch((error) => {
        console.warn(
          "[ConversationRichAttachments] Unable to load LinkedIn attachment",
          error instanceof Error ? error.message : String(error)
        );
        if (!active) return;
        const retryDelay =
          LINKEDIN_ATTACHMENT_AUTO_RETRY_DELAYS_MS[loadAttempt];
        if (retryDelay !== undefined) {
          retryTimeoutId = window.setTimeout(() => {
            if (active) setLoadAttempt((attempt) => attempt + 1);
          }, retryDelay);
          return;
        }
        setFailed(true);
      });
    return () => {
      active = false;
      if (retryTimeoutId !== undefined) {
        window.clearTimeout(retryTimeoutId);
      }
    };
  }, [
    attachmentId,
    failed,
    loadAttempt,
    messageId,
    prospectId,
    resolved,
    resolveAttachment,
    shouldLoad,
  ]);

  React.useEffect(() => {
    if (!resolved || !attachmentId) return;
    const refreshInMs = Math.max(
      5_000,
      resolved.expiresAt - getCurrentUTCTimestamp() - 30_000
    );
    let active = true;
    const timeoutId = window.setTimeout(() => {
      clearCachedLinkedInConversationAttachment({
        prospectId,
        messageId,
        attachmentId,
      });
      void resolveAttachment({ prospectId, messageId, attachmentId })
        .then((next) => {
          if (active) setResolved(next);
        })
        .catch((error) => {
          console.warn(
            "[ConversationRichAttachments] Unable to refresh LinkedIn attachment",
            error instanceof Error ? error.message : String(error)
          );
        });
    }, refreshInMs);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [attachmentId, messageId, prospectId, resolveAttachment, resolved]);

  if (resolved) {
    return (
      <ConversationRichAttachments
        attachments={[
          {
            ...attachment,
            url: resolved.url,
            mimeType: resolved.contentType,
            fileName: attachment.fileName ?? resolved.fileName,
            fileSize: resolved.size,
            unavailable: false,
            urlExpiresAt: undefined,
          },
        ]}
        platform="linkedin"
        direction={direction}
        prospectId={prospectId}
        messageId={messageId}
        onRetryAttachment={retry}
      />
    );
  }

  const kind = getUnavailableAttachmentKind(attachment);
  return (
    <div ref={rootRef} className="w-full max-w-full">
      {failed ? (
        <ConversationUnavailableAttachment
          kind={kind}
          platform="linkedin"
          label={attachment.fileName ?? attachment.type}
          width={attachment.width}
          height={attachment.height}
          onRetry={retry}
        />
      ) : (
        <ConversationAttachmentSkeleton attachment={attachment} kind={kind} />
      )}
    </div>
  );
}

function getAttachmentKind(attachment: ConversationAttachment) {
  return getConversationAttachmentKind(attachment);
}

function getUnavailableAttachmentKind(
  attachment: ConversationAttachment
): "image" | "video" | "audio" | "file" {
  const kind = getAttachmentKind(attachment);
  return kind === "image" || kind === "video" || kind === "audio"
    ? kind
    : "file";
}

function toTweetMedia(attachment: ConversationAttachment): Media | null {
  const mediaUrl = attachment.previewUrl ?? attachment.url;
  if (!mediaUrl) return null;
  const kind = getAttachmentKind(attachment);
  if (kind !== "image" && kind !== "video") return null;

  const providerVariants = attachment.variants ?? [];
  const videoVariants =
    kind === "video" &&
    attachment.url &&
    !providerVariants.some((variant) => variant.url === attachment.url)
      ? [
          ...providerVariants,
          {
            url: attachment.url,
            mimeType: attachment.mimeType ?? "video/mp4",
          },
        ]
      : providerVariants;

  return {
    id_str: attachment.id,
    media_key: attachment.mediaKey,
    media_url_https: mediaUrl,
    type:
      kind === "video"
        ? attachment.isGif
          ? "animated_gif"
          : "video"
        : "photo",
    ext_alt_text: attachment.altText,
    original_info:
      attachment.width && attachment.height
        ? {
            width: attachment.width,
            height: attachment.height,
            focus_rects: [],
          }
        : undefined,
    video_info:
      kind === "video"
        ? {
            aspect_ratio: [attachment.width ?? 16, attachment.height ?? 9],
            duration_millis: attachment.durationMs,
            variants: videoVariants.map((variant) => ({
              url: variant.url,
              content_type: variant.mimeType ?? "video/mp4",
              bitrate: variant.bitrate,
            })),
          }
        : undefined,
  };
}

function toLinkedInMedia(
  attachment: ConversationAttachment
): UnifiedMedia | null {
  const kind = getAttachmentKind(attachment);
  const url = attachment.url ?? attachment.previewUrl;
  if (!url || (kind !== "image" && kind !== "video")) return null;
  return {
    id: attachment.id,
    type: kind,
    url,
    width: attachment.width,
    height: attachment.height,
    posterUrl: attachment.previewUrl,
  };
}

interface ConversationRichAttachmentsProps {
  attachments?: ConversationAttachment[];
  text?: string;
  sharedPost?: SharedConversationPost;
  platform: ConversationMessagePlatform;
  direction: "sent" | "received";
  prospectId?: string;
  messageId?: string;
  onRetryAttachment?: (
    attachment: ConversationAttachment
  ) => Promise<void> | void;
  actionRail?: React.ReactNode;
}

export function ConversationRichAttachments({
  attachments = [],
  text,
  sharedPost,
  platform,
  direction,
  prospectId,
  messageId,
  onRetryAttachment,
  actionRail,
}: ConversationRichAttachmentsProps) {
  const deferredLinkedInAttachments = attachments.filter(
    (attachment) =>
      platform === "linkedin" &&
      Boolean(prospectId && messageId && attachment.id) &&
      !hasUsableAttachmentUrl(attachment) &&
      !attachment.variants?.length
  );
  const deferredLinkedInAttachmentIds = new Set(
    deferredLinkedInAttachments.map((attachment) => attachment.id)
  );
  const availableAttachments = attachments.filter(
    (attachment) =>
      (!attachment.isLoading ||
        hasUsableAttachmentUrl(attachment) ||
        Boolean(attachment.variants?.length)) &&
      !attachment.unavailable &&
      !deferredLinkedInAttachmentIds.has(attachment.id)
  );
  const loadingAttachments = attachments.filter(
    (attachment) =>
      attachment.isLoading &&
      !hasUsableAttachmentUrl(attachment) &&
      !attachment.variants?.length
  );
  const audioAttachments = availableAttachments.filter(
    (attachment) =>
      attachment.isVoiceNote || getAttachmentKind(attachment) === "audio"
  );
  const visualAttachments = availableAttachments.filter((attachment) => {
    const kind = getAttachmentKind(attachment);
    return kind === "image" || kind === "video";
  });
  const fileAttachments = availableAttachments.filter((attachment) => {
    const kind = getAttachmentKind(attachment);
    return (
      attachment.type !== "link" &&
      attachment.type !== "url" &&
      attachment.type !== "linkedin_post" &&
      attachment.type !== "post" &&
      kind !== "image" &&
      kind !== "video" &&
      kind !== "audio"
    );
  });
  const attachmentRichLink =
    attachments.find(
      (attachment) =>
        attachment.linkedinPostUrl ||
        attachment.type === "link" ||
        attachment.type === "url" ||
        attachment.type === "linkedin_post" ||
        attachment.type === "post"
    )?.linkedinPostUrl ??
    attachments.find(
      (attachment) =>
        attachment.type === "link" ||
        attachment.type === "url" ||
        attachment.type === "linkedin_post" ||
        attachment.type === "post"
    )?.url ??
    undefined;
  const textRichLink = getFirstHttpUrl(text);
  const textLinkedInPostUrl =
    platform === "linkedin" ? findLinkedInPostUrl(text) : undefined;
  const linkedInPostUrl =
    platform === "linkedin"
      ? (attachments.find((attachment) => attachment.linkedinPostUrl)
          ?.linkedinPostUrl ??
        attachments.find((attachment) => attachment.type === "linkedin_post")
          ?.url ??
        textLinkedInPostUrl)
      : undefined;
  const resolvedSharedPost =
    sharedPost ??
    (platform === "twitter"
      ? (getSharedXPostFromText(text) ??
        getSharedXPostFromText(attachmentRichLink))
      : undefined);

  const twitterMedia =
    platform === "twitter"
      ? visualAttachments
          .map(toTweetMedia)
          .filter((media): media is Media => media !== null)
      : [];
  const linkedinMedia =
    platform === "linkedin"
      ? visualAttachments
          .map(toLinkedInMedia)
          .filter((media): media is UnifiedMedia => media !== null)
      : [];
  const unavailableAttachments = attachments.filter(
    (attachment) =>
      !attachment.isLoading &&
      !deferredLinkedInAttachmentIds.has(attachment.id) &&
      (attachment.unavailable ||
        ((attachment.isVoiceNote ||
          getAttachmentKind(attachment) === "audio") &&
          !attachment.url &&
          !attachment.previewUrl) ||
        ((getAttachmentKind(attachment) === "image" ||
          getAttachmentKind(attachment) === "video") &&
          !attachment.url &&
          !attachment.previewUrl &&
          !attachment.variants?.length))
  );
  const usesCompactWidth =
    attachments.length > 0 &&
    attachments.every(
      (attachment) =>
        attachment.isVoiceNote || getAttachmentKind(attachment) === "audio"
    ) &&
    !resolvedSharedPost &&
    !linkedInPostUrl &&
    !attachmentRichLink &&
    !textRichLink;

  return (
    <div
      data-conversation-rich-attachments
      className={cn(
        "relative flex max-w-full flex-col gap-1.5",
        usesCompactWidth ? "w-full max-w-sm" : "w-full",
        direction === "sent" ? "self-end" : "self-start"
      )}
    >
      {platform === "twitter" && resolvedSharedPost?.id ? (
        <div className="w-full max-w-full">
          <ConversationSharedPost post={resolvedSharedPost} />
        </div>
      ) : resolvedSharedPost?.url &&
        resolvedSharedPost.url !== linkedInPostUrl ? (
        <div className="w-full max-w-full">
          <OpenGraphPreview
            url={resolvedSharedPost.url}
            context="timeline"
            debounceMs={300}
            enableCache
            retryOnError
            fallback={
              <ConversationLinkPreviewFallback url={resolvedSharedPost.url} />
            }
          />
        </div>
      ) : null}
      {linkedInPostUrl && prospectId ? (
        <div className="w-full max-w-full">
          <ConversationLinkedInPost
            prospectId={prospectId}
            postUrl={linkedInPostUrl}
          />
        </div>
      ) : null}
      {attachmentRichLink &&
      !isSameXPostReference(attachmentRichLink, resolvedSharedPost) &&
      attachmentRichLink !== linkedInPostUrl ? (
        <div className="w-full max-w-full">
          <OpenGraphPreview
            url={attachmentRichLink}
            context="timeline"
            debounceMs={300}
            enableCache
            retryOnError
            fallback={
              <ConversationLinkPreviewFallback url={attachmentRichLink} />
            }
          />
        </div>
      ) : null}
      {textRichLink &&
      !isSameXPostReference(textRichLink, resolvedSharedPost) &&
      textRichLink !== attachmentRichLink &&
      textRichLink !== linkedInPostUrl ? (
        <div className="w-full max-w-full">
          <OpenGraphPreview
            url={textRichLink}
            context="timeline"
            debounceMs={300}
            enableCache
            retryOnError
            fallback={<ConversationLinkPreviewFallback url={textRichLink} />}
          />
        </div>
      ) : null}
      {twitterMedia.length ? (
        <div className="w-full max-w-full">
          <TweetMedia
            media={twitterMedia}
            onRetry={(media) => {
              const attachment = visualAttachments.find(
                (item) =>
                  item.id === media.id_str ||
                  item.mediaKey === media.media_key ||
                  (item.previewUrl ?? item.url) === media.media_url_https
              );
              return attachment ? onRetryAttachment?.(attachment) : undefined;
            }}
          />
        </div>
      ) : null}
      {linkedinMedia.length ? (
        <div className="w-full max-w-full">
          <LinkedInMediaGrid
            media={linkedinMedia}
            className="w-full max-w-full"
            layout="conversation"
            eager
            onRetry={(media) => {
              const attachment = visualAttachments.find(
                (item) =>
                  (item.url ?? item.previewUrl) === media.url ||
                  item.id === media.id
              );
              return attachment ? onRetryAttachment?.(attachment) : undefined;
            }}
          />
        </div>
      ) : null}
      {audioAttachments.map((attachment, index) => {
        const url = attachment.url ?? attachment.previewUrl;
        return url ? (
          <ConversationVoiceNote
            key={attachment.id ?? attachment.mediaKey ?? `${url}-${index}`}
            url={url}
            direction={direction}
            durationMs={attachment.durationMs}
            platform={platform}
          />
        ) : null;
      })}
      {fileAttachments.map((attachment, index) => (
        <ConversationFileAttachment
          key={
            attachment.id ??
            attachment.mediaKey ??
            attachment.url ??
            `${attachment.type}-${index}`
          }
          attachment={attachment}
        />
      ))}
      {platform === "linkedin" && prospectId && messageId
        ? deferredLinkedInAttachments.map((attachment) => (
            <DeferredLinkedInAttachment
              key={attachment.id}
              attachment={attachment}
              direction={direction}
              messageId={messageId}
              prospectId={prospectId}
            />
          ))
        : null}
      {loadingAttachments.map((attachment) => (
        <ConversationAttachmentSkeleton
          key={
            attachment.id ??
            attachment.mediaKey ??
            `${attachment.type}-loading-${attachment.fileName ?? attachment.durationMs ?? "attachment"}`
          }
          attachment={attachment}
          kind={getUnavailableAttachmentKind(attachment)}
        />
      ))}
      {unavailableAttachments.map((attachment, index) => {
        return (
          <ConversationUnavailableAttachment
            key={
              attachment.id ??
              attachment.mediaKey ??
              `${attachment.type}-unavailable-${index}`
            }
            kind={getUnavailableAttachmentKind(attachment)}
            platform={platform}
            label={attachment.fileName ?? attachment.type}
            width={attachment.width}
            height={attachment.height}
          />
        );
      })}
      {actionRail}
    </div>
  );
}
