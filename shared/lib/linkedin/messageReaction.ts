export const LINKEDIN_MESSAGE_REACTIONS = [
  "👏",
  "👍",
  "😊",
  "❤️",
  "💡",
  "😂",
] as const;

export type LinkedInMessageReaction =
  (typeof LINKEDIN_MESSAGE_REACTIONS)[number];

export type LinkedInMessageReactionFailureCode =
  | "account_reconnect_required"
  | "conversation_unavailable"
  | "feature_unavailable"
  | "message_unavailable"
  | "provider_unavailable"
  | "rate_limited"
  | "unknown";

export type LinkedInMessageReactionResult =
  | { success: true }
  | {
      success: false;
      code: LinkedInMessageReactionFailureCode;
      message: string;
      retryable: boolean;
      recovery: "none" | "reconnect" | "refresh" | "retry";
    };

export function isLinkedInMessageReaction(
  value: string
): value is LinkedInMessageReaction {
  return (LINKEDIN_MESSAGE_REACTIONS as readonly string[]).includes(value);
}
