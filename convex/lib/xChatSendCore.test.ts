import { describe, expect, it, vi } from "vitest";
import {
  assertMatchingEncryptedXChatSendOperation,
  finalizeSuccessfulXChatSend,
  normalizeEncryptedXChatSendPayload,
} from "./xChatSendCore";

describe("encrypted XChat send boundary", () => {
  it("normalizes the opaque chat-xdk transport payload", () => {
    expect(
      normalizeEncryptedXChatSendPayload({
        clientRequestId: " request-id ",
        messageId: " message-id ",
        encodedMessageCreateEvent: " encrypted-event ",
        encodedMessageEventSignature: " signed-event ",
      })
    ).toEqual({
      clientRequestId: "request-id",
      messageId: "message-id",
      encodedMessageCreateEvent: "encrypted-event",
      encodedMessageEventSignature: "signed-event",
    });
  });

  it("rejects missing or unbounded values before calling X", () => {
    expect(() =>
      normalizeEncryptedXChatSendPayload({
        clientRequestId: "request-id",
        messageId: "",
        encodedMessageCreateEvent: "event",
        encodedMessageEventSignature: "signature",
      })
    ).toThrow("message ID is missing");
    expect(() =>
      normalizeEncryptedXChatSendPayload({
        clientRequestId: "request-id",
        messageId: "id",
        encodedMessageCreateEvent: "x".repeat(256 * 1024 + 1),
        encodedMessageEventSignature: "signature",
      })
    ).toThrow("encrypted message is too large");
  });

  it("binds one client request ID to a byte-identical encrypted payload", () => {
    const operation = {
      clientRequestId: "request-id",
      prospectId: "prospect-id",
      conversationId: "1-2",
      messageId: "message-id",
      encodedMessageCreateEvent: "ciphertext",
      encodedMessageEventSignature: "signature",
    };
    expect(() =>
      assertMatchingEncryptedXChatSendOperation(operation, operation)
    ).not.toThrow();
    expect(() =>
      assertMatchingEncryptedXChatSendOperation(operation, {
        ...operation,
        encodedMessageCreateEvent: "different-ciphertext",
      })
    ).toThrow("already bound");
  });

  it("preserves a successful send when outreach completion fails", async () => {
    const sendResult = {
      success: true as const,
      conversationId: "1-2",
      messageId: "message-id",
      deduplicated: false,
    };
    const completionError = new Error("outreach completion failed");
    const completeOutreachTask = vi.fn().mockRejectedValue(completionError);
    const logError = vi.fn();

    await expect(
      finalizeSuccessfulXChatSend({
        sendResult,
        completeOutreachTask,
        logError,
      })
    ).resolves.toEqual(sendResult);
    expect(completeOutreachTask).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledWith(
      "[XChatSend] Sent message but could not complete outreach task",
      completionError
    );
  });
});
