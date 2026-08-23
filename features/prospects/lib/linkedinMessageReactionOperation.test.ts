import type { LinkedInConversationPanelContext } from "../../../shared/lib/linkedin/conversation";
import { describe, expect, it, vi } from "vitest";
import { runLinkedInMessageReactionOperation } from "./linkedinMessageReactionOperation";

function createPanelData(): LinkedInConversationPanelContext {
  return {
    platform: "linkedin",
    conversationId: "chat-1",
    accountId: "account-1",
    prospect: { prospectId: "prospect-1", displayName: "Test prospect" },
    eligibility: {
      enabled: true,
      reasonCode: "eligible",
      reasonLabel: "Messaging available",
    },
    messages: [
      {
        id: "message-1",
        conversationId: "chat-1",
        text: "Hello",
        direction: "received",
        reactions: [{ emoji: "👍", count: 2 }],
      },
    ],
  };
}

describe("LinkedIn reaction operation", () => {
  it("rolls back the optimistic reaction when the provider rejects it", async () => {
    const original = createPanelData();
    let data: LinkedInConversationPanelContext | null = original;
    const pending: boolean[] = [];

    await expect(
      runLinkedInMessageReactionOperation({
        operationKey: "panel:message-1",
        messageId: "message-1",
        emoji: "👏",
        inFlightOperations: new Set(),
        getData: () => data,
        isCurrent: () => true,
        setData: (nextData) => {
          data = nextData;
        },
        setPending: (value) => pending.push(value),
        addReaction: async () => ({
          success: false,
          code: "provider_unavailable",
          message:
            "LinkedIn could not add the reaction. Try again in a moment.",
          retryable: true,
          recovery: "retry",
        }),
        refresh: vi.fn(),
      })
    ).rejects.toThrow("LinkedIn could not add the reaction");

    expect(data).toBe(original);
    expect(pending).toEqual([true, false]);
  });

  it("deduplicates a second request for the same message", async () => {
    const inFlightOperations = new Set<string>();
    const addReaction = vi.fn(async () => ({ success: true as const }));
    inFlightOperations.add("panel:message-1");

    await expect(
      runLinkedInMessageReactionOperation({
        operationKey: "panel:message-1",
        messageId: "message-1",
        emoji: "👏",
        inFlightOperations,
        getData: createPanelData,
        isCurrent: () => true,
        setData: vi.fn(),
        setPending: vi.fn(),
        addReaction,
        refresh: vi.fn(),
      })
    ).resolves.toBe("deduplicated");

    expect(addReaction).not.toHaveBeenCalled();
  });
});
