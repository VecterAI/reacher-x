import assert from "node:assert/strict";
import test from "node:test";
import {
  applyConversationHistorySince,
  buildConversationHistoryPageMetadata,
  getProviderPageCursor,
  normalizeConversationHistoryPageLimit,
  selectDeterministicLinkedInChat,
  shouldPersistRecentConversationHistoryPage,
} from "../convex/lib/conversationHistoryPaginationCore";
import {
  findMatchingXActivitySubscription,
  isDuplicateXActivitySubscriptionError,
} from "../convex/lib/xActivityReconciliationCore";
import {
  getWebhookMessageDirection,
  getWebhookParticipantProviderId,
} from "../convex/lib/linkedinWebhookCore";
import { parseIsoToTimestamp } from "../shared/lib/utils/time/timeUtils";

test("conversation history limits are bounded and provider cursors remain opaque", () => {
  assert.equal(normalizeConversationHistoryPageLimit(), 25);
  assert.equal(normalizeConversationHistoryPageLimit(0), 1);
  assert.equal(normalizeConversationHistoryPageLimit(500), 50);
  assert.equal(
    getProviderPageCursor({ meta: { next_token: "opaque/x-token" } }),
    "opaque/x-token"
  );
  assert.equal(
    getProviderPageCursor({ cursor: "opaque-linkedin-token" }),
    "opaque-linkedin-token"
  );
});

test("date boundaries stop pagination without returning older messages", () => {
  const sinceMs = parseIsoToTimestamp("2026-08-10T11:00:00.000Z");
  if (typeof sinceMs !== "number") {
    throw new Error("Expected a valid ISO timestamp fixture.");
  }
  const result = applyConversationHistorySince(
    [
      { id: "1", createdAt: "2026-08-10T10:00:00.000Z" },
      { id: "2", createdAt: "2026-08-10T11:00:00.000Z" },
      { id: "3", createdAt: "2026-08-10T12:00:00.000Z" },
    ],
    sinceMs
  );

  assert.deepEqual(
    result.items.map((item) => item.id),
    ["2", "3"]
  );
  assert.equal(result.reachedSince, true);
  assert.deepEqual(
    buildConversationHistoryPageMetadata({
      providerCursor: "unused-after-boundary",
      reachedSince: result.reachedSince,
      platform: "twitter",
    }),
    {
      nextCursor: undefined,
      hasMore: false,
      boundary: "x_30_day_limit",
    }
  );
});

test("older provider pages are not added to the recent conversation cache", () => {
  assert.equal(shouldPersistRecentConversationHistoryPage({}), true);
  assert.equal(
    shouldPersistRecentConversationHistoryPage({ cursor: "older-page" }),
    false
  );
  assert.equal(
    shouldPersistRecentConversationHistoryPage({ sinceMs: 123 }),
    false
  );
});

test("LinkedIn chat selection is deterministic for the requested attendee", () => {
  const selected = selectDeterministicLinkedInChat(
    [
      {
        id: "wrong-attendee",
        attendee_provider_id: "other",
        timestamp: "2026-08-10T13:00:00.000Z",
      },
      {
        id: "older-match",
        attendee_provider_id: "target",
        timestamp: "2026-08-10T11:00:00.000Z",
      },
      {
        id: "newer-match",
        attendee_provider_id: "target",
        timestamp: "2026-08-10T12:00:00.000Z",
      },
    ],
    "target"
  );

  assert.equal(selected?.id, "newer-match");
});

test("X/Twitter subscription reconciliation handles paginated-list omissions", () => {
  const subscription = findMatchingXActivitySubscription(
    [
      {
        subscriptionId: "subscription-1",
        eventType: "chat.received",
        filterUserId: "viewer-1",
        tag: "reacherx:user-1:chat.received",
      },
    ],
    {
      eventType: "chat.received",
      xUserId: "viewer-1",
      webhookId: "webhook-1",
      expectedTag: "reacherx:user-1:chat.received",
    }
  );

  assert.equal(subscription?.subscriptionId, "subscription-1");
  assert.equal(
    isDuplicateXActivitySubscriptionError(
      new Error("DuplicateSubscription: subscription already exists")
    ),
    true
  );
});

test("Unipile message_received direction uses account and sender provider ids", () => {
  const sentPayload = {
    event: "message_received",
    account_info: { user_id: "self" },
    sender: { attendee_provider_id: "self" },
  };
  const receivedPayload = {
    event: "message_received",
    account_info: { user_id: "self" },
    sender: { attendee_provider_id: "prospect" },
  };

  assert.equal(getWebhookMessageDirection(sentPayload, {}), "sent");
  assert.equal(getWebhookMessageDirection(receivedPayload, {}), "received");
  assert.equal(
    getWebhookParticipantProviderId(receivedPayload, {}),
    "prospect"
  );
});
