import type {
  ConversationAttachment,
  RichConversationMessage,
} from "../ui/components/conversation-message/types";

export interface ResolvedLinkedInReplyAttachment {
  contentType: string;
  fileName?: string;
  size: number;
  url: string;
}

export function enrichLinkedInReplyTargetAttachments(args: {
  message: RichConversationMessage;
  getResolvedAttachment: (
    attachment: ConversationAttachment
  ) => ResolvedLinkedInReplyAttachment | null;
}): RichConversationMessage {
  const attachments = args.message.attachments;
  if (!attachments?.length) return args.message;

  let changed = false;
  const enrichedAttachments = attachments.map((attachment) => {
    const resolved = args.getResolvedAttachment(attachment);
    if (!resolved) return attachment;

    changed = true;
    return {
      ...attachment,
      url: resolved.url,
      previewUrl: resolved.contentType.startsWith("image/")
        ? resolved.url
        : attachment.previewUrl,
      mimeType: resolved.contentType,
      fileName: attachment.fileName ?? resolved.fileName,
      fileSize: resolved.size,
      unavailable: false,
      urlExpiresAt: undefined,
    };
  });

  return changed
    ? { ...args.message, attachments: enrichedAttachments }
    : args.message;
}
