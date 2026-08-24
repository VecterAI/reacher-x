import { describe, expect, test } from "vitest";
import {
  X_TYPING_PRESENCE_TTL_MS,
  normalizeXTypingActivityPayload,
} from "./xActivityTypingCore";

describe("X Activity legacy DM typing payload", () => {
  test("normalizes the sender and recipient from the documented payload", () => {
    expect(
      normalizeXTypingActivityPayload({
        created_timestamp: "1518127183443",
        sender_id: "3284025577",
        target: { recipient_id: "3001969357" },
      })
    ).toEqual({
      senderUserId: "3284025577",
      recipientUserId: "3001969357",
    });
  });

  test("rejects payloads without a sender and uses a short-lived presence", () => {
    expect(normalizeXTypingActivityPayload({ target: {} })).toBeNull();
    expect(X_TYPING_PRESENCE_TTL_MS).toBe(7_000);
  });
});
