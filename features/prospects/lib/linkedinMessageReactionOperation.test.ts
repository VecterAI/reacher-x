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

    expect(data).toStrictEqual(original);
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

  it("keeps the successful optimistic reaction when refresh fails", async () => {
    let data: LinkedInConversationPanelContext | null = createPanelData();
    const refreshError = new Error("refresh unavailable");

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
        setPending: vi.fn(),
        addReaction: async () => ({ success: true }),
        refresh: async () => {
          throw refreshError;
        },
      })
    ).resolves.toBe("added");

    expect(
      data?.messages[0]?.reactions?.find((reaction) => reaction.emoji === "👏")
    ).toMatchObject({ count: 1, reactedByViewer: true });
  });

  it("rolls back only the failed reaction and preserves concurrent data", async () => {
    let data: LinkedInConversationPanelContext | null = createPanelData();

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
        setPending: vi.fn(),
        addReaction: async () => {
          if (data) {
            data = { ...data, draftText: "concurrent draft" };
          }
          return {
            success: false,
            code: "provider_unavailable",
            message: "Provider rejected the reaction",
            retryable: true,
            recovery: "retry",
          };
        },
        refresh: vi.fn(),
      })
    ).rejects.toThrow("Provider rejected the reaction");

    expect(data?.draftText).toBe("concurrent draft");
    expect(data?.messages[0]?.reactions).toEqual([{ emoji: "👍", count: 2 }]);
  });
});
