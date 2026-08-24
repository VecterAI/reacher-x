import { describe, expect, test } from "vitest";
import { planUnipileWebhookReconciliation } from "./unipileWebhookReconciliationCore";

const desired = {
  source: "messaging",
  requestUrl: "https://dev.example.com/unipile-webhook",
  events: ["message_received", "message_read", "message_reaction"],
};

describe("Unipile webhook reconciliation", () => {
  test("keeps one exact webhook and removes same-deployment duplicates", () => {
    expect(
      planUnipileWebhookReconciliation(
        [
          { id: "first", enabled: true, ...desired },
          { id: "stored", enabled: true, ...desired },
        ],
        { ...desired, storedWebhookId: "stored" }
      )
    ).toEqual({
      keepWebhookId: "stored",
      createReplacement: false,
      deleteWebhookIds: ["first"],
    });
  });

  test("replaces a stale event subscription", () => {
    expect(
      planUnipileWebhookReconciliation(
        [
          {
            id: "stale",
            source: desired.source,
            requestUrl: desired.requestUrl,
            enabled: true,
            events: ["message_received"],
          },
        ],
        desired
      )
    ).toEqual({
      keepWebhookId: undefined,
      createReplacement: true,
      deleteWebhookIds: ["stale"],
    });
  });

  test("does not touch another deployment's webhook", () => {
    expect(
      planUnipileWebhookReconciliation(
        [
          {
            id: "production",
            source: desired.source,
            requestUrl: "https://prod.example.com/unipile-webhook",
            enabled: true,
            events: desired.events,
          },
        ],
        desired
      )
    ).toEqual({
      keepWebhookId: undefined,
      createReplacement: true,
      deleteWebhookIds: [],
    });
  });

  test("treats event order as irrelevant", () => {
    expect(
      planUnipileWebhookReconciliation(
        [
          {
            id: "exact",
            source: desired.source,
            requestUrl: desired.requestUrl,
            enabled: true,
            events: [...desired.events].reverse(),
          },
        ],
        desired
      )
    ).toMatchObject({
      keepWebhookId: "exact",
      createReplacement: false,
      deleteWebhookIds: [],
    });
  });
});
