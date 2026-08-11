import { describe, expect, test } from "vitest";
import { getProspectInteractionHistoryInputSchema } from "./getProspectInteractionHistory";

describe("getProspectInteractionHistory input", () => {
  test("rejects invented provider cursors from Agent input", () => {
    expect(
      getProspectInteractionHistoryInputSchema.safeParse({
        cursor: "hallucinated-provider-cursor",
      }).success
    ).toBe(false);
  });

  test("accepts a bounded latest or since request without provider state", () => {
    expect(
      getProspectInteractionHistoryInputSchema.parse({
        platform: "twitter",
        limit: 25,
      })
    ).toMatchObject({
      platform: "twitter",
      limit: 25,
      kinds: ["dm", "comment", "reply"],
    });
    expect(
      getProspectInteractionHistoryInputSchema.parse({
        platform: "linkedin",
        since: "2026-08-01T00:00:00.000Z",
      })
    ).toMatchObject({
      platform: "linkedin",
      since: "2026-08-01T00:00:00.000Z",
    });
  });
});
