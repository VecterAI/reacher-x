import type { LinkedInMessageReactionResult } from "../../shared/lib/linkedin/messageReaction";
import { isLinkedInConversationFeatureDisabled } from "../../shared/lib/linkedin/conversation";
import type { UnipileFailure } from "./unipileClient";

export type LinkedInMessageReactionTarget = {
  conversationId: string;
  messageId: string;
};

export function resolveLinkedInMessageReactionTarget(args: {
  connectedAccountId: string;
  conversation?: {
    accountId?: string;
    conversationId?: string;
    disabledFeatures?: string[];
  } | null;
  message?: { messageId?: string } | null;
}):
  | { success: true; target: LinkedInMessageReactionTarget }
  | { success: false; result: LinkedInMessageReactionResult } {
  const conversationId = args.conversation?.conversationId?.trim();
  if (!conversationId) {
    return {
      success: false,
      result: {
        success: false,
        code: "conversation_unavailable",
        message:
          "This LinkedIn conversation is no longer available. Refresh it and try again.",
        retryable: false,
        recovery: "refresh",
      },
    };
  }

  if (args.conversation?.accountId !== args.connectedAccountId) {
    return {
      success: false,
      result: {
        success: false,
        code: "account_reconnect_required",
        message: "Reconnect LinkedIn, then try adding the reaction again.",
        retryable: false,
        recovery: "reconnect",
      },
    };
  }

  if (
    isLinkedInConversationFeatureDisabled(
      args.conversation.disabledFeatures,
      "reaction"
    )
  ) {
    return {
      success: false,
      result: {
        success: false,
        code: "feature_unavailable",
        message: "LinkedIn does not allow reactions in this conversation.",
        retryable: false,
        recovery: "none",
      },
    };
  }

  const messageId = args.message?.messageId?.trim();
  if (!messageId) {
    return {
      success: false,
      result: {
        success: false,
        code: "message_unavailable",
        message:
          "This LinkedIn message is no longer available. Refresh the conversation and try again.",
        retryable: false,
        recovery: "refresh",
      },
    };
  }

  return { success: true, target: { conversationId, messageId } };
}

export function getLinkedInMessageReactionFailureResult(
  failure: UnipileFailure
): LinkedInMessageReactionResult {
  if (
    failure.classification === "reauth_required" ||
    failure.classification === "disconnected_account" ||
    failure.classification === "action_required" ||
    failure.classification === "multiple_sessions"
  ) {
    return {
      success: false,
      code: "account_reconnect_required",
      message: "Reconnect LinkedIn, then try adding the reaction again.",
      retryable: false,
      recovery: "reconnect",
    };
  }

  if (failure.classification === "rate_limited") {
    return {
      success: false,
      code: "rate_limited",
      message:
        "LinkedIn is limiting reactions right now. Wait a moment and try again.",
      retryable: true,
      recovery: "retry",
    };
  }

  if (
    failure.classification === "target_not_found" ||
    failure.classification === "unprocessable"
  ) {
    return {
      success: false,
      code: "message_unavailable",
      message:
        "This LinkedIn message is no longer available. Refresh the conversation and try again.",
      retryable: false,
      recovery: "refresh",
    };
  }

  if (
    failure.classification === "feature_unavailable" ||
    failure.classification === "feature_not_subscribed" ||
    failure.classification === "subscription_required" ||
    failure.classification === "forbidden"
  ) {
    return {
      success: false,
      code: "feature_unavailable",
      message: "LinkedIn does not allow reactions in this conversation.",
      retryable: false,
      recovery: "none",
    };
  }

  if (failure.retryable || failure.classification === "service_unavailable") {
    return {
      success: false,
      code: "provider_unavailable",
      message: "LinkedIn could not add the reaction. Try again in a moment.",
      retryable: true,
      recovery: "retry",
    };
  }

  return {
    success: false,
    code: "unknown",
    message: "LinkedIn could not add the reaction. Try again.",
    retryable: false,
    recovery: "none",
  };
}
