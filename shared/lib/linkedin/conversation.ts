export const LINKEDIN_DM_TEXT_MAX = 8_000;

export type LinkedInConversationEligibilityReasonCode =
  | "eligible"
  | "not_allowed"
  | "missing_connection"
  | "missing_account"
  | "missing_scopes"
  | "subscription_required"
  | "feature_unavailable"
  | "action_required"
  | "restricted"
  | "unknown";

export interface LinkedInConversationEligibility {
  enabled: boolean;
  reasonCode: LinkedInConversationEligibilityReasonCode;
  reasonLabel: string;
  conversationId?: string;
}

export interface LinkedInConversationAttachmentSummary {
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
  variants?: LinkedInConversationAttachmentVariant[];
  isGif?: boolean;
  isVoiceNote?: boolean;
  unavailable?: boolean;
  urlExpiresAt?: string;
  linkedinPostUrl?: string;
}

export interface LinkedInConversationAttachmentVariant {
  url: string;
  mimeType?: string;
  bitrate?: number;
  width?: number;
  height?: number;
}

export interface LinkedInConversationSharedPost {
  id: string;
  url: string;
  text?: string;
  authorId?: string;
  authorHandle?: string;
  authorName?: string;
  authorAvatarUrl?: string;
  createdAt?: string;
  media?: LinkedInConversationAttachmentSummary[];
}

export interface LinkedInConversationQuotedMessage {
  id: string;
  text?: string;
  senderName?: string;
  direction?: "sent" | "received";
  attachmentType?: string;
  attachments?: LinkedInConversationAttachmentSummary[];
  sharedPost?: LinkedInConversationSharedPost;
}

export interface LinkedInConversationReaction {
  emoji: string;
  count: number;
  reactedByViewer?: boolean;
}

export interface LinkedInConversationSeenBy {
  userId?: string;
  attendeeId?: string;
  senderName?: string;
  seenAt?: string;
}

export interface LinkedInConversationEventMetadata {
  providerEventType?: string;
  eventLabel?: string;
  actorUserId?: string;
  actorName?: string;
  targetMessageId?: string;
}

export interface LinkedInConversationMessage {
  id: string;
  /** Native LinkedIn identifier when it differs from the provider cache key. */
  providerMessageId?: string;
  conversationId: string;
  senderUserId?: string;
  senderAttendeeId?: string;
  text: string;
  createdAt?: string;
  direction: "sent" | "received";
  attachments?: LinkedInConversationAttachmentSummary[];
  readAt?: string;
  deliveredAt?: string;
  quotedMessageId?: string;
  quotedMessage?: LinkedInConversationQuotedMessage;
  sharedPost?: LinkedInConversationSharedPost;
  reactions?: LinkedInConversationReaction[];
  editedAt?: string;
  deletedAt?: string;
  seenBy?: LinkedInConversationSeenBy[];
  sourceEventType?: string;
  eventMetadata?: LinkedInConversationEventMetadata;
  messageType?:
    | "MESSAGE"
    | "INVITATION"
    | "INMAIL"
    | "INMAIL_DECLINE"
    | "INMAIL_REPLY"
    | "INMAIL_ACCEPT";
  isEvent?: boolean;
}

export interface LinkedInConversationProspectSummary {
  prospectId: string;
  displayName: string;
  title?: string;
  avatarUrl?: string;
  profileUrl?: string;
  username?: string;
  urn?: string;
}

export interface LinkedInConversationPanelWarning {
  code:
    | "rate_limited"
    | "provider_error"
    | "credentials_required"
    | "action_required"
    | "feature_not_subscribed";
  message: string;
  retryAfterMs?: number;
}

/** Opaque provider pagination state for older conversation messages. */
export interface LinkedInConversationHistoryPageState {
  nextCursor?: string;
  hasMore: boolean;
  boundary?: "complete" | "x_30_day_limit";
}

export interface LinkedInConversationPanelContext {
  platform: "linkedin";
  conversationId?: string;
  accountId?: string;
  participantUserId?: string;
  participantAttendeeId?: string;
  participantProviderId?: string;
  participantUsername?: string;
  participantHeadline?: string;
  prospect: LinkedInConversationProspectSummary;
  eligibility: LinkedInConversationEligibility;
  messages: LinkedInConversationMessage[];
  /** Provider page metadata; messages are always returned ascending for rendering. */
  history?: LinkedInConversationHistoryPageState;
  /** Provider-reported chat capabilities; omit unavailable composer affordances. */
  disabledFeatures?: string[];
  draftText?: string;
  draftAttachments?: LinkedInConversationAttachmentSummary[];
  actionRequestId?: string;
  warning?: LinkedInConversationPanelWarning;
}

export function isLinkedInConversationFeatureDisabled(
  disabledFeatures: string[] | undefined,
  feature: "reaction" | "reply"
): boolean {
  const target = feature.replace(/[^a-z]/gu, "");
  return Boolean(
    disabledFeatures?.some((value) => {
      const normalized = value.toLowerCase().replace(/[^a-z]/gu, "");
      return normalized === target || normalized === `${target}s`;
    })
  );
}
