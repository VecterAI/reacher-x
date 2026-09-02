import { describe, expect, it } from "vitest";
import { getOutboundMessageFailure } from "../../../shared/lib/platforms/outboundMessageFailure";

describe("getOutboundMessageFailure", () => {
  it("turns a provider media stack into actionable LinkedIn copy", () => {
    const failure = getOutboundMessageFailure({
      platform: "linkedin",
      error:
        "Uncaught UnipileError: The media has been rejected by the provider.\n    at async sendLinkedInMessageForUser (../convex/linkedin.ts:2760:6)",
    });

    expect(failure).toEqual({
      code: "attachment_rejected",
      message: "LinkedIn rejected this attachment. Try another file.",
    });
    expect(failure.message).not.toContain("convex/");
    expect(failure.message).not.toContain("UnipileError");
  });

  it.each([
    [
      "twitter",
      "429 Too Many Requests",
      "X/Twitter is temporarily limiting messages. Try again shortly.",
    ],
    [
      "linkedin",
      "errors/disconnected_account",
      "Reconnect LinkedIn in Settings, then try again.",
    ],
    [
      "linkedin",
      "Send a LinkedIn voice note by itself.",
      "Send the voice note without text or other attachments.",
    ],
    [
      "linkedin",
      "This voice note is no longer available.",
      "This voice note expired. Record it again.",
    ],
  ] as const)("maps %s failures to safe copy", (platform, error, message) => {
    expect(getOutboundMessageFailure({ platform, error }).message).toBe(
      message
    );
  });

  it("does not expose unknown provider internals", () => {
    const failure = getOutboundMessageFailure({
      platform: "twitter",
      error: new Error(
        "Uncaught ProviderInternalError at ../convex/xActivity.ts:100"
      ),
    });

    expect(failure).toEqual({
      code: "unknown",
      message: "X/Twitter couldn't send this message. Try again.",
    });
  });

  it("preserves X/Twitter's verified-account requirement", () => {
    expect(
      getOutboundMessageFailure({
        platform: "twitter",
        error:
          "Get verified to message this user. Only verified users can send Direct Message requests to people that don't follow them.",
      })
    ).toEqual({
      code: "message_unavailable",
      message:
        "X/Twitter requires a verified connected account for this message request.",
    });
  });
});
