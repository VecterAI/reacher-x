import { describe, expect, test } from "vitest";
import {
  buildDraftDmAttachments,
  mergeDmMessages,
  normalizeDmMessages,
  resolveDmMessageUrls,
} from "./xDm";

describe("X DM normalization", () => {
  test("optimistic attachments use renderable media kinds, never draft", () => {
    expect(
      buildDraftDmAttachments([
        "https://cdn.example/photo.jpg",
        "https://cdn.example/clip.mp4",
        "https://cdn.example/file.pdf",
      ])
    ).toMatchObject([{ type: "image" }, { type: "video" }, { type: "file" }]);
  });

  test("retains rich media and referenced-post metadata from the legacy API", () => {
    const messages = normalizeDmMessages(
      {
        data: [
          {
            id: "event-1",
            dm_conversation_id: "conversation-1",
            sender_id: "viewer",
            text: "Watch this https://t.co/media",
            created_at: "2026-08-13T12:00:00.000Z",
            attachments: { media_keys: ["video-key"] },
            referenced_tweets: [{ id: "post-42" }],
          },
        ],
        includes: {
          media: [
            {
              id: "media-1",
              media_key: "video-key",
              type: "video",
              url: "https://cdn.example/video.mp4",
              preview_image_url: "https://cdn.example/video.jpg",
              alt_text: "Demo video",
              width: 1920,
              height: 1080,
              duration_ms: 4_200,
              file_name: "demo.mp4",
              file_size: 3_200_000,
              mime_type: "video/mp4",
              variants: [
                {
                  url: "https://cdn.example/video-720.mp4",
                  content_type: "video/mp4",
                  bit_rate: 832_000,
                  width: 1280,
                  height: 720,
                },
              ],
            },
            {
              id: "post-image-1",
              media_key: "post-image-key",
              type: "photo",
              url: "https://cdn.example/shared-post.jpg",
              width: 1200,
              height: 630,
            },
          ],
          tweets: [
            {
              id: "post-42",
              text: "Shared post",
              author_id: "author-42",
              created_at: "2026-08-12T11:00:00.000Z",
              attachments: { media_keys: ["post-image-key"] },
            },
          ],
          users: [
            {
              id: "author-42",
              username: "shared_author",
              name: "Shared Author",
              profile_image_url: "https://cdn.example/author.jpg",
            },
          ],
        },
      },
      "viewer"
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      direction: "sent",
      text: "Watch this",
      attachments: [
        {
          id: "media-1",
          mediaKey: "video-key",
          type: "video",
          url: "https://cdn.example/video.mp4",
          previewUrl: "https://cdn.example/video.jpg",
          altText: "Demo video",
          width: 1920,
          height: 1080,
          durationMs: 4_200,
          fileName: "demo.mp4",
          fileSize: 3_200_000,
          mimeType: "video/mp4",
          variants: [
            {
              url: "https://cdn.example/video-720.mp4",
              mimeType: "video/mp4",
              bitrate: 832_000,
              width: 1280,
              height: 720,
            },
          ],
        },
        {
          id: "post-42",
          type: "post",
          url: "https://x.com/i/status/post-42",
          altText: "Shared post",
        },
      ],
      sharedPost: {
        id: "post-42",
        url: "https://x.com/i/status/post-42",
        text: "Shared post",
        authorId: "author-42",
        authorHandle: "shared_author",
        authorName: "Shared Author",
        authorAvatarUrl: "https://cdn.example/author.jpg",
        createdAt: "2026-08-12T11:00:00.000Z",
        media: [
          {
            id: "post-image-1",
            mediaKey: "post-image-key",
            type: "photo",
            url: "https://cdn.example/shared-post.jpg",
            width: 1200,
            height: 630,
          },
        ],
      },
    });
  });

  test("uses DM URL entities for display text and creates a shared post for plain status URLs", () => {
    const [message] = normalizeDmMessages(
      {
        data: [
          {
            id: "event-url",
            dm_conversation_id: "conversation-1",
            sender_id: "prospect",
            text: "Read this https://t.co/status",
            urls: [
              {
                url: "https://t.co/status",
                expanded_url: "https://x.com/example/status/123456789",
              },
            ],
          },
        ],
      },
      "viewer"
    );

    expect(message).toMatchObject({
      text: "Read this https://x.com/example/status/123456789",
      sharedPost: {
        id: "123456789",
        url: "https://x.com/i/status/123456789",
      },
    });
  });

  test("resolves a cached-only older t.co message before it is returned again", async () => {
    const cachedMessages = [
      {
        id: "event-short-url",
        conversationId: "conversation-1",
        text: "Read this https://t.co/sparse",
        direction: "received" as const,
      },
    ];
    const [message] = await resolveDmMessageUrls(
      cachedMessages,
      async (url) => {
        expect(url).toBe("https://t.co/sparse");
        return "https://x.com/example/status/987654321";
      }
    );

    expect(message).not.toBe(cachedMessages[0]);
    expect(message).toMatchObject({
      text: "Read this https://x.com/example/status/987654321",
      sharedPost: {
        id: "987654321",
        url: "https://x.com/i/status/987654321",
      },
    });
  });

  test("keeps already-resolved cached messages by reference", async () => {
    const cachedMessages = [
      {
        id: "event-expanded-url",
        conversationId: "conversation-1",
        text: "Read this https://example.com/post",
        direction: "received" as const,
      },
    ];

    const resolvedMessages = await resolveDmMessageUrls(cachedMessages);

    expect(resolvedMessages).toBe(cachedMessages);
  });

  test("retains playable legacy audio URLs, variants, and duration", () => {
    const [message] = normalizeDmMessages({
      data: [
        {
          id: "event-audio",
          dm_conversation_id: "conversation-1",
          sender_id: "prospect",
          text: "Voice note",
          attachments: { media_keys: ["audio-key"] },
        },
      ],
      includes: {
        media: [
          {
            id_str: "audio-1",
            media_key: "audio-key",
            type: "audio",
            media_url_https: "https://cdn.example/voice.m4a",
            filename: "voice.m4a",
            mime_type: "audio/mp4",
            video_info: {
              duration_millis: 9_500,
              variants: [
                {
                  url: "https://cdn.example/voice-high.m4a",
                  content_type: "audio/mp4",
                  bit_rate: 128_000,
                },
              ],
            },
          },
        ],
      },
    });

    expect(message?.attachments).toMatchObject([
      {
        id: "audio-1",
        mediaKey: "audio-key",
        type: "audio",
        url: "https://cdn.example/voice.m4a",
        fileName: "voice.m4a",
        mimeType: "audio/mp4",
        durationMs: 9_500,
        isGif: false,
        isVoiceNote: true,
        unavailable: false,
        variants: [
          {
            url: "https://cdn.example/voice-high.m4a",
            mimeType: "audio/mp4",
            bitrate: 128_000,
          },
        ],
      },
    ]);
  });

  test("preserves quote, receipt, reaction, and lifecycle metadata when supplied", () => {
    const [message] = normalizeDmMessages(
      {
        data: [
          {
            id: "event-2",
            dm_conversation_id: "conversation-1",
            sender_id: "prospect",
            text: "Reply",
            created_at: "2026-08-13T12:00:00.000Z",
            quoted_message: {
              id: "quoted-1",
              text: "Original message",
              sender_name: "Viewer",
              direction: "sent",
              attachments: [{ type: "image" }],
            },
            reactions: [{ emoji: "👍", count: 2, reacted_by_viewer: true }],
            read_at: "2026-08-13T12:01:00.000Z",
            delivered_at: "2026-08-13T12:00:30.000Z",
            edited_at: "2026-08-13T12:02:00.000Z",
            deleted_at: "2026-08-13T12:03:00.000Z",
            seen_by: [
              {
                user_id: "viewer",
                name: "Viewer",
                seen_at: "2026-08-13T12:01:00.000Z",
              },
            ],
            event_type: "message_edited",
            actor: { id: "prospect", name: "Prospect" },
            target_message_id: "event-2",
          },
        ],
      },
      "viewer"
    );

    expect(message).toMatchObject({
      quotedMessageId: "quoted-1",
      quotedMessage: {
        id: "quoted-1",
        text: "Original message",
        senderName: "Viewer",
        direction: "sent",
        attachmentType: "image",
      },
      reactions: [{ emoji: "👍", count: 2, reactedByViewer: true }],
      readAt: "2026-08-13T12:01:00.000Z",
      deliveredAt: "2026-08-13T12:00:30.000Z",
      editedAt: "2026-08-13T12:02:00.000Z",
      deletedAt: "2026-08-13T12:03:00.000Z",
      seenBy: [
        {
          userId: "viewer",
          senderName: "Viewer",
          seenAt: "2026-08-13T12:01:00.000Z",
        },
      ],
      sourceEventType: "message_edited",
      eventMetadata: {
        providerEventType: "message_edited",
        actorUserId: "prospect",
        actorName: "Prospect",
        targetMessageId: "event-2",
      },
    });
  });

  test("does not discard cached rich attachment or quote metadata on a sparse refresh", () => {
    const [message] = mergeDmMessages(
      [
        {
          id: "event-3",
          conversationId: "conversation-1",
          text: "Updated text",
          direction: "received",
          attachments: [{ type: "video", mediaKey: "key", durationMs: 500 }],
        },
      ],
      [
        {
          id: "event-3",
          conversationId: "conversation-1",
          text: "Original text",
          direction: "received",
          attachments: [
            {
              type: "video",
              mediaKey: "key",
              url: "https://cdn.example/video.mp4",
              variants: [{ url: "https://cdn.example/video-720.mp4" }],
            },
          ],
          quotedMessageId: "quoted-3",
          quotedMessage: { id: "quoted-3", text: "Quoted" },
          reactions: [{ emoji: "🔥", count: 1 }],
        },
      ]
    );

    expect(message).toMatchObject({
      text: "Updated text",
      attachments: [
        {
          mediaKey: "key",
          durationMs: 500,
          url: "https://cdn.example/video.mp4",
          variants: [{ url: "https://cdn.example/video-720.mp4" }],
        },
      ],
      quotedMessageId: "quoted-3",
      quotedMessage: { id: "quoted-3", text: "Quoted" },
      reactions: [{ emoji: "🔥", count: 1 }],
    });
  });

  test("keeps a cached quote preview when a provider refresh only repeats its id", () => {
    const [message] = mergeDmMessages(
      [
        {
          id: "event-quote",
          conversationId: "conversation-1",
          text: "Fresh reply",
          direction: "received",
          quotedMessage: { id: "quoted-4", direction: "sent" },
        },
      ],
      [
        {
          id: "event-quote",
          conversationId: "conversation-1",
          text: "Cached reply",
          direction: "received",
          quotedMessage: {
            id: "quoted-4",
            text: "Original message",
            senderName: "Viewer",
            direction: "sent",
            attachmentType: "image",
          },
        },
      ]
    );

    expect(message?.quotedMessage).toEqual({
      id: "quoted-4",
      text: "Original message",
      senderName: "Viewer",
      direction: "sent",
      attachmentType: "image",
    });
  });

  test("keeps cached shared-post hydration when a refresh only returns the post id", () => {
    const [message] = mergeDmMessages(
      [
        {
          id: "event-shared-post",
          conversationId: "conversation-1",
          text: "Shared post",
          direction: "received",
          sharedPost: {
            id: "123",
            url: "https://x.com/i/status/123",
          },
        },
      ],
      [
        {
          id: "event-shared-post",
          conversationId: "conversation-1",
          text: "Shared post",
          direction: "received",
          sharedPost: {
            id: "123",
            url: "https://x.com/i/status/123",
            text: "Cached post text",
            authorHandle: "cached_author",
          },
        },
      ]
    );

    expect(message?.sharedPost).toEqual({
      id: "123",
      url: "https://x.com/i/status/123",
      text: "Cached post text",
      authorHandle: "cached_author",
    });
  });

  test("keeps cached attachments that are omitted from a sparse refresh", () => {
    const [message] = mergeDmMessages(
      [
        {
          id: "event-4",
          conversationId: "conversation-1",
          text: "Refreshed",
          direction: "received",
          attachments: [{ type: "image", mediaKey: "image-key" }],
        },
      ],
      [
        {
          id: "event-4",
          conversationId: "conversation-1",
          text: "Cached",
          direction: "received",
          attachments: [
            {
              type: "image",
              mediaKey: "image-key",
              url: "https://cdn.example/image.jpg",
            },
            {
              id: "post-1",
              type: "post",
              url: "https://x.com/i/status/post-1",
            },
          ],
        },
      ]
    );

    expect(message.attachments).toEqual([
      {
        type: "image",
        mediaKey: "image-key",
        url: "https://cdn.example/image.jpg",
      },
      {
        id: "post-1",
        type: "post",
        url: "https://x.com/i/status/post-1",
      },
    ]);
  });
});
