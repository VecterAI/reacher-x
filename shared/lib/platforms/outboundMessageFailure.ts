import type { PlatformId } from "./types";

export type OutboundMessagePlatform = Extract<
  PlatformId,
  "twitter" | "linkedin"
>;

export type OutboundMessageFailureCode =
  | "attachment_rejected"
  | "content_invalid"
  | "account_disconnected"
  | "message_unavailable"
  | "rate_limited"
  | "provider_unavailable"
  | "unknown";

export type OutboundMessageFailure = {
  code: OutboundMessageFailureCode;
  message: string;
};

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "";
}

export function getOutboundMessageFailure(args: {
  error: unknown;
  platform: OutboundMessagePlatform;
}): OutboundMessageFailure {
  const normalized = getErrorText(args.error).trim().toLowerCase();
  const platformName = args.platform === "linkedin" ? "LinkedIn" : "X/Twitter";

  if (
    normalized.includes("voice note expired") ||
    normalized.includes("voice note is no longer available") ||
    normalized.includes("encrypted retry expired")
  ) {
    return {
      code: "message_unavailable",
      message:
        args.platform === "linkedin"
          ? "This voice note expired. Record it again."
          : "This retry expired. Check X/Twitter before sending it again.",
    };
  }

  if (
    normalized.includes("voice note by itself") ||
    normalized.includes("voice notes must be valid")
  ) {
    return {
      code: "content_invalid",
      message: "Send the voice note without text or other attachments.",
    };
  }

  if (
    normalized.includes("media has been rejected") ||
    normalized.includes("media was rejected") ||
    normalized.includes("unsupported media") ||
    normalized.includes("unsupported_media") ||
    normalized.includes("status 415")
  ) {
    return {
      code: "attachment_rejected",
      message: `${platformName} rejected this attachment. Try another file.`,
    };
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("too_many_requests") ||
    /\b429\b/u.test(normalized)
  ) {
    return {
      code: "rate_limited",
      message: `${platformName} is temporarily limiting messages. Try again shortly.`,
    };
  }

  if (
    normalized.includes("expired credential") ||
    normalized.includes("disconnected account") ||
    normalized.includes("disconnected_account") ||
    normalized.includes("account disconnected") ||
    normalized.includes("reauth") ||
    normalized.includes("unauthorized") ||
    /\b401\b/u.test(normalized)
  ) {
    return {
      code: "account_disconnected",
      message: `Reconnect ${platformName} in Settings, then try again.`,
    };
  }

  if (
    normalized.includes("get verified to message") ||
    normalized.includes("only verified users can send direct message") ||
    normalized.includes("only verified accounts can send")
  ) {
    return {
      code: "message_unavailable",
      message:
        "X/Twitter requires a verified connected account for this message request.",
    };
  }

  if (
    normalized.includes("no connection with recipient") ||
    normalized.includes("user unreachable") ||
    normalized.includes("not allowed") ||
    normalized.includes("not permitted") ||
    normalized.includes("forbidden") ||
    /\b403\b/u.test(normalized)
  ) {
    return {
      code: "message_unavailable",
      message: `You can't message this person on ${platformName} right now.`,
    };
  }

  if (
    normalized.includes("too long") ||
    normalized.includes("text limit") ||
    normalized.includes("character limit")
  ) {
    return {
      code: "content_invalid",
      message: "Shorten this message, then try again.",
    };
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("network") ||
    normalized.includes("service unavailable") ||
    normalized.includes("temporarily unavailable") ||
    /\b5\d\d\b/u.test(normalized)
  ) {
    return {
      code: "provider_unavailable",
      message: `${platformName} couldn't send this message. Try again.`,
    };
  }

  return {
    code: "unknown",
    message: `${platformName} couldn't send this message. Try again.`,
  };
}
