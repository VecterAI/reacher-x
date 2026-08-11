import { describe, expect, test } from "vitest";
import { normalizeXActivityEventType } from "./xActivity";

describe("X Activity provider normalization", () => {
  test("accepts X's dotted encrypted-chat join alias", () => {
    expect(normalizeXActivityEventType("chat.conversation.join")).toBe(
      "chat.conversation_join"
    );
  });

  test("preserves documented event types and rejects unknown values", () => {
    expect(normalizeXActivityEventType("dm.received")).toBe("dm.received");
    expect(normalizeXActivityEventType("unknown.event")).toBeUndefined();
  });
});
