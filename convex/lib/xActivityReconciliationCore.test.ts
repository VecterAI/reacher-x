import { describe, expect, test } from "vitest";
import {
  findMatchingXActivitySubscription,
  isDuplicateXActivitySubscriptionError,
} from "./xActivityReconciliationCore";

describe("X Activity subscription reconciliation", () => {
  const identity = {
    eventType: "dm.sent" as const,
    xUserId: "x-user",
    webhookId: "target-webhook",
    expectedTag: "reacher-x:x-user:dm.sent",
  };

  test("reconciles a matching subscription when X omits webhook_id from list", () => {
    const match = findMatchingXActivitySubscription(
      [
        {
          subscriptionId: "wrong-user",
          eventType: "dm.sent",
          filterUserId: "another-user",
          webhookId: "target-webhook",
        },
        {
          subscriptionId: "missing-webhook-id",
          eventType: "dm.sent",
          filterUserId: "x-user",
        },
      ],
      identity
    );

    expect(match?.subscriptionId).toBe("missing-webhook-id");
  });

  test("prefers a known delivery target over a stale duplicate", () => {
    const match = findMatchingXActivitySubscription(
      [
        {
          subscriptionId: "stale",
          eventType: "dm.sent",
          filterUserId: "x-user",
          webhookId: "stale-webhook",
        },
        {
          subscriptionId: "current",
          eventType: "dm.sent",
          filterUserId: "x-user",
          webhookId: "target-webhook",
        },
      ],
      identity
    );

    expect(match?.subscriptionId).toBe("current");
  });

  test.each([
    new Error("Duplicate subscription"),
    new Error("Subscription already exists"),
  ])("recognizes provider duplicate responses", (error) => {
    expect(isDuplicateXActivitySubscriptionError(error)).toBe(true);
  });
});
