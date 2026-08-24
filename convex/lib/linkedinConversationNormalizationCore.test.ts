import { describe, expect, it } from "vitest";
import { normalizeLinkedInConversationAttachment } from "./linkedinConversationNormalizationCore";

describe("LinkedIn conversation normalization", () => {
  it("drops numeric timestamps outside the supported Date range", () => {
    expect(
      normalizeLinkedInConversationAttachment({
        type: "video",
        url: "https://media.licdn.com/example.mp4",
        url_expires_at: Number.MAX_VALUE,
      })
    ).toMatchObject({
      type: "video",
      url: "https://media.licdn.com/example.mp4",
      urlExpiresAt: undefined,
    });
  });
});
