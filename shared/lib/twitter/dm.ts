export type XDmEligibilityReasonCode =
  | "eligible"
  | "not_allowed"
  | "missing_connection"
  | "missing_scopes"
  | "unknown";

export interface XDmEligibility {
  enabled: boolean;
  reasonCode: XDmEligibilityReasonCode;
  reasonLabel: string;
  receivesYourDm?: boolean;
  conversationId?: string;
}

export interface XDmParticipantSummary {
  userId: string;
  username: string;
  name: string;
  avatarUrl?: string;
  verified?: boolean;
}

export interface XDmAttachmentSummary {
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
  variants?: XDmAttachmentVariant[];
  isGif?: boolean;
  isVoiceNote?: boolean;
  unavailable?: boolean;
  urlExpiresAt?: string;
  linkedinPostUrl?: string;
}

export interface XDmAttachmentVariant {
  url: string;
  mimeType?: string;
  bitrate?: number;
  width?: number;
  height?: number;
}

/**
 * A post shared inside a DM. The fields deliberately mirror the minimum data
 * needed to render immediately, while allowing the house post-card hydration
 * path to enrich the author and media later.
 */
export interface XDmSharedPost {
  id: string;
  url: string;
  text?: string;
  authorId?: string;
  authorHandle?: string;
  authorName?: string;
  authorAvatarUrl?: string;
  createdAt?: string;
  media?: XDmAttachmentSummary[];
}

export interface XDmQuotedMessage {
  id: string;
  text?: string;
  senderName?: string;
  direction?: "sent" | "received";
  attachmentType?: string;
  attachments?: XDmAttachmentSummary[];
  sharedPost?: XDmSharedPost;
}

export interface XDmReaction {
  emoji: string;
  count: number;
  reactedByViewer?: boolean;
}

export interface XDmSeenBy {
  userId?: string;
  attendeeId?: string;
  senderName?: string;
  seenAt?: string;
}

export interface XDmEventMetadata {
  providerEventType?: string;
  eventLabel?: string;
  actorUserId?: string;
  actorName?: string;
  targetMessageId?: string;
}

export interface XDmMessage {
  id: string;
  /** XChat sequence identifier used for encrypted replies and reactions. */
  sequenceId?: string;
  conversationId: string;
  senderUserId?: string;
  text: string;
  createdAt?: string;
  direction: "sent" | "received";
  attachments?: XDmAttachmentSummary[];
  sender?: XDmParticipantSummary;
  readAt?: string;
  deliveredAt?: string;
  quotedMessageId?: string;
  quotedMessage?: XDmQuotedMessage;
  sharedPost?: XDmSharedPost;
  reactions?: XDmReaction[];
  editedAt?: string;
  deletedAt?: string;
  seenBy?: XDmSeenBy[];
  sourceEventType?: string;
  eventMetadata?: XDmEventMetadata;
  /** Client-only delivery state for optimistic and failed outbound rows. */
  deliveryStatus?: "queued" | "sending" | "sent" | "failed";
  deliveryError?: string;
  outboundClientRequestId?: string;
}

export interface XDmProspectSummary {
  prospectId: string;
  displayName: string;
  title?: string;
  avatarUrl?: string;
  profileUrl?: string;
  username?: string;
  verified?: boolean;
}

export interface XDmPanelWarning {
  code: "rate_limited" | "activity_degraded" | "provider_error";
  message: string;
  retryAfterMs?: number;
}

/** Opaque provider pagination state for older conversation messages. */
export interface ConversationHistoryPageState {
  nextCursor?: string;
  hasMore: boolean;
  /** X's DM lookup API cannot return events older than 30 days. */
  boundary?: "complete" | "x_30_day_limit";
}

export interface XDmPanelContext {
  platform: "twitter";
  conversationId?: string;
  participantUserId?: string;
  /** From cached platform conversation; use when prospect.username is not yet resolved. */
  participantUsername?: string;
  prospect: XDmProspectSummary;
  eligibility: XDmEligibility;
  messages: XDmMessage[];
  /** The current provider page is newest-first from the API, normalized ascending for rendering. */
  history?: ConversationHistoryPageState;
  draftText?: string;
  draftAttachments?: XDmAttachmentSummary[];
  actionRequestId?: string;
  warning?: XDmPanelWarning;
}

export function computeOneToOneDmConversationId(
  leftUserId: string,
  rightUserId: string
): string {
  return [leftUserId, rightUserId]
    .sort((a, b) => {
      if (a.length !== b.length) {
        return a.length - b.length;
      }
      return a.localeCompare(b);
    })
    .join("-");
}
