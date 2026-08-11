import { describe, expect, test } from "vitest";
import {
  AGENT_PROVIDER_HISTORY_PAGE_SIZE,
  MAX_AGENT_PROVIDER_HISTORY_PAGES,
  getAgentProviderHistoryPageBudget,
  getInteractionHistoryEvidenceSource,
  normalizeInteractionHistoryConnectionState,
  shouldContinueAgentProviderHistoryRead,
} from "./prospectInteractionHistoryCore";

describe("Agent interaction-history evidence", () => {
  test("keeps ordinary live reads to one bounded page and bounds since reads", () => {
    expect(AGENT_PROVIDER_HISTORY_PAGE_SIZE).toBe(25);
    expect(getAgentProviderHistoryPageBudget()).toBe(1);
    expect(getAgentProviderHistoryPageBudget(1)).toBe(
      MAX_AGENT_PROVIDER_HISTORY_PAGES
    );
    expect(
      shouldContinueAgentProviderHistoryRead({
        pagesFetched: 1,
        nextCursor: "provider-owned-cursor",
        hasMore: true,
      })
    ).toBe(false);
    expect(
      shouldContinueAgentProviderHistoryRead({
        sinceMs: 1,
        pagesFetched: MAX_AGENT_PROVIDER_HISTORY_PAGES - 1,
        nextCursor: "provider-owned-cursor",
        hasMore: true,
      })
    ).toBe(true);
    expect(
      shouldContinueAgentProviderHistoryRead({
        sinceMs: 1,
        pagesFetched: MAX_AGENT_PROVIDER_HISTORY_PAGES,
        nextCursor: "provider-owned-cursor",
        hasMore: true,
      })
    ).toBe(false);
  });

  test("retains the distinction between live, cached, and failed evidence", () => {
    expect(
      getInteractionHistoryEvidenceSource({
        liveSucceeded: true,
        hasCachedConversation: true,
      })
    ).toBe("live");
    expect(
      getInteractionHistoryEvidenceSource({
        liveSucceeded: false,
        hasCachedConversation: true,
      })
    ).toBe("cached");
    expect(
      getInteractionHistoryEvidenceSource({
        liveSucceeded: false,
        hasCachedConversation: false,
      })
    ).toBe("failed");
  });

  test("normalizes reconnect and provider account states for Agent evidence", () => {
    expect(normalizeInteractionHistoryConnectionState("connected")).toBe(
      "connected"
    );
    expect(normalizeInteractionHistoryConnectionState("expired")).toBe(
      "reconnect_required"
    );
    expect(normalizeInteractionHistoryConnectionState("action_required")).toBe(
      "action_required"
    );
    expect(normalizeInteractionHistoryConnectionState(undefined)).toBe(
      "unknown"
    );
  });
});
