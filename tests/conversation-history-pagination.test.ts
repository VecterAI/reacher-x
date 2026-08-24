import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  mergeConversationHistoryMessages,
  reconcileConversationHistoryRefresh,
  isConversationViewportScrollable,
  shouldRequestInitialConversationHistory,
  shouldRequestOlderConversationHistory,
} from "../features/prospects/lib/conversationHistoryHelpers";

test("initial conversation history is filled atomically within a bounded page budget", () => {
  assert.equal(
    shouldRequestInitialConversationHistory({
      isScrollable: false,
      hasMore: true,
      historyRequestKey: "cursor-1",
      isLoading: false,
      hasError: false,
      requestsStarted: 0,
    }),
    true
  );
  assert.equal(
    shouldRequestInitialConversationHistory({
      isScrollable: true,
      hasMore: true,
      historyRequestKey: "cursor-1",
      isLoading: false,
      hasError: false,
      requestsStarted: 0,
    }),
    false
  );
  assert.equal(
    shouldRequestInitialConversationHistory({
      isScrollable: false,
      hasMore: true,
      historyRequestKey: "cursor-4",
      isLoading: false,
      hasError: false,
      requestsStarted: 3,
    }),
    false
  );
  assert.equal(
    isConversationViewportScrollable({
      scrollHeight: 801,
      clientHeight: 800,
    }),
    false
  );
  assert.equal(
    isConversationViewportScrollable({
      scrollHeight: 802,
      clientHeight: 800,
    }),
    true
  );
});

test("older conversation history requires genuine upward reader intent", () => {
  const requestState = {
    scrollTop: 120,
    hasMore: true,
    historyRequestKey: "cursor-2",
    isLoading: false,
    hasError: false,
  };

  assert.equal(
    shouldRequestOlderConversationHistory({
      ...requestState,
      hasUserIntent: false,
    }),
    false
  );
  assert.equal(
    shouldRequestOlderConversationHistory({
      ...requestState,
      hasUserIntent: true,
    }),
    true
  );
  assert.equal(
    shouldRequestOlderConversationHistory({
      ...requestState,
      hasUserIntent: true,
      scrollTop: 161,
    }),
    false
  );
});

test("conversation pages merge without duplicates in chronological order", () => {
  const current = [
    { id: "3", createdAt: "2026-08-10T12:00:00.000Z", text: "latest" },
    { id: "2", createdAt: "2026-08-10T11:00:00.000Z", text: "current" },
  ];
  const olderPage = [
    { id: "1", createdAt: "2026-08-10T10:00:00.000Z", text: "older" },
    {
      id: "2",
      createdAt: "2026-08-10T11:00:00.000Z",
      text: "provider overlap",
    },
  ];

  const merged = mergeConversationHistoryMessages(current, olderPage);

  assert.deepEqual(
    merged.map((message) => message.id),
    ["1", "2", "3"]
  );
  assert.equal(merged[1]?.text, "current");
});

test("newest-page refresh preserves loaded history and its continuation cursor", () => {
  const current = {
    conversationId: "conversation-1",
    messages: [
      { id: "1", createdAt: "2026-08-10T10:00:00.000Z", text: "older" },
      { id: "2", createdAt: "2026-08-10T11:00:00.000Z", text: "stale" },
    ],
    history: { hasMore: true, nextCursor: "older-cursor" },
  };
  const refreshed = {
    conversationId: "conversation-1",
    messages: [
      { id: "2", createdAt: "2026-08-10T11:00:00.000Z", text: "fresh" },
      { id: "3", createdAt: "2026-08-10T12:00:00.000Z", text: "new" },
    ],
    history: { hasMore: true, nextCursor: "newest-page-cursor" },
  };

  const result = reconcileConversationHistoryRefresh(current, refreshed);

  assert.deepEqual(
    result?.messages.map((message) => [message.id, message.text]),
    [
      ["1", "older"],
      ["2", "fresh"],
      ["3", "new"],
    ]
  );
  assert.equal(result?.history.nextCursor, "older-cursor");
});

test("a refresh for a different conversation never merges transcripts", () => {
  const result = reconcileConversationHistoryRefresh(
    {
      conversationId: "old",
      messages: [{ id: "1", text: "old" }],
      history: { hasMore: true, nextCursor: "old-cursor" },
    },
    {
      conversationId: "new",
      messages: [{ id: "2", text: "new" }],
      history: { hasMore: false },
    }
  );

  assert.deepEqual(
    result?.messages.map((message) => message.id),
    ["2"]
  );
  assert.equal(result?.history.hasMore, false);
});

test("both conversation hooks request exactly one bounded older page", () => {
  for (const file of [
    "features/prospects/hooks/useProspectDmPanel.ts",
    "features/prospects/hooks/useProspectLinkedInPanel.ts",
  ]) {
    const source = readFileSync(file, "utf8");

    assert.match(source, /ConversationHistoryPage/);
    assert.match(source, /cursor,/);
    assert.match(source, /limit: 25/);
    assert.match(source, /mergeConversationHistoryMessages/);
    assert.doesNotMatch(source, /while\s*\(/);
  }
});

test("conversation panels share upward history loading and recovery", () => {
  for (const file of [
    "features/prospects/ui/components/XConversationPanel.tsx",
    "features/prospects/ui/components/LinkedInConversationPanel.tsx",
  ]) {
    const source = readFileSync(file, "utf8");

    assert.match(source, /<ConversationMessageViewport/);
    assert.match(source, /loadOlderError/);
  }

  const viewportSource = readFileSync(
    "features/prospects/ui/components/ConversationMessageViewport.tsx",
    "utf8"
  );
  assert.match(viewportSource, /defaultScrollPosition="end"/);
  assert.match(viewportSource, /preserveScrollOnPrepend/);
  assert.match(viewportSource, /Retry earlier messages/);
  assert.match(viewportSource, /hasOlderHistoryIntentRef/);
  assert.match(viewportSource, /onWheel=\{handleWheel\}/);
  assert.match(viewportSource, /onPointerDown/);
  assert.match(viewportSource, /requestedHistoryKeyRef/);
  assert.match(viewportSource, /INITIAL_HYDRATION_FALLBACK_MS/);
  assert.match(viewportSource, /setInitialHydrationComplete\(true\)/);
  assert.doesNotMatch(viewportSource, /new IntersectionObserver/);
  assert.doesNotMatch(viewportSource, /new ResizeObserver/);
  assert.doesNotMatch(viewportSource, /shadow-/);

  for (const file of [
    "features/prospects/hooks/useProspectDmPanel.ts",
    "features/prospects/hooks/useProspectLinkedInPanel.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /reconcileConversationHistoryRefresh/);
    assert.doesNotMatch(source, /PanelCache|panelCache|dmPanelCache/);
  }

  const xSource = readFileSync(
    "features/prospects/ui/components/XConversationPanel.tsx",
    "utf8"
  );
  assert.match(
    xSource,
    /Legacy X\/Twitter DM history is limited to the past 30/
  );
});
