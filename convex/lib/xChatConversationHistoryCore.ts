import type { Infer } from "convex/values";
import type { xChatConversationHistoryEvidenceValidator } from "../validators";
import { parseIsoToTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { getStringProperty, isRecord } from "./typeGuards";
import {
  getProviderPageCursor,
  getProviderPageHasMore,
} from "./conversationHistoryPaginationCore";

export type XChatConversationHistoryEvidence = Infer<
  typeof xChatConversationHistoryEvidenceValidator
>;

/**
 * XChat responses expose encrypted envelopes. These types intentionally omit
 * `encodedEvent`, so callers cannot treat ciphertext as message text. The
 * account-wide listing is normalized for isolated uses, but it is not a
 * prerequisite for direct participant-event retrieval.
 */
export type XChatConversationPage = {
  conversations: Array<{
    id: string;
    participantIds: string[];
    type?: "direct" | "group";
  }>;
  nextCursor?: string;
};

export type XChatEventPage = {
  events: Array<{
    senderId?: string;
    createdAtMs?: number;
  }>;
  nextCursor?: string;
  hasMore: boolean;
};

export type XChatEventPageSummary = {
  eventCount: number;
  inboundEventCount: number;
  outboundEventCount: number;
  unattributedEventCount: number;
  latestEventAt?: number;
  oldestEventAt?: number;
  reachedSince: boolean;
  nextCursor?: string;
};

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseXChatTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  return parseIsoToTimestamp(trimmed);
}

/** Read only envelope metadata from an XChat conversation-list response. */
export function normalizeXChatConversationPage(
  payload: unknown
): XChatConversationPage {
  const root = isRecord(payload) ? payload : undefined;
  const conversations = Array.isArray(root?.data)
    ? root.data
        .map((value) => {
          if (!isRecord(value)) {
            return null;
          }
          const id = getStringProperty(value, "id")?.trim();
          if (!id) {
            return null;
          }
          const type = getStringProperty(value, "type");
          return {
            id,
            participantIds: getStringArray(
              value.participantIds ?? value.participant_ids
            ),
            ...(type === "direct" || type === "group" ? { type } : {}),
          };
        })
        .filter(
          (
            conversation
          ): conversation is XChatConversationPage["conversations"][number] =>
            conversation !== null
        )
    : [];

  const nextCursor = getProviderPageCursor(payload);

  return {
    conversations,
    ...(nextCursor ? { nextCursor } : {}),
  };
}

/**
 * Select only the direct XChat conversation involving the authenticated user
 * and the selected prospect. Group conversations are intentionally excluded.
 */
export function findDirectXChatConversation(args: {
  conversations: XChatConversationPage["conversations"];
  viewerUserId: string;
  participantUserId: string;
}): XChatConversationPage["conversations"][number] | null {
  const viewerUserId = args.viewerUserId.trim();
  const participantUserId = args.participantUserId.trim();
  if (!viewerUserId || !participantUserId) {
    return null;
  }

  return (
    args.conversations.find((conversation) => {
      if (conversation.type && conversation.type !== "direct") {
        return false;
      }
      const participantIds = new Set(conversation.participantIds);
      return (
        participantIds.size === 2 &&
        participantIds.has(viewerUserId) &&
        participantIds.has(participantUserId)
      );
    }) ?? null
  );
}

/** Read envelope metadata only; `encodedEvent` is never returned or decoded. */
export function normalizeXChatEventPage(payload: unknown): XChatEventPage {
  const root = isRecord(payload) ? payload : undefined;
  const events = Array.isArray(root?.data)
    ? root.data
        .map((value) => {
          if (!isRecord(value)) {
            return null;
          }
          // A ChatMessageEvent without an encoded envelope is not evidence of
          // an encrypted message event. Do not count arbitrary response rows.
          const encodedEvent = (
            getStringProperty(value, "encodedEvent") ??
            getStringProperty(value, "encoded_event")
          )?.trim();
          if (!encodedEvent) {
            return null;
          }
          const senderId = (
            getStringProperty(value, "senderId") ??
            getStringProperty(value, "sender_id")
          )?.trim();
          const createdAtMs = parseXChatTimestamp(
            value.createdAtMsec ?? value.created_at_msec
          );
          return {
            ...(senderId ? { senderId } : {}),
            ...(typeof createdAtMs === "number" ? { createdAtMs } : {}),
          };
        })
        .filter(
          (event): event is XChatEventPage["events"][number] => event !== null
        )
    : [];

  const nextCursor = getProviderPageCursor(payload);

  return {
    events,
    ...(nextCursor ? { nextCursor } : {}),
    hasMore: getProviderPageHasMore(payload),
  };
}

/**
 * Summarize encrypted event envelopes without attempting message decryption.
 * Counts are limited to the requested range when `sinceMs` is supplied.
 */
export function summarizeXChatEventPage(args: {
  page: XChatEventPage;
  viewerUserId: string;
  participantUserId: string;
  sinceMs?: number;
}): XChatEventPageSummary {
  let eventCount = 0;
  let inboundEventCount = 0;
  let outboundEventCount = 0;
  let unattributedEventCount = 0;
  let latestEventAt: number | undefined;
  let oldestEventAt: number | undefined;
  let reachedSince = false;

  for (const event of args.page.events) {
    if (
      typeof args.sinceMs === "number" &&
      typeof event.createdAtMs === "number" &&
      event.createdAtMs < args.sinceMs
    ) {
      reachedSince = true;
      continue;
    }

    eventCount += 1;
    if (event.senderId === args.viewerUserId) {
      outboundEventCount += 1;
    } else if (event.senderId === args.participantUserId) {
      inboundEventCount += 1;
    } else {
      unattributedEventCount += 1;
    }

    if (typeof event.createdAtMs === "number") {
      latestEventAt =
        typeof latestEventAt === "number"
          ? Math.max(latestEventAt, event.createdAtMs)
          : event.createdAtMs;
      oldestEventAt =
        typeof oldestEventAt === "number"
          ? Math.min(oldestEventAt, event.createdAtMs)
          : event.createdAtMs;
    }
  }

  return {
    eventCount,
    inboundEventCount,
    outboundEventCount,
    unattributedEventCount,
    ...(typeof latestEventAt === "number" ? { latestEventAt } : {}),
    ...(typeof oldestEventAt === "number" ? { oldestEventAt } : {}),
    reachedSince,
    ...(args.page.nextCursor ? { nextCursor: args.page.nextCursor } : {}),
  };
}
