import { describe, expect, test } from "vitest";
import {
  hydrateLinkedInConversationReplyPreviews,
  normalizeLinkedInWebhookMessageMetadata,
  normalizeUnipileConversationMessage,
  normalizeUnipileConversationMessages,
} from "./linkedinConversationNormalizationCore";

describe("LinkedIn conversation normalization", () => {
  test("retains Unipile media, quote, reaction, receipt, and lifecycle fields", () => {
    const message = normalizeUnipileConversationMessage({
      id: "unipile-1",
      provider_id: "linkedin-message-1",
      account_id: "account-1",
      chat_id: "chat-1",
      sender_id: "viewer",
      sender_attendee_id: "attendee-1",
      text: "Here is the clip",
      timestamp: "2026-08-13T12:00:00.000Z",
      is_sender: 1,
      seen: 1,
      delivered: 1,
      edited: 1,
      deleted: 0,
      event_type: "message_edited",
      reactions: [
        { value: "❤️", sender_id: "viewer", is_sender: true },
        { value: "❤️", sender_id: "prospect", is_sender: false },
      ],
      seen_by: { "attendee-2": "2026-08-13T12:01:00.000Z" },
      attachments: [
        {
          id: "attachment-1",
          media_key: "media-1",
          type: "video",
          url: "https://cdn.example/video.mp4",
          preview_url: "https://cdn.example/video.jpg",
          alt_text: "Product walkthrough",
          size: { width: 1920, height: 1080 },
          file_name: "walkthrough.mp4",
          mimetype: "video/mp4",
          file_size: 1_000_000,
          duration_ms: 9_000,
          variants: [
            {
              url: "https://cdn.example/video-720.mp4",
              content_type: "video/mp4",
              bit_rate: 500_000,
            },
          ],
          url_expires_at: "2026-08-14T12:00:00.000Z",
          linkedin_post_url: "https://www.linkedin.com/posts/example",
        },
      ],
      quoted: {
        provider_id: "quoted-1",
        text: "Original message",
        sender_name: "Prospect",
        is_sender: 0,
        attachments: [{ type: "image" }],
      },
    });

    expect(message).toMatchObject({
      id: "unipile-1",
      providerMessageId: "linkedin-message-1",
      conversationId: "chat-1",
      direction: "sent",
      readAt: "2026-08-13T12:00:00.000Z",
      deliveredAt: "2026-08-13T12:00:00.000Z",
      editedAt: "2026-08-13T12:00:00.000Z",
      quotedMessageId: "quoted-1",
      quotedMessage: {
        id: "quoted-1",
        text: "Original message",
        senderName: "Prospect",
        direction: "received",
        attachmentType: "image",
      },
      reactions: [{ emoji: "❤️", count: 2, reactedByViewer: true }],
      seenBy: [
        {
          attendeeId: "attendee-2",
          seenAt: "2026-08-13T12:01:00.000Z",
        },
      ],
      sourceEventType: "message_edited",
      eventMetadata: { providerEventType: "message_edited" },
      attachments: [
        {
          id: "attachment-1",
          mediaKey: "media-1",
          type: "video",
          url: "https://cdn.example/video.mp4",
          previewUrl: "https://cdn.example/video.jpg",
          altText: "Product walkthrough",
          width: 1920,
          height: 1080,
          fileName: "walkthrough.mp4",
          mimeType: "video/mp4",
          fileSize: 1_000_000,
          durationMs: 9_000,
          variants: [
            {
              url: "https://cdn.example/video-720.mp4",
              mimeType: "video/mp4",
              bitrate: 500_000,
            },
          ],
          urlExpiresAt: "2026-08-14T12:00:00.000Z",
          linkedinPostUrl: "https://www.linkedin.com/posts/example",
        },
      ],
    });
    expect(message.deletedAt).toBeUndefined();
  });

  test("normalizes rich webhook payloads without trusting unavailable URLs", () => {
    const metadata = normalizeLinkedInWebhookMessageMetadata({
      event: "message_deleted",
      event_type: "message_deleted",
      target_message_id: "message-2",
      message: {
        quoted_message_id: "quoted-2",
        reactions: [{ reaction_type: "👏", total_count: 2 }],
        deleted_at: "2026-08-13T12:05:00.000Z",
        attachments: [
          {
            id: "attachment-2",
            type: "image",
            unavailable: true,
            preview_url: "https://cdn.example/preview.jpg",
          },
        ],
      },
      actor: { id: "prospect", name: "Prospect" },
    });

    expect(metadata).toMatchObject({
      quotedMessageId: "quoted-2",
      reactions: [{ emoji: "👏", count: 2 }],
      deletedAt: "2026-08-13T12:05:00.000Z",
      sourceEventType: "message_deleted",
      eventMetadata: {
        providerEventType: "message_deleted",
        actorUserId: "prospect",
        actorName: "Prospect",
        targetMessageId: "message-2",
      },
      attachments: [
        {
          id: "attachment-2",
          type: "image",
          previewUrl: "https://cdn.example/preview.jpg",
          unavailable: true,
        },
      ],
    });
  });

  test("normalizes Unipile reaction webhook fields", () => {
    const metadata = normalizeLinkedInWebhookMessageMetadata({
      event_type: "message_reaction",
      reaction: "👀",
      reaction_sender: { is_sender: true, sender_id: "viewer" },
    });

    expect(metadata.reactions).toEqual([
      { emoji: "👀", count: 1, reactedByViewer: true },
    ]);
  });

  test("keeps att references deferred for the authenticated attachment route", () => {
    const message = normalizeUnipileConversationMessage({
      id: "unipile-att",
      account_id: "account-1",
      chat_id: "chat-1",
      timestamp: "2026-08-13T12:00:00.000Z",
      attachments: [
        {
          id: "attachment-att",
          type: "img",
          mimetype: "image/jpeg",
          url: "att://opaque-provider-reference",
          size: { width: "150", height: "90" },
        },
      ],
    });

    expect(message.attachments).toEqual([
      expect.objectContaining({
        id: "attachment-att",
        type: "img",
        width: 150,
        height: 90,
        mimeType: "image/jpeg",
        url: undefined,
        previewUrl: undefined,
      }),
    ]);
  });

  test("preserves a parent quote id and an explicit empty reaction snapshot", () => {
    const message = normalizeUnipileConversationMessage({
      id: "unipile-reply",
      provider_id: "linkedin-reply",
      account_id: "account-1",
      chat_id: "chat-1",
      text: "Reply without an embedded preview",
      timestamp: "2026-08-13T12:00:00.000Z",
      parent: "unipile-original",
      reactions: [],
    });

    expect(message).toMatchObject({
      id: "unipile-reply",
      quotedMessageId: "unipile-original",
      reactions: [],
    });
    expect(message.quotedMessage).toBeUndefined();
  });

  test("hydrates a reply preview when Unipile returns only a parent id", () => {
    const messages = normalizeUnipileConversationMessages([
      {
        id: "unipile-original",
        provider_id: "linkedin-original",
        account_id: "account-1",
        chat_id: "chat-1",
        text: "The original PDF message",
        timestamp: "2026-08-13T12:00:00.000Z",
        is_sender: 0,
        attachments: [{ type: "document", file_name: "pitch.pdf" }],
      },
      {
        id: "unipile-reply",
        provider_id: "linkedin-reply",
        account_id: "account-1",
        chat_id: "chat-1",
        text: "Reply sent from ReacherX",
        timestamp: "2026-08-13T12:01:00.000Z",
        is_sender: 1,
        parent: "linkedin-original",
      },
    ]);

    expect(messages[1]).toMatchObject({
      quotedMessageId: "linkedin-original",
      quotedMessage: {
        id: "unipile-original",
        text: "The original PDF message",
        direction: "received",
        attachmentType: "document",
      },
    });
  });

  test("hydrates a cached parent relation against fresh provider messages", () => {
    const messages = hydrateLinkedInConversationReplyPreviews([
      {
        id: "unipile-original",
        providerMessageId: "linkedin-original",
        conversationId: "chat-1",
        text: "Original provider message",
        direction: "received",
      },
      {
        id: "unipile-reply",
        conversationId: "chat-1",
        text: "Fresh reply without provider quote metadata",
        direction: "sent",
        quotedMessageId: "linkedin-original",
      },
    ]);

    expect(messages[1]?.quotedMessage).toEqual({
      id: "unipile-original",
      text: "Original provider message",
      direction: "received",
    });
  });

  test("recognizes pasted LinkedIn post URLs and preserves quoted media", () => {
    const message = normalizeUnipileConversationMessage({
      id: "unipile-post",
      account_id: "account-1",
      chat_id: "chat-1",
      text: "https://www.linkedin.com/posts/sd-designs_design-content-ux-activity-6886660393805197312-8Vim",
      timestamp: "2026-08-13T12:00:00.000Z",
      quoted: {
        id: "quoted-media",
        attachments: [
          {
            id: "quoted-image",
            type: "image",
            file_name: "quote.png",
          },
        ],
      },
    });

    expect(message.sharedPost).toMatchObject({
      id: "6886660393805197312",
      url: "https://www.linkedin.com/posts/sd-designs_design-content-ux-activity-6886660393805197312-8Vim",
    });
    expect(message.quotedMessage?.attachments).toMatchObject([
      { id: "quoted-image", type: "image", fileName: "quote.png" },
    ]);
  });
});
