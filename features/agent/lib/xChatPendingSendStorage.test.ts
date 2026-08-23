import { describe, expect, it } from "vitest";
import {
  clearStoredXChatPendingSend,
  digestXChatComposerText,
  parseStoredXChatPendingSend,
  readStoredXChatPendingSend,
  writeStoredXChatPendingSend,
} from "./xChatPendingSendStorage";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  };
}

const opaqueRecord = {
  clientRequestId: "request-1",
  messageId: "message-1",
  encodedMessageCreateEvent: "opaque-event",
  encodedMessageEventSignature: "opaque-signature",
  textDigest: "digest-1",
};

describe("pending XChat send storage", () => {
  it("reuses only a valid opaque operation inside its retention window", () => {
    const storage = createStorage();
    expect(
      writeStoredXChatPendingSend({
        prospectId: "prospect-1",
        conversationId: "conversation-1",
        record: opaqueRecord,
        storage,
        now: 1_000,
      })
    ).toBe(true);

    expect(
      readStoredXChatPendingSend({
        prospectId: "prospect-1",
        conversationId: "conversation-1",
        storage,
        now: 1_001,
      })
    ).toMatchObject(opaqueRecord);
    expect([...storage.values.values()][0]).not.toContain("plain text");
  });

  it("removes only the provider-confirmed request", () => {
    const storage = createStorage();
    writeStoredXChatPendingSend({
      prospectId: "prospect-1",
      conversationId: "conversation-1",
      record: opaqueRecord,
      storage,
      now: 1_000,
    });
    clearStoredXChatPendingSend({
      prospectId: "prospect-1",
      conversationId: "conversation-1",
      clientRequestId: "different-request",
      storage,
      now: 1_001,
    });
    expect(storage.values.size).toBe(1);

    clearStoredXChatPendingSend({
      prospectId: "prospect-1",
      conversationId: "conversation-1",
      clientRequestId: "request-1",
      storage,
      now: 1_001,
    });
    expect(storage.values.size).toBe(0);
  });

  it("rejects expired or malformed records", () => {
    expect(parseStoredXChatPendingSend("{}", 1_000)).toBeNull();
    expect(
      parseStoredXChatPendingSend(
        JSON.stringify({
          version: 1,
          ...opaqueRecord,
          expiresAt: 999,
        }),
        1_000
      )
    ).toBeNull();
  });

  it("preserves opaque SDK strings byte-for-byte", () => {
    expect(
      parseStoredXChatPendingSend(
        JSON.stringify({
          version: 1,
          ...opaqueRecord,
          encodedMessageCreateEvent: " opaque-event\n",
          encodedMessageEventSignature: " opaque-signature\n",
          expiresAt: 2_000,
        }),
        1_000
      )
    ).toMatchObject({
      encodedMessageCreateEvent: " opaque-event\n",
      encodedMessageEventSignature: " opaque-signature\n",
    });
  });

  it("matches retries through a one-way digest without persisting plaintext", async () => {
    const first = await digestXChatComposerText("  same message  ");
    const second = await digestXChatComposerText("same message");
    expect(first).toBe(second);
    expect(first).not.toContain("same message");
  });
});
