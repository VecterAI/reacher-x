import { describe, expect, it } from "vitest";
import {
  normalizeXChatConversationId,
  normalizeXChatMediaHashKey,
  readBoundedXChatEncryptedMedia,
  toXChatConversationEventId,
  toXChatConversationPathId,
} from "./xChatMediaCore";

describe("XChat encrypted media boundaries", () => {
  it("normalizes the event-form conversation ID for the REST path", () => {
    expect(toXChatConversationPathId("  123:456  ")).toBe("123-456");
    expect(toXChatConversationEventId("  456-123  ")).toBe("123:456");
    expect(normalizeXChatConversationId("456:123")).toBe("123-456");
    expect(normalizeXChatConversationId("123-456")).toBe("123-456");
    expect(normalizeXChatConversationId("group:conversation:id")).toBe(
      "group-conversation-id"
    );
    expect(normalizeXChatMediaHashKey(" media-hash ")).toBe("media-hash");
  });

  it("rejects missing and oversized provider identifiers", () => {
    expect(() => toXChatConversationPathId(" ")).toThrow("missing");
    expect(() => normalizeXChatMediaHashKey("x".repeat(513))).toThrow(
      "too long"
    );
  });

  it("rejects an oversized declared ciphertext before reading its body", async () => {
    const response = new Response(new Uint8Array([1]), {
      headers: {
        "content-length": "5",
        "content-type": "application/octet-stream",
      },
    });

    await expect(readBoundedXChatEncryptedMedia(response, 4)).rejects.toThrow(
      "download limit"
    );
  });

  it("rejects a streaming ciphertext that grows beyond the hard limit", async () => {
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(4));
          controller.enqueue(new Uint8Array([1]));
          controller.close();
        },
      }),
      { headers: { "content-type": "application/octet-stream" } }
    );

    await expect(readBoundedXChatEncryptedMedia(response, 4)).rejects.toThrow(
      "download limit"
    );
  });

  it("rejects non-binary and non-success upstream responses", async () => {
    await expect(
      readBoundedXChatEncryptedMedia(
        new Response("not found", { status: 404, statusText: "Not Found" })
      )
    ).rejects.toThrow("404 Not Found");
    await expect(
      readBoundedXChatEncryptedMedia(
        new Response("unexpected", {
          headers: { "content-type": "application/json" },
        })
      )
    ).rejects.toThrow("unexpected content type");
  });

  it("returns a bounded binary response unchanged", async () => {
    const ciphertext = await readBoundedXChatEncryptedMedia(
      new Response(new Uint8Array([9, 8, 7]), {
        headers: { "content-type": "application/octet-stream" },
      })
    );

    expect(Array.from(new Uint8Array(ciphertext))).toEqual([9, 8, 7]);
  });
});
