import { describe, expect, it } from "vitest";
import {
  getLinkedInMessageReactionFailureResult,
  resolveLinkedInMessageReactionTarget,
} from "./linkedinMessageReactionCore";

describe("LinkedIn message reaction target", () => {
  const message = { messageId: "message-1" };
  const conversation = {
    accountId: "account-1",
    conversationId: "chat-1",
    disabledFeatures: [] as string[],
  };

  it("accepts a message owned by the connected conversation account", () => {
    expect(
      resolveLinkedInMessageReactionTarget({
        connectedAccountId: "account-1",
        conversation,
        message,
      })
    ).toEqual({
      success: true,
      target: { conversationId: "chat-1", messageId: "message-1" },
    });
  });

  it("rejects an account mismatch before the provider request", () => {
    expect(
      resolveLinkedInMessageReactionTarget({
        connectedAccountId: "other-account",
        conversation,
        message,
      })
    ).toMatchObject({
      success: false,
      result: { code: "account_reconnect_required", recovery: "reconnect" },
    });
  });

  it("rejects a conversation with reactions disabled", () => {
    expect(
      resolveLinkedInMessageReactionTarget({
        connectedAccountId: "account-1",
        conversation: { ...conversation, disabledFeatures: ["reactions"] },
        message,
      })
    ).toMatchObject({
      success: false,
      result: { code: "feature_unavailable", retryable: false },
    });
  });

  it("rejects a message outside the stored conversation", () => {
    expect(
      resolveLinkedInMessageReactionTarget({
        connectedAccountId: "account-1",
        conversation,
        message: null,
      })
    ).toMatchObject({
      success: false,
      result: { code: "message_unavailable", recovery: "refresh" },
    });
  });
});

describe("LinkedIn message reaction failure copy", () => {
  it("turns provider failures into safe retry guidance", () => {
    expect(
      getLinkedInMessageReactionFailureResult({
        classification: "service_unavailable",
        message: "private provider detail",
        retryable: true,
        status: 503,
      })
    ).toEqual({
      success: false,
      code: "provider_unavailable",
      message: "LinkedIn could not add the reaction. Try again in a moment.",
      retryable: true,
      recovery: "retry",
    });
  });

  it("turns expired credentials into reconnect guidance", () => {
    expect(
      getLinkedInMessageReactionFailureResult({
        classification: "reauth_required",
        message: "private provider detail",
        retryable: false,
        status: 401,
      })
    ).toMatchObject({
      success: false,
      code: "account_reconnect_required",
      recovery: "reconnect",
    });
  });
});
