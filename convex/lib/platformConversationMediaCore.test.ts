import { describe, expect, it } from "vitest";
import {
  assertCacheableProviderMedia,
  buildPlatformConversationMediaCacheKey,
  resolveUnipileMediaMessageId,
  sanitizeProviderMediaFileName,
} from "./platformConversationMediaCore";

describe("platform conversation media cache boundaries", () => {
  it("builds collision-resistant provider keys", () => {
    const first = buildPlatformConversationMediaCacheKey({
      platform: "linkedin",
      conversationId: "a|b",
      providerMessageId: "c",
      attachmentId: "d",
    });
    const second = buildPlatformConversationMediaCacheKey({
      platform: "linkedin",
      conversationId: "a",
      providerMessageId: "b|c",
      attachmentId: "d",
    });
    expect(first).not.toBe(second);
  });

  it("accepts useful media sizes and rejects empty or oversized responses", () => {
    expect(() =>
      assertCacheableProviderMedia({ size: 10, maxBytes: 10 })
    ).not.toThrow();
    expect(() =>
      assertCacheableProviderMedia({ size: 0, maxBytes: 10 })
    ).toThrow("did not contain any bytes");
    expect(() =>
      assertCacheableProviderMedia({ size: 11, maxBytes: 10 })
    ).toThrow("exceeds");
  });

  it("uses Unipile's stored message ID instead of the native provider ID", () => {
    expect(
      resolveUnipileMediaMessageId({
        messageId: "stored-id",
        providerMessageId: " provider-id ",
      })
    ).toBe("stored-id");
    expect(resolveUnipileMediaMessageId({ messageId: " stored-id " })).toBe(
      "stored-id"
    );
  });

  it("removes path separators and controls from provider filenames", () => {
    expect(sanitizeProviderMediaFileName(" ../bad\\name\u0000.png ")).toBe(
      ".._bad_name.png"
    );
  });
});
