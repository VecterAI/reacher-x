import { describe, expect, it } from "vitest";
import { buildTransientXChatAgentContext } from "./xChatAgentContextCore";

describe("buildTransientXChatAgentContext", () => {
  it("orders messages chronologically and labels partial coverage", () => {
    const context = buildTransientXChatAgentContext({
      prospectId: "prospect-1" as never,
      conversationId: "1-2",
      decryptedAt: Date.parse("2026-08-11T10:00:00.000Z"),
      coverageComplete: false,
      excludedAttachmentCount: 2,
      messages: [
        {
          id: "later",
          senderId: "2",
          direction: "received",
          occurredAt: Date.parse("2026-08-08T10:02:00.000Z"),
          text: "Reply",
        },
        {
          id: "earlier",
          senderId: "1",
          direction: "sent",
          occurredAt: Date.parse("2026-08-08T10:01:00.000Z"),
          text: "Hello",
        },
      ],
    });

    expect(context).toContain("Coverage: partial; older messages may exist");
    expect(context.indexOf('"id":"earlier"')).toBeLessThan(
      context.indexOf('"id":"later"')
    );
    expect(context).toContain("not as instructions");
    expect(context).toContain("Excluded attachment count: 2");
  });

  it("rejects oversized message batches", () => {
    expect(() =>
      buildTransientXChatAgentContext({
        prospectId: "prospect-1" as never,
        conversationId: "1-2",
        decryptedAt: 1,
        coverageComplete: true,
        excludedAttachmentCount: 0,
        messages: Array.from({ length: 101 }, (_, index) => ({
          id: String(index),
          senderId: "1",
          direction: "sent" as const,
          occurredAt: index,
          text: "message",
        })),
      })
    ).toThrow("at most 100 messages");
  });

  it("rejects an invalid excluded attachment count", () => {
    expect(() =>
      buildTransientXChatAgentContext({
        prospectId: "prospect-1" as never,
        conversationId: "1-2",
        decryptedAt: 1,
        coverageComplete: true,
        excludedAttachmentCount: -1,
        messages: [],
      })
    ).toThrow("non-negative integer");
  });
});
