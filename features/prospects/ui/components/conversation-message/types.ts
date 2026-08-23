import type { Id } from "@/convex/_generated/dataModel";

export type ConversationMessagePlatform = "linkedin" | "twitter";

export interface ConversationMediaVariant {
  url: string;
  mimeType?: string;
  bitrate?: number;
}

export interface ConversationAttachment {
  id?: string;
  mediaKey?: string;
  type: string;
  url?: string;
  previewUrl?: string;
  altText?: string;
  width?: number;
  height?: number;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  durationMs?: number;
  variants?: ConversationMediaVariant[];
  isGif?: boolean;
  isVoiceNote?: boolean;
  unavailable?: boolean;
  urlExpiresAt?: string;
  linkedinPostUrl?: string;
}

export interface ConversationReaction {
  emoji: string;
  count: number;
  reactedByViewer?: boolean;
}

export interface QuotedConversationMessage {
  id: string;
  text?: string;
  senderName?: string;
  direction?: "sent" | "received";
  attachmentType?: string;
  attachments?: ConversationAttachment[];
  sharedPost?: SharedConversationPost;
}

export interface SharedConversationPost {
  id?: string;
  url: string;
  text?: string;
  authorId?: string;
  authorHandle?: string;
  authorName?: string;
  authorAvatarUrl?: string;
  createdAt?: string;
  media?: ConversationAttachment[];
}

export interface RichConversationMessage {
  id: string;
  sequenceId?: string;
  conversationId: string;
  senderUserId?: string;
  text: string;
  createdAt?: string;
  direction: "sent" | "received";
  attachments?: ConversationAttachment[];
  quotedMessageId?: string;
  quotedMessage?: QuotedConversationMessage;
  sharedPost?: SharedConversationPost;
  reactions?: ConversationReaction[];
  readAt?: string;
  deliveredAt?: string;
  editedAt?: string;
  deletedAt?: string;
  seenBy?: Array<{
    userId?: string;
    attendeeId?: string;
    senderName?: string;
    seenAt?: string;
  }>;
  isEvent?: boolean;
  sourceEventType?: string;
  eventMetadata?: {
    providerEventType?: string;
    eventLabel?: string;
    actorUserId?: string;
    actorName?: string;
    targetMessageId?: string;
  };
  deliveryStatus?: "queued" | "sending" | "sent" | "failed";
  deliveryError?: string;
  outboundOperationId?: Id<"outboundMessageOperations">;
  outboundClientRequestId?: string;
}
