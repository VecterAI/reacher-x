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
  mediaKey?: string;
  type: string;
  url?: string;
  previewUrl?: string;
  altText?: string;
  width?: number;
  height?: number;
}

export interface XDmMessage {
  id: string;
  conversationId: string;
  senderUserId?: string;
  text: string;
  createdAt?: string;
  direction: "sent" | "received";
  attachments?: XDmAttachmentSummary[];
  sender?: XDmParticipantSummary;
  readAt?: string;
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
  code: "rate_limited" | "activity_degraded";
  message: string;
  retryAfterMs?: number;
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
