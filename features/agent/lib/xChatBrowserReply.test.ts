import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatWithJuicebox, Event } from "@xdevplatform/chat-xdk";

const { createChatMock } = vi.hoisted(() => ({
  createChatMock: vi.fn(),
}));

vi.mock("@xdevplatform/chat-xdk", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@xdevplatform/chat-xdk")>();
  return { ...actual, createChat: createChatMock };
});

import {
  decryptXChatInBrowser,
  lockXChatInBrowser,
  prepareXChatMediaMessageInBrowser,
  prepareXChatReplyMessageInBrowser,
  type XChatDecryptBundle,
} from "./xChatBrowserSession";

function encryptedPayload(messageId: string) {
  return {
    messageId,
    encryptedContent: `ciphertext:${messageId}`,
    encodedEventSignature: `signature:${messageId}`,
  };
}

describe("XChat signed reply encryption", () => {
  afterEach(() => {
    lockXChatInBrowser();
    createChatMock.mockReset();
  });

  it("uses the verified raw original, edit, and key-change events for text and media replies", async () => {
    const encryptReply = vi
      .fn()
      .mockReturnValueOnce(encryptedPayload("text-reply"))
      .mockReturnValueOnce(encryptedPayload("media-reply"));
    const chat = {
      unlock: vi.fn(),
      isUnlocked: vi.fn(() => true),
      updateConfig: vi.fn(),
      setIdentity: vi.fn(),
      setCacheKeys: vi.fn(),
      setSigningKeys: vi.fn(),
      setRejectUnverified: vi.fn(),
      decryptEvents: vi.fn(() => ({
        messages: [
          {
            originalB64: "raw-key-change",
            event: {
              type: "keyChange",
              keyVersion: "conversation-key-v0",
              verified: true,
            } as Event,
          },
          {
            originalB64: "raw-original",
            event: {
              type: "message",
              id: "original-id",
              sequenceId: "original-sequence",
              senderId: "participant",
              keyVersion: "conversation-key-v0",
              createdAtMsec: 1_000,
              verified: true,
              content: { contentType: "text", text: "Original" },
            } as Event,
          },
          {
            originalB64: "raw-edit",
            event: {
              type: "message",
              senderId: "participant",
              createdAtMsec: 2_000,
              verified: true,
              content: {
                contentType: "edit",
                targetMessageId: "original-sequence",
                newText: "Edited original",
              },
            } as Event,
          },
        ],
        conversationKeys: {
          keys: {
            "conversation-key-v0": new Uint8Array(32).fill(1),
            "conversation-key-v1": new Uint8Array(32).fill(2),
          },
          latestVersion: "conversation-key-v1",
        },
        errors: {},
      })),
      encryptReply,
      free: vi.fn(),
    } as unknown as ChatWithJuicebox;
    createChatMock.mockResolvedValue(chat);

    const bundle: XChatDecryptBundle = {
      viewerUserId: "viewer",
      participantUserId: "participant",
      conversationId: "viewer-participant",
      signingKeyVersion: "signing-v1",
      juiceboxConfig: "{}",
      signingKeys: [],
      events: [
        { encodedEvent: "raw-key-change" },
        { id: "original-id", encodedEvent: "raw-original" },
        { encodedEvent: "raw-edit" },
      ],
      eventPagesFetched: 1,
      hasMore: false,
    };

    await decryptXChatInBrowser({
      prospectId: "prospect-1",
      bundle,
      pin: "1234",
      getRealmAuthToken: async () => "realm-token",
    });

    prepareXChatReplyMessageInBrowser({
      prospectId: "prospect-1",
      text: "Text reply",
      replyToMessageId: "xchat:viewer-participant:original-id",
      replyToSequenceId: "original-sequence",
    });
    prepareXChatMediaMessageInBrowser({
      prospectId: "prospect-1",
      text: "",
      mediaHashKey: "opaque-media-hash",
      media: {
        conversationId: "viewer-participant",
        keyVersion: "conversation-key-v1",
        fileName: "photo.jpg",
        fileSize: 42,
        width: 100,
        height: 80,
        mediaType: 1,
        durationMs: 7_000,
      },
      replyToMessageId: "xchat:viewer-participant:original-id",
      replyToSequenceId: "original-sequence",
    });

    expect(encryptReply).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        conversationId: "viewer-participant",
        text: "Text reply",
        replyToEvent: "raw-original",
        replyToEditEvent: "raw-edit",
        replyToCkces: ["raw-key-change"],
      })
    );
    expect(encryptReply).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        text: "",
        replyToEvent: "raw-original",
        attachments: [
          expect.objectContaining({
            attachment_type: "media",
            media_hash_key: "opaque-media-hash",
            filename: "photo.jpg",
            duration_millis: 7_000,
          }),
        ],
      })
    );
    expect(() =>
      prepareXChatReplyMessageInBrowser({
        prospectId: "prospect-1",
        text: "Unsafe fallback",
        replyToMessageId: "xchat:viewer-participant:missing",
      })
    ).toThrow(
      "This XChat reply target is no longer available. Refresh the conversation and try again."
    );
  });

  it("omits key-change context when replying on the current conversation key", async () => {
    const encryptReply = vi.fn((_input: unknown) =>
      encryptedPayload("current-key-reply")
    );
    const chat = {
      unlock: vi.fn(),
      isUnlocked: vi.fn(() => true),
      updateConfig: vi.fn(),
      setIdentity: vi.fn(),
      setCacheKeys: vi.fn(),
      setSigningKeys: vi.fn(),
      setRejectUnverified: vi.fn(),
      decryptEvents: vi.fn(() => ({
        messages: [
          {
            originalB64: "raw-current-original",
            event: {
              type: "message",
              id: "current-original-id",
              sequenceId: "current-original-sequence",
              senderId: "participant",
              keyVersion: "conversation-key-v1",
              createdAtMsec: 1_000,
              verified: true,
              content: { contentType: "text", text: "Current original" },
            } as Event,
          },
        ],
        conversationKeys: {
          keys: { "conversation-key-v1": new Uint8Array(32).fill(1) },
          latestVersion: "conversation-key-v1",
        },
        errors: {},
      })),
      encryptReply,
      free: vi.fn(),
    } as unknown as ChatWithJuicebox;
    createChatMock.mockResolvedValue(chat);

    await decryptXChatInBrowser({
      prospectId: "prospect-current-key",
      bundle: {
        viewerUserId: "viewer",
        participantUserId: "participant",
        conversationId: "viewer-participant",
        signingKeyVersion: "signing-v1",
        juiceboxConfig: "{}",
        signingKeys: [],
        events: [
          { id: "current-original-id", encodedEvent: "raw-current-original" },
        ],
        eventPagesFetched: 1,
        hasMore: false,
      },
      pin: "1234",
      getRealmAuthToken: async () => "realm-token",
    });

    prepareXChatReplyMessageInBrowser({
      prospectId: "prospect-current-key",
      text: "Current-key reply",
      replyToMessageId: "xchat:viewer-participant:current-original-id",
      replyToSequenceId: "current-original-sequence",
    });

    expect(encryptReply).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "viewer-participant",
        text: "Current-key reply",
        replyToEvent: "raw-current-original",
      })
    );
    expect(encryptReply.mock.calls[0]?.[0]).not.toHaveProperty("replyToCkces");
  });
});
