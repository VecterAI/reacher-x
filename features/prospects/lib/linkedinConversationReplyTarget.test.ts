import { describe, expect, it } from "vitest";
import { enrichLinkedInReplyTargetAttachments } from "./linkedinConversationReplyTarget";

describe("enrichLinkedInReplyTargetAttachments", () => {
  it("reuses the resolved image as the composer reply thumbnail", () => {
    const result = enrichLinkedInReplyTargetAttachments({
      message: {
        id: "message-1",
        conversationId: "conversation-1",
        direction: "received",
        text: "",
        attachments: [{ id: "attachment-1", type: "attachment" }],
      },
      getResolvedAttachment: () => ({
        contentType: "image/jpeg",
        fileName: "photo.jpg",
        size: 1_024,
        url: "https://example.com/resolved-photo.jpg",
      }),
    });

    expect(result.attachments?.[0]).toMatchObject({
      fileName: "photo.jpg",
      fileSize: 1_024,
      mimeType: "image/jpeg",
      previewUrl: "https://example.com/resolved-photo.jpg",
      unavailable: false,
      url: "https://example.com/resolved-photo.jpg",
    });
  });

  it("leaves the original message untouched when no resolved media exists", () => {
    const message = {
      id: "message-1",
      conversationId: "conversation-1",
      direction: "received" as const,
      text: "",
      attachments: [{ id: "attachment-1", type: "image" }],
    };

    expect(
      enrichLinkedInReplyTargetAttachments({
        message,
        getResolvedAttachment: () => null,
      })
    ).toBe(message);
  });
});
