import { describe, expect, test } from "vitest";
import {
  DEFAULT_CONVERSATION_HISTORY_PAGE_SIZE,
  applyConversationHistorySince,
  buildConversationHistoryPageMetadata,
  getProviderPageCursor,
  isCurrentConversationHistoryCursor,
  normalizeConversationHistoryPageLimit,
  selectDeterministicLinkedInChat,
  shouldPersistRecentConversationHistoryPage,
} from "./conversationHistoryPaginationCore";

describe("conversation history pagination", () => {
  test("keeps provider pages bounded and preserves opaque cursors", () => {
    expect(normalizeConversationHistoryPageLimit()).toBe(
      DEFAULT_CONVERSATION_HISTORY_PAGE_SIZE
    );
    expect(normalizeConversationHistoryPageLimit(500)).toBe(50);
    expect(normalizeConversationHistoryPageLimit(0)).toBe(1);
    expect(
      getProviderPageCursor({ meta: { next_token: "x-provider-cursor" } })
    ).toBe("x-provider-cursor");
    expect(getProviderPageCursor({ cursor: "unipile-cursor" })).toBe(
      "unipile-cursor"
    );
  });

  test("stops a date-range read at the requested lower boundary", () => {
    const result = applyConversationHistorySince(
      [
        { createdAt: "2026-01-01T00:00:00.000Z", id: "old" },
        { createdAt: "2026-02-01T00:00:00.000Z", id: "new" },
      ],
      Date.parse("2026-01-15T00:00:00.000Z")
    );

    expect(result).toEqual({
      items: [{ createdAt: "2026-02-01T00:00:00.000Z", id: "new" }],
      reachedSince: true,
    });
    expect(
      buildConversationHistoryPageMetadata({
        providerCursor: "ignored-after-boundary",
        reachedSince: true,
        platform: "linkedin",
      })
    ).toEqual({ hasMore: false, boundary: "complete" });
  });

  test("reports the X 30-day boundary only after the provider is exhausted", () => {
    expect(
      buildConversationHistoryPageMetadata({
        providerCursor: "next",
        reachedSince: false,
        platform: "twitter",
      })
    ).toEqual({ nextCursor: "next", hasMore: true });
    expect(
      buildConversationHistoryPageMetadata({
        reachedSince: false,
        platform: "twitter",
      })
    ).toEqual({ hasMore: false, boundary: "x_30_day_limit" });
  });

  test("selects the exact LinkedIn attendee chat deterministically", () => {
    const selected = selectDeterministicLinkedInChat(
      [
        {
          id: "other-person",
          attendee_provider_id: "other",
          timestamp: "2026-02-03T00:00:00.000Z",
        },
        {
          id: "older-match",
          attendee_provider_id: "prospect",
          timestamp: "2026-02-01T00:00:00.000Z",
        },
        {
          id: "newer-match",
          attendee_provider_id: "prospect",
          timestamp: "2026-02-02T00:00:00.000Z",
        },
      ],
      "prospect"
    );

    expect(selected?.id).toBe("newer-match");
  });

  test("never persists a continuation or date-range provider page", () => {
    expect(shouldPersistRecentConversationHistoryPage({})).toBe(true);
    expect(
      shouldPersistRecentConversationHistoryPage({ cursor: "older-page" })
    ).toBe(false);
    expect(shouldPersistRecentConversationHistoryPage({ sinceMs: 1 })).toBe(
      false
    );
  });

  test("accepts only the current cursor for the selected platform", () => {
    const coverage = [
      { platform: "twitter" as const, historyNextCursor: "x-next" },
      { platform: "linkedin" as const, historyNextCursor: "li-next" },
    ];

    expect(
      isCurrentConversationHistoryCursor({
        cursor: "x-next",
        platform: "twitter",
        coverage,
      })
    ).toBe(true);
    expect(
      isCurrentConversationHistoryCursor({
        cursor: "li-next",
        platform: "twitter",
        coverage,
      })
    ).toBe(false);
    expect(
      isCurrentConversationHistoryCursor({
        cursor: "hallucinated",
        platform: "linkedin",
        coverage,
      })
    ).toBe(false);
  });
});
