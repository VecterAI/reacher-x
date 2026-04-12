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
  type: string;
  url?: string;
  previewUrl?: string;
  altText?: string;
  width?: number;
  height?: number;
}

export interface LinkedInConversationMessage {
  id: string;
  conversationId: string;
  senderUserId?: string;
  senderAttendeeId?: string;
  text: string;
  createdAt?: string;
  direction: "sent" | "received";
  attachments?: LinkedInConversationAttachmentSummary[];
  readAt?: string;
  deliveredAt?: string;
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
  draftText?: string;
  draftAttachments?: LinkedInConversationAttachmentSummary[];
  actionRequestId?: string;
  warning?: LinkedInConversationPanelWarning;
}
