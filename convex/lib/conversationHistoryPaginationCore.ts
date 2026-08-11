import { parseIsoToTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { getNestedRecord, getStringProperty, isRecord } from "./typeGuards";

/** Keep provider reads small enough for panels and agent tools. */
export const DEFAULT_CONVERSATION_HISTORY_PAGE_SIZE = 25;
export const MAX_CONVERSATION_HISTORY_PAGE_SIZE = 50;

export type ConversationHistoryBoundary = "complete" | "x_30_day_limit";

export type ConversationHistoryPageMetadata = {
  nextCursor?: string;
  hasMore: boolean;
  boundary?: ConversationHistoryBoundary;
};

export type ConversationHistoryCoverageCursor = {
  platform: "twitter" | "linkedin";
  historyNextCursor?: string;
};

type DatedConversationItem = {
  createdAt?: string;
};

type LinkedInChatLike = {
  id: string;
  attendee_provider_id?: string;
  timestamp?: string | null;
};

/** Normalize callers to one bounded provider page. */
export function normalizeConversationHistoryPageLimit(limit?: number): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_CONVERSATION_HISTORY_PAGE_SIZE;
  }

  return Math.min(
    MAX_CONVERSATION_HISTORY_PAGE_SIZE,
    Math.max(1, Math.trunc(limit ?? DEFAULT_CONVERSATION_HISTORY_PAGE_SIZE))
  );
}

/** Only the current recent page is a panel/realtime cache; older pages stay provider-sourced. */
export function shouldPersistRecentConversationHistoryPage(args: {
  cursor?: string;
  sinceMs?: number;
}): boolean {
  return !args.cursor && typeof args.sinceMs !== "number";
}

/**
 * Provider cursors are opaque and only remain valid for the platform/page
 * snapshot that produced them. Reject stale or cross-platform values before
 * they reach a provider API.
 */
export function isCurrentConversationHistoryCursor(args: {
  cursor: string;
  platform: "twitter" | "linkedin";
  coverage: ConversationHistoryCoverageCursor[];
}): boolean {
  return (
    args.coverage.find((item) => item.platform === args.platform)
      ?.historyNextCursor === args.cursor
  );
}

/**
 * XDK exposes X `meta.next_token` as either camelCase or snake_case. Unipile
 * exposes its opaque cursor at the top level. Keep the provider token opaque.
 */
export function getProviderPageCursor(payload: unknown): string | undefined {
  const meta = getNestedRecord(payload, "meta");
  const candidates = [
    getStringProperty(meta, "nextToken"),
    getStringProperty(meta, "next_token"),
    getStringProperty(meta, "paginationToken"),
    getStringProperty(payload, "nextToken"),
    getStringProperty(payload, "next_token"),
    getStringProperty(payload, "paginationToken"),
    getStringProperty(payload, "cursor"),
    getStringProperty(payload, "nextCursor"),
    getStringProperty(payload, "next_cursor"),
  ];
  return candidates
    .map((candidate) => candidate?.trim())
    .find((candidate): candidate is string => Boolean(candidate));
}

/**
 * Providers do not consistently pair a positive continuation flag with an
 * opaque cursor. Preserve that signal so callers do not label a partial page
 * as complete when the provider does not expose a supported continuation.
 */
export function getProviderPageHasMore(payload: unknown): boolean {
  const meta = getNestedRecord(payload, "meta");
  return [payload, meta].some(
    (value) =>
      isRecord(value) && (value.hasMore === true || value.has_more === true)
  );
}

/**
 * Stop at a caller's lower date boundary without pretending that older provider
 * history was read. Items remain in ascending chronological order.
 */
export function applyConversationHistorySince<T extends DatedConversationItem>(
  items: T[],
  sinceMs?: number
): { items: T[]; reachedSince: boolean } {
  if (typeof sinceMs !== "number" || !Number.isFinite(sinceMs)) {
    return { items, reachedSince: false };
  }

  let reachedSince = false;
  const filtered = items.filter((item) => {
    const occurredAt = item.createdAt
      ? parseIsoToTimestamp(item.createdAt)
      : undefined;
    if (typeof occurredAt !== "number") {
      return true;
    }
    if (occurredAt < sinceMs) {
      reachedSince = true;
      return false;
    }
    return true;
  });

  return { items: filtered, reachedSince };
}

/** Build a consistent panel contract while retaining platform limits. */
export function buildConversationHistoryPageMetadata(args: {
  providerCursor?: string;
  reachedSince: boolean;
  platform: "twitter" | "linkedin";
}): ConversationHistoryPageMetadata {
  const hasMore = Boolean(args.providerCursor) && !args.reachedSince;
  // Reaching the caller's requested lower bound is complete coverage for that
  // request. X's 30-day boundary is only meaningful when the provider itself
  // has no older page left before that requested boundary was reached.
  const boundary = args.reachedSince
    ? "complete"
    : hasMore
      ? undefined
      : args.platform === "twitter"
        ? "x_30_day_limit"
        : "complete";
  return {
    nextCursor: hasMore ? args.providerCursor : undefined,
    hasMore,
    ...(boundary ? { boundary } : {}),
  };
}

/**
 * A provider attendee result can contain multiple chats. Never trust provider
 * ordering: use the exact attendee provider id, then newest timestamp, then a
 * stable id tie-breaker.
 */
export function selectDeterministicLinkedInChat<T extends LinkedInChatLike>(
  chats: T[],
  attendeeProviderId: string
): T | null {
  const target = attendeeProviderId.trim();
  if (!target) {
    return null;
  }

  const matching = chats.filter(
    (chat) => chat.attendee_provider_id?.trim() === target
  );
  if (matching.length === 0) {
    return null;
  }

  return (
    [...matching].sort((left, right) => {
      const rightMs = right.timestamp
        ? (parseIsoToTimestamp(right.timestamp) ?? 0)
        : 0;
      const leftMs = left.timestamp
        ? (parseIsoToTimestamp(left.timestamp) ?? 0)
        : 0;
      if (rightMs !== leftMs) {
        return rightMs - leftMs;
      }
      return left.id.localeCompare(right.id);
    })[0] ?? null
  );
}
