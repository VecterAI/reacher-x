import { cn } from "@/shared/lib/utils";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/shared/ui/components/Attachment";
import { FileVisualIcon } from "@/shared/ui/components/FileVisualIcon";
import {
  CloseIcon,
  ImageIcon,
  MicIcon,
  PlayCircleIcon,
  QuickPhrasesIcon,
} from "@/shared/ui/components/icons/index";
import { getConversationAttachmentKind } from "../../../lib/conversationAttachmentDownload";
import type { QuotedConversationMessage } from "./types";

function getReplySenderLabel(
  quote: QuotedConversationMessage,
  participantName?: string
) {
  return (
    quote.senderName ??
    (quote.direction === "sent" ? "You" : participantName) ??
    "Message"
  );
}

function getReplySummary(quote: QuotedConversationMessage) {
  if (quote.text?.trim()) return quote.text.trim();
  if (quote.sharedPost) return "Shared post";
  const attachment = quote.attachments?.[0];
  const type = attachment?.type ?? quote.attachmentType;
  if (!type) return "Original message unavailable";
  if (/gif/iu.test(type)) return "GIF attachment";
  if (/post|tweet/iu.test(type)) return "Shared post";
  if (attachment) {
    const kind = getConversationAttachmentKind(attachment);
    if (kind === "image") return "Image attachment";
    if (kind === "video") return "Video attachment";
    if (kind === "audio") return "Audio attachment";
    if (
      ["attachment", "media"].includes((attachment.type ?? "").toLowerCase())
    ) {
      return "Attachment";
    }
    return "File attachment";
  }
  if (/image|photo/iu.test(type)) return "Image attachment";
  if (/video/iu.test(type)) return "Video attachment";
  if (/audio|voice/iu.test(type)) return "Audio attachment";
  return "Attachment";
}

function ReplyThumbnail({ quote }: { quote: QuotedConversationMessage }) {
  const attachment = quote.attachments?.[0];
  const previewUrl = attachment?.previewUrl ?? attachment?.url;
  const type = attachment?.type ?? quote.attachmentType ?? "";
  const kind = attachment
    ? getConversationAttachmentKind(attachment)
    : /image|photo|gif/iu.test(type)
      ? "image"
      : /video/iu.test(type)
        ? "video"
        : /audio|voice/iu.test(type)
          ? "audio"
          : "file";

  if (previewUrl && kind === "image") {
    return (
      // Browser-memory blob URLs and provider URLs are intentionally rendered directly.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={previewUrl} alt="" className="size-full object-cover" />
    );
  }

  if (kind === "video") {
    return (
      <PlayCircleIcon className="size-4 fill-current" aria-hidden="true" />
    );
  }
  if (kind === "audio") {
    return <MicIcon className="size-4 fill-current" aria-hidden="true" />;
  }
  if (kind === "image") {
    return <ImageIcon className="size-4 fill-current" aria-hidden="true" />;
  }
  return (
    <FileVisualIcon
      fileName={attachment?.fileName ?? type}
      mimeType={attachment?.mimeType}
      url={previewUrl}
    />
  );
}

export function ConversationReplyQuote({
  quote,
  participantName,
}: {
  quote: QuotedConversationMessage;
  participantName?: string;
}) {
  const senderLabel = getReplySenderLabel(quote, participantName);
  const attachment = quote.attachments?.[0];
  const showThumbnail = Boolean(attachment || quote.attachmentType);

  return (
    <blockquote
      aria-label={`Reply to ${senderLabel}`}
      className="mb-1.5 flex min-w-0 gap-2 border-l-2 border-current/25 pl-2 text-xs"
    >
      {showThumbnail ? (
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-current/10">
          <ReplyThumbnail quote={quote} />
        </span>
      ) : null}
      <span className="min-w-0 opacity-75">
        <span className="block truncate font-medium opacity-100">
          {senderLabel}
        </span>
        <span className="mt-0.5 line-clamp-2 block leading-4">
          {getReplySummary(quote)}
        </span>
      </span>
    </blockquote>
  );
}

export function ConversationComposerReplyTarget({
  quote,
  participantName,
  onDismiss,
  className,
}: {
  quote: QuotedConversationMessage;
  participantName?: string;
  onDismiss: () => void;
  className?: string;
}) {
  const senderLabel = getReplySenderLabel(quote, participantName);
  const hasAttachment = Boolean(quote.attachments?.[0] || quote.attachmentType);

  return (
    <Attachment
      size="sm"
      className={cn("w-full flex-nowrap rounded-xl bg-transparent", className)}
      aria-label={`Replying to ${senderLabel}`}
    >
      <AttachmentMedia variant={hasAttachment ? "image" : "icon"}>
        {hasAttachment ? (
          <ReplyThumbnail quote={quote} />
        ) : (
          <QuickPhrasesIcon className="fill-current" aria-hidden="true" />
        )}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>Replying to {senderLabel}</AttachmentTitle>
        <AttachmentDescription>{getReplySummary(quote)}</AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction
          type="button"
          onClick={onDismiss}
          aria-label="Cancel reply"
        >
          <CloseIcon className="fill-current" aria-hidden="true" />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  );
}
