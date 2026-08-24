import { describe, expect, it } from "vitest";
import type { Event } from "@xdevplatform/chat-xdk";
import {
  normalizeVerifiedXChatConversation,
  normalizeVerifiedXChatMessages,
} from "./xChatBrowserMessageNormalization";

describe("normalizeVerifiedXChatMessages", () => {
  it("retains attachments and folds edits, reactions, deletion, and receipts", () => {
    const events = [
      {
        type: "message",
        id: "message-1",
        sequenceId: "sequence-1",
        senderId: "viewer",
        keyVersion: "conversation-key-v1",
        createdAtMsec: 1_000,
        verified: true,
        content: { contentType: "text", text: "original" },
        attachments: [
          {
            attachmentType: "media",
            attachmentId: "voice-attachment",
            mediaType: "audio/mpeg",
            durationMillis: 7_000,
            filesizeBytes: 42_000,
            filename: "voice-note.mp3",
            mediaHashKey: "encrypted-voice",
            legacyMediaUrlHttps: "https://media.example/voice-note.mp3",
            legacyMediaPreviewUrl: "https://media.example/voice-note.jpg",
            fallbackText: "Voice note",
            dimensions: { width: 100, height: 24 },
            variants: [
              {
                url: "https://media.example/voice-note-high.mp3",
                content_type: "audio/mpeg",
                bit_rate: 128_000,
              },
            ],
          },
        ],
      },
      {
        type: "message",
        senderId: "viewer",
        createdAtMsec: 2_000,
        verified: true,
        content: {
          contentType: "edit",
          targetMessageId: "sequence-1",
          newText: "edited",
        },
      },
      {
        type: "message",
        senderId: "participant",
        createdAtMsec: 3_000,
        verified: true,
        content: {
          contentType: "reaction",
          targetMessageId: "sequence-1",
          emoji: "❤️",
        },
      },
      {
        type: "readReceipt",
        senderId: "participant",
        createdAtMsec: 4_000,
        verified: true,
      },
    ] as Event[];

    expect(
      normalizeVerifiedXChatMessages({ events, viewerUserId: "viewer" })
    ).toMatchObject([
      {
        id: "message-1",
        keyVersion: "conversation-key-v1",
        text: "edited",
        direction: "sent",
        editedAt: "1970-01-01T00:00:02.000Z",
        readAt: "1970-01-01T00:00:04.000Z",
        attachments: [
          {
            id: "voice-attachment",
            mediaKey: "encrypted-voice",
            type: "audio/mpeg",
            url: "https://media.example/voice-note.mp3",
            previewUrl: "https://media.example/voice-note.jpg",
            altText: "Voice note",
            isVoiceNote: true,
            durationMs: 7_000,
            fileName: "voice-note.mp3",
            fileSize: 42_000,
            width: 100,
            height: 24,
            variants: [
              {
                url: "https://media.example/voice-note-high.mp3",
                mimeType: "audio/mpeg",
                bitrate: 128_000,
              },
            ],
          },
        ],
        reactions: [{ emoji: "❤️", count: 1, reactedByViewer: false }],
      },
    ]);
  });

  it("applies a peer receipt only through XChat's seen sequence", () => {
    const messages = normalizeVerifiedXChatMessages({
      viewerUserId: "viewer",
      events: [
        {
          type: "message",
          id: "message-100",
          sequenceId: "100",
          senderId: "viewer",
          createdAtMsec: 1_000,
          verified: true,
          content: { contentType: "text", text: "Read" },
        },
        {
          type: "message",
          id: "message-200",
          sequenceId: "200",
          senderId: "viewer",
          createdAtMsec: 2_000,
          verified: true,
          content: { contentType: "text", text: "Not read" },
        },
        {
          type: "readReceipt",
          senderId: "participant",
          createdAtMsec: 3_000,
          seenUntilSequenceId: "100",
          seenAtMillis: 2_500,
          verified: true,
        },
      ] as Event[],
    });

    expect(messages[0]?.readAt).toBe("1970-01-01T00:00:02.500Z");
    expect(messages[1]?.readAt).toBeUndefined();
  });

  it("rejects unverified content and invalid reply previews", () => {
    const messages = normalizeVerifiedXChatMessages({
      viewerUserId: "viewer",
      events: [
        {
          type: "message",
          id: "unverified",
          senderId: "participant",
          verified: false,
          content: { contentType: "text", text: "ignore" },
        },
        {
          type: "message",
          id: "verified",
          senderId: "participant",
          verified: true,
          replyPreviewValidation: "invalid",
          content: {
            contentType: "text",
            text: "keep",
            replyingToPreview: { id: "spoofed", text: "do not trust" },
          },
        },
      ] as Event[],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ id: "verified", text: "keep" });
    expect(messages[0]?.quotedMessage).toBeUndefined();
  });

  it("preserves verified reply previews and marks media without a URL unavailable", () => {
    const messages = normalizeVerifiedXChatMessages({
      viewerUserId: "viewer",
      events: [
        {
          type: "message",
          id: "reply",
          senderId: "participant",
          createdAtMsec: 5_000,
          verified: true,
          replyPreviewValidation: "valid",
          content: {
            contentType: "text",
            text: "Reply text",
            replyingToPreview: {
              id: "original",
              senderId: "viewer",
              text: "Original text",
            },
          },
          attachments: [
            {
              attachmentType: "media",
              mediaType: "video/mp4",
              mediaHashKey: "encrypted-media",
            },
          ],
        },
      ] as Event[],
    });

    expect(messages[0]).toMatchObject({
      quotedMessageId: "original",
      quotedMessage: {
        id: "original",
        direction: "sent",
        text: "Original text",
      },
      attachments: [
        {
          mediaKey: "encrypted-media",
          unavailable: true,
        },
      ],
    });
  });

  it("hydrates a validated reply with the original attachment metadata", () => {
    const messages = normalizeVerifiedXChatMessages({
      viewerUserId: "viewer",
      events: [
        {
          type: "message",
          id: "original",
          sequenceId: "original-sequence",
          senderId: "participant",
          createdAtMsec: 1_000,
          verified: true,
          content: { contentType: "text", text: "" },
          attachments: [
            {
              attachmentType: "media",
              attachmentId: "image-1",
              mediaType: "image/jpeg",
              mediaHashKey: "encrypted-image",
              legacyMediaPreviewUrl: "blob:https://reacherx.test/preview",
              filename: "photo.jpg",
            },
          ],
        },
        {
          type: "message",
          id: "reply",
          senderId: "viewer",
          createdAtMsec: 2_000,
          verified: true,
          replyPreviewValidation: "valid",
          content: {
            contentType: "text",
            text: "Looks good",
            replyingToPreview: {
              id: "original-sequence",
              senderId: "participant",
              attachments: [{ attachmentType: "media" }],
            },
          },
        },
      ] as Event[],
    });

    expect(messages[1]?.quotedMessage).toMatchObject({
      id: "original-sequence",
      direction: "received",
      attachmentType: "media",
      attachments: [
        {
          id: "image-1",
          mediaKey: "encrypted-image",
          previewUrl: "blob:https://reacherx.test/preview",
          fileName: "photo.jpg",
        },
      ],
    });
  });

  it("retains media-hash-only voice messages instead of dropping them", () => {
    const messages = normalizeVerifiedXChatMessages({
      viewerUserId: "viewer",
      events: [
        {
          type: "message",
          id: "voice-message",
          senderId: "participant",
          createdAtMsec: 5_500,
          verified: true,
          content: { contentType: "voiceMessage" },
          mediaHashes: [
            { source: "voice_note", mediaHashKey: "encrypted-voice" },
          ],
        },
      ] as Event[],
    });

    expect(messages).toMatchObject([
      {
        id: "voice-message",
        text: "",
        attachments: [
          {
            mediaKey: "encrypted-voice",
            type: "voice_note",
            isVoiceNote: true,
            unavailable: true,
          },
        ],
      },
    ]);
  });

  it("normalizes raw snake-case content attachments", () => {
    const messages = normalizeVerifiedXChatMessages({
      viewerUserId: "viewer",
      events: [
        {
          type: "message",
          id: "raw-voice-message",
          senderId: "participant",
          createdAtMsec: 5_750,
          verified: true,
          content: {
            contentType: "unknown",
            attachments: [
              {
                attachment_type: "media",
                media_hash_key: "raw-encrypted-voice",
                filename: "voice-note.m4a",
                duration_millis: 7_000,
                filesize_bytes: 42_000,
              },
            ],
          },
        },
      ] as Event[],
    });

    expect(messages[0]?.attachments?.[0]).toMatchObject({
      mediaKey: "raw-encrypted-voice",
      fileName: "voice-note.m4a",
      durationMs: 7_000,
      fileSize: 42_000,
      isVoiceNote: true,
      unavailable: true,
    });
  });

  it("maps numeric XChat media wire values before rendering", () => {
    const messages = normalizeVerifiedXChatMessages({
      viewerUserId: "viewer",
      events: [
        {
          type: "message",
          id: "numeric-video-message",
          senderId: "participant",
          createdAtMsec: 5_800,
          verified: true,
          content: {
            contentType: "unknown",
            attachments: [
              {
                attachment_type: "media",
                media_type: 3,
                media_hash_key: "raw-encrypted-video",
              },
            ],
          },
        },
      ] as Event[],
    });

    expect(messages[0]?.attachments?.[0]).toMatchObject({
      mediaKey: "raw-encrypted-video",
      type: "video",
      unavailable: true,
    });
  });

  it("preserves a verified reaction targeting a legacy DM row", () => {
    const conversation = normalizeVerifiedXChatConversation({
      viewerUserId: "viewer",
      events: [
        {
          type: "message",
          senderId: "participant",
          createdAtMsec: 6_000,
          verified: true,
          content: {
            contentType: "reaction",
            targetMessageId: "legacy-message-1",
            emoji: "🔥",
          },
        },
      ] as Event[],
    });

    expect(conversation.messages).toEqual([]);
    expect(conversation.messageUpdates).toEqual([
      {
        targetMessageId: "legacy-message-1",
        reactions: [{ emoji: "🔥", count: 1, reactedByViewer: false }],
      },
    ]);
  });

  it("normalizes the snake_case reaction shape returned by chat-xdk", () => {
    const conversation = normalizeVerifiedXChatConversation({
      viewerUserId: "viewer",
      events: [
        {
          type: "message",
          senderId: "participant",
          createdAtMsec: 7_000,
          verified: true,
          content: {
            content_type: "reaction",
            target_message_id: "xchat-message-1",
            emoji: "🎉",
          },
        },
      ] as Event[],
    });

    expect(conversation.messages).toEqual([]);
    expect(conversation.messageUpdates).toEqual([
      {
        targetMessageId: "xchat-message-1",
        reactions: [{ emoji: "🎉", count: 1, reactedByViewer: false }],
      },
    ]);
  });

  it("normalizes the reply preview identifiers returned by chat-xdk", () => {
    const conversation = normalizeVerifiedXChatConversation({
      viewerUserId: "viewer",
      events: [
        {
          id: "reply-id",
          sequenceId: "reply-sequence",
          type: "message",
          senderId: "viewer",
          createdAtMsec: 8_000,
          verified: true,
          content: {
            content_type: "text",
            text: "Reply body",
            replying_to_preview: {
              senderId: "participant",
              messageText: "Original body",
              replyingToMessageSequenceId: "original-sequence",
              replyingToMessageId: "original-id",
              attachments: [],
            },
          },
        },
      ] as Event[],
    });

    expect(conversation.messages[0]).toMatchObject({
      quotedMessageId: "original-sequence",
      quotedMessage: {
        id: "original-sequence",
        text: "Original body",
        direction: "received",
      },
    });
  });

  it("preserves reply-preview media when the original is outside the loaded page", () => {
    const conversation = normalizeVerifiedXChatConversation({
      viewerUserId: "viewer",
      events: [
        {
          id: "reply-id",
          type: "message",
          senderId: "viewer",
          createdAtMsec: 9_000,
          verified: true,
          replyPreviewValidation: "valid",
          content: {
            content_type: "text",
            text: "Reply body",
            replying_to_preview: {
              senderId: "participant",
              replyingToMessageSequenceId: "older-audio-sequence",
              attachments: [
                {
                  attachment_type: "media",
                  media_type: "audio/mp4",
                  filename: "voice-note.m4a",
                  media_hash_key: "older-audio-hash",
                },
              ],
            },
          },
        },
      ] as Event[],
    });

    expect(conversation.messages[0]?.quotedMessage).toMatchObject({
      id: "older-audio-sequence",
      direction: "received",
      attachmentType: "audio/mp4",
      attachments: [
        {
          type: "audio/mp4",
          fileName: "voice-note.m4a",
          mediaKey: "older-audio-hash",
          isVoiceNote: true,
        },
      ],
    });
  });
});
